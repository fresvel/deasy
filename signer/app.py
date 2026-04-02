import json
import logging
import os
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from uuid import uuid4

import pika
from asn1crypto import x509 as asn1_x509
from cryptography.hazmat.primitives.serialization import pkcs12
from minio import Minio
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.pdf_utils.images import PdfImage
from pyhanko.pdf_utils.layout import AxisAlignment, InnerScaling, Margins, SimpleBoxLayoutRule
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.general import load_cert_from_pemder
from pyhanko.sign import fields, signers
from pyhanko.sign.fields import SigSeedSubFilter
from pyhanko.sign.signers import PdfSignatureMetadata, PdfSigner
from pyhanko.sign.timestamps import HTTPTimeStamper
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko.stamp import TextStampStyle
from pyhanko_certvalidator import ValidationContext

from find_marker import find_all_marker_coordinates, find_marker_coordinates


PORT = int(os.getenv("SIGNER_PORT", "4000"))
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://rabbitmq:5672")
SIGN_REQUEST_QUEUE = os.getenv("SIGN_REQUEST_QUEUE", "deasy.sign.request")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "deasy_minio")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "deasy_minio_secret")
MINIO_SPOOL_BUCKET = os.getenv("MINIO_SPOOL_BUCKET", "deasy-spool")
SIGNER_WORKSPACE_DIR = os.getenv("SIGNER_WORKSPACE_DIR", "/tmp/deasy-signer-workspace")
PYHANKO_TSA_URL = os.getenv("PYHANKO_TSA_URL", "").strip()
PYHANKO_DEFAULT_TSA_URL = os.getenv("PYHANKO_DEFAULT_TSA_URL", "https://freetsa.org/tsr").strip()
SIGNER_EMBED_VALIDATION_INFO = os.getenv("SIGNER_EMBED_VALIDATION_INFO", "1").strip() == "1"
SIGNER_USE_PADES_LTA = os.getenv("SIGNER_USE_PADES_LTA", "0").strip() == "1"
SIGNER_USE_GHOSTSCRIPT = os.getenv("SIGNER_USE_GHOSTSCRIPT", "1").strip() == "1"
SIGNER_REASON = os.getenv("SIGNER_REASON", "Firma electrónica DEASY")
SIGNER_LOCATION = os.getenv("SIGNER_LOCATION", "Ecuador")
SIGMAKER_DIR = Path(os.getenv("SIGMAKER_DIR", "/opt/sigmaker"))
SIGNER_TRUST_DIR = Path(os.getenv("SIGNER_TRUST_DIR", "/app/trust"))


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("signer")


def create_minio_client() -> Minio:
    endpoint = MINIO_ENDPOINT.replace("http://", "").replace("https://", "")
    return Minio(
        endpoint,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_ENDPOINT.startswith("https://"),
    )


MINIO_CLIENT = create_minio_client()


@dataclass
class JobPaths:
    source_pdf: Path
    cleaned_pdf: Path
    signed_pdf: Path
    cert_file: Path


def validate_payload(data: dict[str, Any]) -> str | None:
    required = ["signType", "minioPdfPath", "stampText", "finalPath", "minioCertPath", "certPassword"]
    for field_name in required:
        value = data.get(field_name)
        if value is None or value == "":
            return f"Missing required field: {field_name}"

    sign_type = data.get("signType")
    if sign_type not in {"coordinates", "token"}:
        return "Invalid signType: must be 'coordinates' or 'token'"

    if sign_type == "coordinates":
        coordinates = data.get("coordinates") or {}
        if not all(isinstance(coordinates.get(key), (int, float)) for key in ("page", "x", "y")):
            return "signType 'coordinates' requires coordinates: { page, x, y }"

    if sign_type == "token" and not isinstance(data.get("token"), str):
        return "signType 'token' requires a token string"

    return None


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def resolve_tsa_url(data: dict[str, Any]) -> str:
    explicit_tsa_url = str(data.get("tsaUrl") or "").strip()
    if explicit_tsa_url:
        return explicit_tsa_url

    if PYHANKO_TSA_URL:
        return PYHANKO_TSA_URL

    if as_bool(data.get("use_timestamp")) or as_bool(data.get("useDefaultTsa")):
        return PYHANKO_DEFAULT_TSA_URL

    return ""


def is_validation_warning_allowed(data: dict[str, Any]) -> bool:
    return as_bool(data.get("allow_untrusted_signer")) or as_bool(data.get("allowValidationWarning"))


def ensure_parent(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)


def download_from_minio(bucket: str | None, object_name: str, target_path: Path):
    resolved_bucket = bucket or MINIO_SPOOL_BUCKET
    ensure_parent(target_path)
    MINIO_CLIENT.fget_object(resolved_bucket, object_name, str(target_path))


def upload_to_minio(bucket: str | None, object_name: str, source_path: Path):
    resolved_bucket = bucket or MINIO_SPOOL_BUCKET
    MINIO_CLIENT.fput_object(resolved_bucket, object_name, str(source_path), content_type="application/pdf")


def clean_pdf_if_needed(source_pdf: Path, cleaned_pdf: Path):
    if not SIGNER_USE_GHOSTSCRIPT:
        shutil.copyfile(source_pdf, cleaned_pdf)
        return

    try:
        subprocess.run(
            [
                "gs",
                "-sDEVICE=pdfwrite",
                "-dCompatibilityLevel=1.4",
                "-dPDFSETTINGS=/prepress",
                "-dNOPAUSE",
                "-dBATCH",
                "-o",
                str(cleaned_pdf),
                str(source_pdf),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception as exc:
        logger.warning("Ghostscript falló, se usará el PDF original: %s", exc)
        shutil.copyfile(source_pdf, cleaned_pdf)


def resolve_coordinates(data: dict[str, Any], pdf_path: Path) -> dict[str, int]:
    if data["signType"] == "coordinates":
        coordinates = data["coordinates"]
        return {
            "page": int(coordinates["page"]),
            "x": int(coordinates["x"]),
            "y": int(coordinates["y"]),
        }

    result = find_marker_coordinates(str(pdf_path), data["token"])
    if result is None:
        raise ValueError(f"Token marker '{data['token']}' not found in PDF")
    return result


def resolve_coordinate_list(data: dict[str, Any], pdf_path: Path) -> list[dict[str, int]]:
    if data["signType"] == "coordinates":
        return [resolve_coordinates(data, pdf_path)]

    results = find_all_marker_coordinates(str(pdf_path), data["token"])
    if not results:
        raise ValueError(f"Token marker '{data['token']}' not found in PDF")
    return results


def load_certificate_info(cert_path: Path, cert_password: str) -> dict[str, Any]:
    key, cert, additional = pkcs12.load_key_and_certificates(
        cert_path.read_bytes(),
        cert_password.encode("utf-8"),
    )
    if key is None or cert is None:
        raise ValueError("El archivo PKCS#12 no contiene clave privada y certificado válidos.")

    now = datetime.now(timezone.utc)
    if cert.not_valid_before_utc > now:
        raise ValueError("El certificado todavía no es válido.")
    if cert.not_valid_after_utc < now:
        raise ValueError("El certificado está expirado.")

    return {
        "subject": cert.subject.rfc4514_string(),
        "issuer": cert.issuer.rfc4514_string(),
        "serial_number": format(cert.serial_number, "x"),
        "not_valid_before": cert.not_valid_before_utc.isoformat(),
        "not_valid_after": cert.not_valid_after_utc.isoformat(),
        "common_name": next(
            (
                attr.value
                for attr in cert.subject
                if attr.oid.dotted_string == "2.5.4.3"
            ),
            cert.subject.rfc4514_string(),
        ),
        "chain_length": len(additional or []),
    }


def build_validation_context() -> ValidationContext | None:
    if not SIGNER_EMBED_VALIDATION_INFO and not PYHANKO_TSA_URL and not PYHANKO_DEFAULT_TSA_URL:
        return None
    trust_roots, extra_trust_roots = load_trust_material()
    return ValidationContext(
        allow_fetching=True,
        trust_roots=trust_roots or None,
        extra_trust_roots=extra_trust_roots or None,
        other_certs=(trust_roots + extra_trust_roots) or None,
        revocation_mode="soft-fail",
    )


def load_certificate_file(cert_path: Path):
    try:
        return load_cert_from_pemder(str(cert_path))
    except Exception:
        return asn1_x509.Certificate.load(cert_path.read_bytes())


def load_certificates_from_dir(directory: Path):
    if not directory.exists() or not directory.is_dir():
        return []

    certificates = []
    for cert_path in sorted(directory.iterdir()):
        if not cert_path.is_file():
            continue
        if cert_path.suffix.lower() not in {".pem", ".crt", ".cer", ".der"}:
            continue
        try:
            certificates.append(load_certificate_file(cert_path))
        except Exception as error:
            logger.warning("No se pudo cargar certificado de confianza %s: %s", cert_path, error)
    return certificates


def load_trust_material():
    root_dir = SIGNER_TRUST_DIR / "roots"
    extra_dir = SIGNER_TRUST_DIR / "extra"

    trust_roots = load_certificates_from_dir(root_dir)
    extra_trust_roots = load_certificates_from_dir(extra_dir)

    # Compatibilidad: si no existen subdirectorios, trata cualquier PEM/CRT/CER/DER
    # directo en trust/ como trust root.
    if not trust_roots and not extra_trust_roots and SIGNER_TRUST_DIR.exists():
        trust_roots = load_certificates_from_dir(SIGNER_TRUST_DIR)

    if trust_roots or extra_trust_roots:
        logger.info(
            "Material de confianza cargado: %s roots, %s extra",
            len(trust_roots),
            len(extra_trust_roots),
        )

    return trust_roots, extra_trust_roots


def generate_stamp_image(data: dict[str, Any], output_path: Path):
    command = [
        "node",
        str(SIGMAKER_DIR / "cli.mjs"),
        str(output_path),
        data["stampText"].strip(),
        data.get("finalPath") or data["minioPdfPath"],
        str(SIGMAKER_DIR / "puce_logo.png"),
    ]
    subprocess.run(command, check=True, capture_output=True, text=True)


def build_stamp_style(stamp_image_path: Path) -> TextStampStyle:
    return TextStampStyle(
        background=PdfImage(str(stamp_image_path)),
        background_opacity=1,
        border_width=0,
        background_layout=SimpleBoxLayoutRule(
            x_align=AxisAlignment.ALIGN_MID,
            y_align=AxisAlignment.ALIGN_MID,
            margins=Margins(0, 0, 0, 0),
            inner_content_scaling=InnerScaling.STRETCH_FILL,
        ),
        stamp_text="",
    )


def sign_pdf_document(data: dict[str, Any], paths: JobPaths, certificate_info: dict[str, Any]) -> dict[str, Any]:
    coordinates_list = resolve_coordinate_list(data, paths.cleaned_pdf)
    width = int(data.get("boxWidth", 124))
    height = int(data.get("boxHeight", 48))
    signer = signers.SimpleSigner.load_pkcs12(
        str(paths.cert_file),
        passphrase=data["certPassword"].encode("utf-8"),
    )
    stamp_image_path = paths.signed_pdf.parent / "stamp.png"
    generate_stamp_image(data, stamp_image_path)

    tsa_url = resolve_tsa_url(data)
    allow_validation_warning = is_validation_warning_allowed(data)
    validation_context = None if allow_validation_warning else build_validation_context()
    timestamper = HTTPTimeStamper(tsa_url) if tsa_url else None
    working_input = paths.cleaned_pdf
    signed_coordinates = []
    signed_field_names = []

    for index, coordinates in enumerate(coordinates_list):
        field_name = f"sig_{uuid4().hex}"
        left = int(coordinates["x"])
        top = int(coordinates["y"])
        if data["signType"] == "token":
            top += int(height * 0.5)
        box = (left, top - height, left + width, top)
        meta = PdfSignatureMetadata(
            field_name=field_name,
            md_algorithm="sha256",
            reason=data.get("reason") or SIGNER_REASON,
            location=data.get("location") or SIGNER_LOCATION,
            name=certificate_info["common_name"],
            subfilter=SigSeedSubFilter.PADES,
            validation_context=validation_context,
            embed_validation_info=bool(validation_context and SIGNER_EMBED_VALIDATION_INFO and not allow_validation_warning),
            use_pades_lta=bool(validation_context and timestamper and SIGNER_USE_PADES_LTA and not allow_validation_warning),
        )
        field_spec = fields.SigFieldSpec(
            field_name,
            on_page=max(int(coordinates["page"]) - 1, 0),
            box=box,
        )

        pdf_signer = PdfSigner(
            meta,
            signer=signer,
            timestamper=timestamper,
            stamp_style=build_stamp_style(stamp_image_path),
            new_field_spec=field_spec,
        )

        target_output = paths.signed_pdf if index == len(coordinates_list) - 1 else paths.signed_pdf.parent / f"signed_{index}.pdf"
        with working_input.open("rb") as input_stream:
            writer = IncrementalPdfFileWriter(input_stream)
            with target_output.open("wb") as output_stream:
                pdf_signer.sign_pdf(
                    writer,
                    output=output_stream,
                    appearance_text_params={},
                )

        if working_input != paths.cleaned_pdf and working_input.exists():
            working_input.unlink(missing_ok=True)

        working_input = target_output
        signed_field_names.append(field_name)
        signed_coordinates.append(
            {
                "page": int(coordinates["page"]),
                "x": left,
                "y": top,
                "width": width,
                "height": height,
            }
        )

    return {
        "fieldName": signed_field_names[-1] if signed_field_names else None,
        "fieldNames": signed_field_names,
        "tsaUrl": tsa_url or None,
        "coordinates": signed_coordinates[-1] if signed_coordinates else None,
        "coordinateMatches": signed_coordinates,
        "matchCount": len(signed_coordinates),
    }


def validate_signed_pdf(signed_pdf: Path) -> dict[str, Any]:
    with signed_pdf.open("rb") as input_stream:
        reader = PdfFileReader(input_stream)
        if not reader.embedded_signatures:
            return {"performed": False, "message": "El PDF firmado no contiene firmas embebidas."}
        embedded_signature = reader.embedded_signatures[-1]
        validation_context = build_validation_context()
        status = validate_pdf_signature(
            embedded_signature,
            signer_validation_context=validation_context,
        )
        return {
            "performed": True,
            "fieldName": embedded_signature.field_name,
            "bottomLine": bool(status.bottom_line),
            "details": status.pretty_print_details(),
        }


def validate_signed_pdf_with_policy(signed_pdf: Path, data: dict[str, Any]) -> dict[str, Any]:
    try:
        validation_info = validate_signed_pdf(signed_pdf)
    except Exception as error:
        if is_validation_warning_allowed(data):
            return {
                "performed": True,
                "bottomLine": False,
                "warning": str(error),
                "warningAccepted": True,
                "details": str(error),
            }
        raise

    if validation_info.get("bottomLine", True):
        return validation_info

    if is_validation_warning_allowed(data):
        return {
            **validation_info,
            "warning": validation_info.get("details") or "La firma se generó, pero la cadena del certificado no pudo validarse.",
            "warningAccepted": True,
        }

    raise ValueError(validation_info.get("details") or "The signer's certificate could not be validated")


def process_job(data: dict[str, Any]) -> dict[str, Any]:
    validation_error = validate_payload(data)
    if validation_error:
        return {"status": "error", "message": validation_error}

    job_id = str(uuid4())
    workspace_root = Path(SIGNER_WORKSPACE_DIR)
    workspace_root.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix=f"{job_id}-", dir=workspace_root) as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        paths = JobPaths(
            source_pdf=temp_dir / "input.pdf",
            cleaned_pdf=temp_dir / "cleaned.pdf",
            signed_pdf=temp_dir / "signed.pdf",
            cert_file=temp_dir / "cert.p12",
        )

        try:
            logger.info("[%s] Descargando PDF %s", job_id, data["minioPdfPath"])
            download_from_minio(data.get("minioBucket"), data["minioPdfPath"], paths.source_pdf)

            logger.info("[%s] Descargando certificado %s", job_id, data["minioCertPath"])
            download_from_minio(data.get("minioCertBucket"), data["minioCertPath"], paths.cert_file)
            certificate_info = load_certificate_info(paths.cert_file, data["certPassword"])

            logger.info("[%s] Normalizando PDF", job_id)
            clean_pdf_if_needed(paths.source_pdf, paths.cleaned_pdf)

            signing_info = sign_pdf_document(data, paths, certificate_info)
            validation_info = validate_signed_pdf_with_policy(paths.signed_pdf, data)

            upload_to_minio(data.get("minioBucket"), data["minioPdfPath"], paths.signed_pdf)
            final_path = data.get("finalPath") or data["minioPdfPath"]
            if final_path != data["minioPdfPath"]:
                upload_to_minio(data.get("minioBucket"), final_path, paths.signed_pdf)

            return {
                "status": "success",
                "message": "Documento firmado correctamente.",
                "jobId": job_id,
                "signedPath": final_path,
                "workingPath": data["minioPdfPath"],
                "finalPath": final_path,
                "certificate": certificate_info,
                "signature": signing_info,
                "validation": validation_info,
                "timestamped": bool(signing_info.get("tsaUrl")),
                "tsaUrl": signing_info.get("tsaUrl"),
            }
        except Exception as exc:
            logger.exception("[%s] Error firmando", job_id)
            return {
                "status": "error",
                "message": str(exc),
                "jobId": job_id,
            }


class SignHttpHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, payload: dict[str, Any]):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok", "service": "signer"})
            return
        self._send_json(404, {"status": "error", "message": "Not found"})

    def do_POST(self):
        if self.path != "/sign":
            self._send_json(404, {"status": "error", "message": "Not found. Use POST /sign"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._send_json(400, {"status": "error", "message": "Invalid JSON body"})
            return

        result = process_job(payload)
        self._send_json(200 if result.get("status") == "success" else 500, result)

    def log_message(self, format: str, *args):
        logger.info("HTTP %s", format % args)


def publish_response(channel, response_queue: str, payload: dict[str, Any]):
    channel.queue_declare(queue=response_queue, durable=True)
    channel.basic_publish(
        exchange="",
        routing_key=response_queue,
        body=json.dumps(payload).encode("utf-8"),
        properties=pika.BasicProperties(
            content_type="application/json",
            delivery_mode=2,
        ),
    )


def start_rabbit_worker():
    while True:
        connection = None
        try:
            parameters = pika.URLParameters(RABBITMQ_URL)
            parameters.heartbeat = 30
            parameters.blocked_connection_timeout = 300
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            channel.queue_declare(queue=SIGN_REQUEST_QUEUE, durable=True)
            channel.basic_qos(prefetch_count=1)
            logger.info("RabbitMQ conectado en %s", RABBITMQ_URL)
            logger.info("Escuchando solicitudes en %s", SIGN_REQUEST_QUEUE)

            def on_message(ch, method, properties, body):
                try:
                    payload = json.loads(body.decode("utf-8"))
                except Exception as exc:
                    logger.error("Payload RabbitMQ inválido: %s", exc)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    return

                response_queue = payload.get("responseQueue")
                if not response_queue:
                    logger.error("Solicitud RabbitMQ sin responseQueue")
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    return

                result = process_job(payload)
                result["correlationId"] = payload.get("correlationId")
                publish_response(ch, response_queue, result)
                ch.basic_ack(delivery_tag=method.delivery_tag)

            channel.basic_consume(queue=SIGN_REQUEST_QUEUE, on_message_callback=on_message)
            channel.start_consuming()
        except Exception as exc:
            logger.exception("Worker RabbitMQ detenido. Reintentando conexión en 5 segundos: %s", exc)
            time.sleep(5)
        finally:
            try:
                if connection and connection.is_open:
                    connection.close()
            except Exception:
                pass


def start_http_server():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), SignHttpHandler)
    logger.info("Signer service running on port %s", PORT)
    server.serve_forever()


if __name__ == "__main__":
    rabbit_thread = threading.Thread(target=start_rabbit_worker, daemon=True)
    rabbit_thread.start()
    start_http_server()
