import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from uuid import uuid4

import pika
from asn1crypto import core as asn1_core
from asn1crypto import x509 as asn1_x509
from cryptography import x509 as crypto_x509
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
VALIDATE_REQUEST_QUEUE = os.getenv("SIGN_VALIDATE_REQUEST_QUEUE", "deasy.sign.validate.request")
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
CedulaPattern = re.compile(r"\b\d{10,13}\b")
SECURITY_DATA_EXTENSION_OIDS = {
    "1.3.6.1.4.1.37746.3.1": "cedula",
    "1.3.6.1.4.1.37746.3.2": "first_names",
    "1.3.6.1.4.1.37746.3.3": "last_name",
    "1.3.6.1.4.1.37746.3.4": "second_last_name",
    "1.3.6.1.4.1.37746.3.7": "address",
    "1.3.6.1.4.1.37746.3.8": "phone",
    "1.3.6.1.4.1.37746.3.9": "city",
    "1.3.6.1.4.1.37746.3.10": "country_name",
    "1.3.6.1.4.1.37746.3.12": "nationality",
    "1.3.6.1.4.1.37746.3.20": "document_number",
    "1.3.6.1.4.1.37746.3.21": "document_type",
    "1.3.6.1.4.1.37746.3.22": "civil_status",
    "1.3.6.1.4.1.37746.3.23": "gender",
}
ICERT_EXTENSION_OIDS = {
    "1.3.6.1.4.1.43745.1.3.1": "cedula",
    "1.3.6.1.4.1.43745.1.3.2": "first_names",
    "1.3.6.1.4.1.43745.1.3.3": "last_name",
    "1.3.6.1.4.1.43745.1.3.4": "second_last_name",
    "1.3.6.1.4.1.43745.1.3.7": "address",
    "1.3.6.1.4.1.43745.1.3.8": "phone",
    "1.3.6.1.4.1.43745.1.3.9": "city",
    "1.3.6.1.4.1.43745.1.3.11": "document_number",
    "1.3.6.1.4.1.43745.1.3.12": "nationality",
    "1.3.6.1.4.1.43745.1.3.32": "person_type",
    "1.3.6.1.4.1.43745.1.3.33": "container_type",
    "1.3.6.1.4.1.43745.1.3.34": "document_number",
    "1.3.6.1.4.1.43745.1.3.35": "profession",
}
FIRMASEGURA_EXTENSION_OIDS = {
    "1.3.6.1.4.1.61305.3.1": "cedula",
    "1.3.6.1.4.1.61305.3.2": "first_names",
    "1.3.6.1.4.1.61305.3.3": "last_name",
    "1.3.6.1.4.1.61305.3.4": "second_last_name",
    "1.3.6.1.4.1.61305.3.7": "address",
    "1.3.6.1.4.1.61305.3.8": "phone",
    "1.3.6.1.4.1.61305.3.9": "city",
    "1.3.6.1.4.1.61305.3.11": "document_number",
    "1.3.6.1.4.1.61305.3.12": "nationality",
}
PERSON_ATTRIBUTE_OID_MAPS = (
    SECURITY_DATA_EXTENSION_OIDS,
    ICERT_EXTENSION_OIDS,
    FIRMASEGURA_EXTENSION_OIDS,
)


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


def validate_validation_payload(data: dict[str, Any]) -> str | None:
    minio_pdf_path = str(data.get("minioPdfPath") or "").strip()
    if not minio_pdf_path:
        return "Missing required field: minioPdfPath"
    if not minio_pdf_path.lower().endswith(".pdf"):
        return "minioPdfPath must reference a PDF file"
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


def safe_serialize(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            return value.hex()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (list, tuple, set)):
        return [safe_serialize(item) for item in value]
    if isinstance(value, dict):
        return {str(key): safe_serialize(item) for key, item in value.items()}
    if hasattr(value, "native"):
        try:
            return safe_serialize(value.native)
        except Exception:
            pass
    if hasattr(value, "dump"):
        try:
            dumped = value.dump()
            return dumped.hex() if isinstance(dumped, bytes) else safe_serialize(dumped)
        except Exception:
            pass
    return str(value)


def extract_common_name(name: Any) -> str | None:
    if name is None:
        return None
    try:
        for attr in name:
            if getattr(getattr(attr, "oid", None), "dotted_string", "") == "2.5.4.3":
                return str(attr.value)
    except Exception:
        pass

    try:
        chosen = getattr(name, "human_friendly", None) or getattr(name, "native", None) or str(name)
        return str(chosen) if chosen else None
    except Exception:
        return None


def parse_distinguished_name_text(value: Any) -> dict[str, str]:
    attributes: dict[str, str] = {}
    aliases = {
        "common name": "commonName",
        "cn": "commonName",
        "common_name": "commonName",
        "serial number": "serialNumber",
        "serialnumber": "serialNumber",
        "serial_number": "serialNumber",
        "2.5.4.5": "serialNumber",
        "surname": "surname",
        "sn": "surname",
        "surname_": "surname",
        "given name": "givenName",
        "givenname": "givenName",
        "gn": "givenName",
        "given_name": "givenName",
        "locality": "locality",
        "l": "locality",
        "locality_name": "locality",
        "country": "country",
        "c": "country",
        "country_name": "country",
        "organization": "organization",
        "o": "organization",
        "organization_name": "organization",
        "organizational unit": "organizationalUnit",
        "organizationalunit": "organizationalUnit",
        "ou": "organizationalUnit",
        "organizational_unit_name": "organizationalUnit",
    }

    text = safe_serialize(value)
    if isinstance(text, dict):
        for key, raw_value in text.items():
            normalized_key = aliases.get(str(key).strip().lower())
            clean_value = str(raw_value).strip() if raw_value not in (None, "") else ""
            if normalized_key and clean_value and normalized_key not in attributes:
                attributes[normalized_key] = clean_value
        return attributes

    if text in (None, ""):
        return attributes

    parts = [part.strip() for part in str(text).split(",") if part.strip()]

    for part in parts:
        if ":" in part:
            key, raw_value = part.split(":", 1)
        elif "=" in part:
            key, raw_value = part.split("=", 1)
        else:
            continue
        normalized_key = aliases.get(key.strip().lower())
        clean_value = raw_value.strip()
        if normalized_key and clean_value and normalized_key not in attributes:
            attributes[normalized_key] = clean_value

    return attributes


def extract_name_attributes(name: Any) -> dict[str, Any]:
    attributes: dict[str, Any] = {}
    if name is None:
        return attributes

    try:
        for attr in name:
            oid = getattr(getattr(attr, "oid", None), "dotted_string", None)
            value = safe_serialize(getattr(attr, "value", None))
            if not oid or value in (None, ""):
                continue
            attributes[oid] = value
    except Exception:
        pass

    if not attributes:
        fallback_attributes = parse_distinguished_name_text(name)
        if fallback_attributes.get("commonName"):
            attributes["2.5.4.3"] = fallback_attributes["commonName"]
        if fallback_attributes.get("serialNumber"):
            attributes["2.5.4.5"] = fallback_attributes["serialNumber"]
        if fallback_attributes.get("locality"):
            attributes["2.5.4.7"] = fallback_attributes["locality"]
        if fallback_attributes.get("organization"):
            attributes["2.5.4.10"] = fallback_attributes["organization"]
        if fallback_attributes.get("organizationalUnit"):
            attributes["2.5.4.11"] = fallback_attributes["organizationalUnit"]
        if fallback_attributes.get("country"):
            attributes["2.5.4.6"] = fallback_attributes["country"]
        if fallback_attributes.get("surname"):
            attributes["2.5.4.4"] = fallback_attributes["surname"]
        if fallback_attributes.get("givenName"):
            attributes["2.5.4.42"] = fallback_attributes["givenName"]

    return attributes


def stringify_name(name: Any) -> str | None:
    if name is None:
        return None
    rfc4514 = getattr(name, "rfc4514_string", None)
    if callable(rfc4514):
        try:
            return rfc4514()
        except Exception:
            pass
    human_friendly = getattr(name, "human_friendly", None)
    if human_friendly:
        return str(human_friendly)
    native = getattr(name, "native", None)
    if native is not None:
        return str(native)
    serialized = safe_serialize(name)
    return str(serialized) if serialized is not None else None


def extract_cedula_from_values(*values: Any) -> str | None:
    for value in values:
        if value is None:
            continue
        serialized = safe_serialize(value)
        if isinstance(serialized, dict):
            serialized = " ".join(str(item) for item in serialized.values())
        elif isinstance(serialized, list):
            serialized = " ".join(str(item) for item in serialized)
        text = str(serialized)
        match = CedulaPattern.search(text)
        if match:
            return match.group(0)
    return None


def decode_extension_bytes(raw_value: bytes) -> Any:
    candidates = [raw_value]
    if raw_value and raw_value[0] == 0x04 and len(raw_value) > 2:
        length = raw_value[1]
        if length < len(raw_value):
            candidates.append(raw_value[2:])

    for candidate in candidates:
        try:
            return safe_serialize(asn1_core.Any.load(candidate).native)
        except Exception:
            continue

    try:
        return raw_value.decode("utf-8")
    except Exception:
        return raw_value.hex()


def to_asn1_certificate(certificate: Any) -> asn1_x509.Certificate | None:
    if certificate is None:
        return None
    if isinstance(certificate, asn1_x509.Certificate):
        return certificate
    if hasattr(certificate, "dump"):
        try:
            return asn1_x509.Certificate.load(certificate.dump())
        except Exception:
            pass
    if hasattr(certificate, "public_bytes"):
        try:
            return asn1_x509.Certificate.load(certificate.public_bytes())
        except Exception:
            pass
    return None


def extract_certificate_extensions(certificate: Any) -> dict[str, Any]:
    extensions: dict[str, Any] = {}
    if certificate is None:
        return extensions

    asn1_certificate = to_asn1_certificate(certificate)

    crypto_extensions = getattr(certificate, "extensions", None)
    if crypto_extensions is not None:
        try:
            for extension in crypto_extensions:
                oid = getattr(getattr(extension, "oid", None), "dotted_string", None)
                if not oid:
                    continue
                if oid == "2.5.29.17":
                    extension_value = getattr(extension, "value", None)
                    parsed_san = {}
                    try:
                        for other_name in extension_value.get_values_for_type(crypto_x509.OtherName):
                            parsed_value = decode_extension_bytes(other_name.value)
                            parsed_san[other_name.type_id.dotted_string] = parsed_value
                    except Exception:
                        parsed_san = {}
                    if parsed_san:
                        extensions.update(parsed_san)
                        continue
                extension_value = getattr(extension, "value", None)
                raw_value = getattr(extension_value, "value", None)
                if isinstance(raw_value, bytes):
                    value = decode_extension_bytes(raw_value)
                else:
                    value = safe_serialize(extension_value)
                extensions[oid] = value
        except Exception:
            pass

    if asn1_certificate is not None:
        try:
            tbs_certificate = asn1_certificate["tbs_certificate"]
            for extension in tbs_certificate["extensions"]:
                oid = safe_serialize(extension["extn_id"].dotted)
                if not oid or oid in extensions:
                    continue
                extn_value = extension["extn_value"]
                raw_value = extn_value.contents if hasattr(extn_value, "contents") else extn_value.dump()
                value = decode_extension_bytes(raw_value)
                extensions[oid] = value
        except Exception:
            pass

    return extensions


def normalize_security_data_attributes(extensions: dict[str, Any]) -> dict[str, Any]:
    normalized = {}
    for oid_map in PERSON_ATTRIBUTE_OID_MAPS:
        for oid, key in oid_map.items():
            value = extensions.get(oid)
            if value not in (None, "") and key not in normalized:
                normalized[key] = value
    return normalized


def parse_pdf_datetime(raw_value: Any) -> str | None:
    if raw_value in (None, ""):
        return None
    raw_text = safe_serialize(raw_value)
    if raw_text is None:
        return None
    text = str(raw_text).strip()
    if not text:
        return None

    if text.startswith("D:"):
        text = text[2:]

    date_part = re.match(r"^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?", text)
    if not date_part:
        return str(raw_text)

    year, month, day, hour, minute, second = date_part.groups()
    try:
        dt = datetime(
            int(year),
            int(month or "1"),
            int(day or "1"),
            int(hour or "0"),
            int(minute or "0"),
            int(second or "0"),
        )
    except ValueError:
        return str(raw_text)

    remainder = text[date_part.end():]
    tz_match = re.match(r"^([Zz]|[+\-]\d{2}'?\d{2}'?)", remainder)
    if tz_match:
        tz_token = tz_match.group(1).replace("'", "")
        if tz_token.upper() == "Z":
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            sign = 1 if tz_token[0] == "+" else -1
            hours = int(tz_token[1:3] or "0")
            minutes = int(tz_token[3:5] or "0")
            dt = dt.replace(tzinfo=timezone(sign * timedelta(hours=hours, minutes=minutes)))

    return dt.isoformat()


def serialize_pdf_entry(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "native"):
        try:
            return safe_serialize(value.native)
        except Exception:
            pass
    return safe_serialize(value)


def get_pdf_dictionary_value(pdf_dict: Any, key: str) -> Any:
    if pdf_dict is None:
        return None
    for candidate in (key, f"/{key}"):
        try:
            if hasattr(pdf_dict, "get"):
                value = pdf_dict.get(candidate)
                if value is not None:
                    return value
        except Exception:
            continue
    return None


def get_signature_dictionary(embedded_signature: Any) -> Any:
    for attr in ("sig_object", "sig_dict", "sig_field"):
        value = getattr(embedded_signature, attr, None)
        if value is not None:
            return value
    return None


def get_status_attr(status: Any, *names: str) -> Any:
    for name in names:
        if hasattr(status, name):
            try:
                return getattr(status, name)
            except Exception:
                continue
    return None


def get_signing_certificate(status: Any, embedded_signature: Any) -> Any:
    for candidate in (
        get_status_attr(status, "signing_cert", "signer_cert", "signer_certificate"),
        getattr(embedded_signature, "signer_cert", None),
        getattr(embedded_signature, "signing_cert", None),
    ):
        if candidate is not None:
            return candidate
    return None


def normalize_certificate_info(certificate: Any) -> dict[str, Any]:
    if certificate is None:
        return {
            "subject": None,
            "issuer": None,
            "serial_number": None,
            "common_name": None,
            "not_valid_before": None,
            "not_valid_after": None,
            "subject_attributes": {},
            "issuer_attributes": {},
        }

    subject = getattr(certificate, "subject", None)
    issuer = getattr(certificate, "issuer", None)
    subject_attributes = extract_name_attributes(subject)
    issuer_attributes = extract_name_attributes(issuer)
    serial_number = getattr(certificate, "serial_number", None)
    if isinstance(serial_number, int):
        serial_number = format(serial_number, "x")

    not_valid_before = (
        getattr(certificate, "not_valid_before_utc", None)
        or getattr(certificate, "not_valid_before", None)
    )
    not_valid_after = (
        getattr(certificate, "not_valid_after_utc", None)
        or getattr(certificate, "not_valid_after", None)
    )

    return {
        "subject": stringify_name(subject),
        "issuer": stringify_name(issuer),
        "serial_number": safe_serialize(serial_number),
        "common_name": extract_common_name(subject),
        "not_valid_before": safe_serialize(not_valid_before),
        "not_valid_after": safe_serialize(not_valid_after),
        "subject_attributes": subject_attributes,
        "issuer_attributes": issuer_attributes,
    }


def build_revocation_status(status: Any) -> tuple[str | None, bool | None]:
    revoked_value = get_status_attr(status, "revoked")
    if revoked_value is True:
        return "Revocado", True
    if revoked_value is False:
        return "No revocado", False
    revocation_ok = get_status_attr(status, "revocation_ok")
    if revocation_ok is True:
        return "No revocado", False
    if revocation_ok is False:
        return "Posible revocacion", None
    return None, None


def summarize_validation_error(error: Exception) -> str:
    return str(error).strip() or error.__class__.__name__


def build_validation_context() -> ValidationContext | None:
    trust_roots, extra_trust_roots = load_trust_material()
    if (
        not trust_roots
        and not extra_trust_roots
        and not SIGNER_EMBED_VALIDATION_INFO
        and not PYHANKO_TSA_URL
        and not PYHANKO_DEFAULT_TSA_URL
    ):
        return None
    return ValidationContext(
        allow_fetching=True,
        trust_roots=trust_roots or None,
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


def normalize_signature_entry(index: int, embedded_signature: Any, validation_context: ValidationContext | None) -> dict[str, Any]:
    sig_dict = get_signature_dictionary(embedded_signature)
    field_name = getattr(embedded_signature, "field_name", None)
    signature_type = serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "Type"))
    sub_filter = serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "SubFilter"))
    is_document_timestamp = signature_type == "/DocTimeStamp" or sub_filter == "/ETSI.RFC3161"
    status = None
    validation_error = None

    if not is_document_timestamp:
        try:
            status = validate_pdf_signature(
                embedded_signature,
                signer_validation_context=validation_context,
            )
        except Exception as error:
            validation_error = error

    certificate = get_signing_certificate(status, embedded_signature)
    certificate_info = normalize_certificate_info(certificate)
    certificate_extensions = extract_certificate_extensions(certificate)
    security_data_attributes = normalize_security_data_attributes(certificate_extensions)
    subject_attributes = certificate_info.get("subject_attributes", {})
    issuer_attributes = certificate_info.get("issuer_attributes", {})
    issuer_name = getattr(certificate, "issuer", None) if certificate is not None else None
    generic_subject_name = (
        subject_attributes.get("2.5.4.3")
        or subject_attributes.get("commonName")
        or certificate_info.get("common_name")
    )
    resolved_full_name = " ".join(
        part
        for part in [
            security_data_attributes.get("first_names"),
            security_data_attributes.get("last_name"),
            security_data_attributes.get("second_last_name"),
        ]
        if part
    ).strip()
    signer_name = (
        resolved_full_name
        or generic_subject_name
        or serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "Name"))
    )
    signer_cedula = extract_cedula_from_values(
        security_data_attributes.get("cedula"),
        security_data_attributes.get("document_number"),
        subject_attributes.get("2.5.4.5"),
        subject_attributes.get("serialNumber"),
        subject_attributes.get("2.5.4.3"),
        signer_name,
        certificate_info.get("subject"),
    )
    reason = serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "Reason"))
    location = serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "Location"))
    signing_time = (
        parse_pdf_datetime(get_pdf_dictionary_value(sig_dict, "M"))
        or safe_serialize(get_status_attr(status, "signing_time", "claimed_signing_time"))
    )

    timestamp_validity = get_status_attr(status, "timestamp_validity")
    timestamp_time = (
        safe_serialize(get_status_attr(timestamp_validity, "timestamp", "gen_time"))
        or safe_serialize(get_status_attr(status, "timestamp", "timestamp_time"))
    )
    revocation_status, revoked = build_revocation_status(status)
    valid = bool(get_status_attr(status, "bottom_line")) if status is not None else False
    intact = get_status_attr(status, "intact")
    trusted = get_status_attr(status, "trusted")
    pretty_details = None
    if status is not None:
        try:
            pretty_details = status.pretty_print_details()
        except Exception:
            pretty_details = None

    extras = {
        "validationDetails": pretty_details,
        "validationError": summarize_validation_error(validation_error) if validation_error else None,
        "subFilter": sub_filter,
        "byteRange": serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "ByteRange")),
        "name": serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "Name")),
        "contactInfo": serialize_pdf_entry(get_pdf_dictionary_value(sig_dict, "ContactInfo")),
        "subject": certificate_info.get("subject"),
        "issuer": certificate_info.get("issuer"),
        "serialNumber": certificate_info.get("serial_number"),
        "subjectAttributes": subject_attributes,
        "issuerAttributes": issuer_attributes,
        "certificateExtensions": certificate_extensions,
        "securityDataAttributes": security_data_attributes,
        "timestamp": {
            "available": timestamp_validity is not None or timestamp_time is not None,
            "valid": get_status_attr(timestamp_validity, "bottom_line", "valid"),
            "trusted": get_status_attr(timestamp_validity, "trusted"),
            "intact": get_status_attr(timestamp_validity, "intact"),
            "details": safe_serialize(timestamp_validity),
        },
        "rawPdfDictionary": {},
    }

    if sig_dict is not None and hasattr(sig_dict, "keys"):
        for key in sig_dict.keys():
            key_label = str(key)
            value = get_pdf_dictionary_value(sig_dict, key_label.lstrip("/"))
            if key_label == "/Contents":
                serialized_value = serialize_pdf_entry(value)
                extras["rawPdfDictionary"][key_label] = {
                    "type": "cms_signature_container",
                    "length": len(serialized_value) if isinstance(serialized_value, str) else None,
                }
                continue
            extras["rawPdfDictionary"][key_label] = serialize_pdf_entry(value)

    return {
        "index": index,
        "fieldName": field_name,
        "entryType": "timestamp" if is_document_timestamp else "signature",
        "valid": valid,
        "intact": bool(intact) if intact is not None else None,
        "trusted": bool(trusted) if trusted is not None else None,
        "revoked": revoked,
        "firstNames": security_data_attributes.get("first_names"),
        "lastName": security_data_attributes.get("last_name"),
        "secondLastName": security_data_attributes.get("second_last_name"),
        "signerName": signer_name,
        "signerCedula": signer_cedula,
        "reason": reason,
        "location": location,
        "signingTime": signing_time,
        "timestampTime": timestamp_time,
        "certificateAuthority": extract_common_name(issuer_name) or certificate_info.get("issuer"),
        "certificateIssuedAt": certificate_info.get("not_valid_before"),
        "certificateExpiresAt": certificate_info.get("not_valid_after"),
        "revocationStatus": revocation_status,
        "extras": extras,
    }


def build_validation_summary(all_entries: list[dict[str, Any]], requested_cedula: str | None) -> dict[str, Any]:
    signer_entries = [signature for signature in all_entries if signature.get("entryType") != "timestamp"]
    timestamp_entries = [signature for signature in all_entries if signature.get("entryType") == "timestamp"]
    valid_signature_count = sum(1 for signature in signer_entries if signature.get("valid") is True)
    matching_signatures = [signature for signature in signer_entries if signature.get("matchesCedula") is True]
    warnings = []
    if not all_entries:
        warnings.append("El documento no contiene firmas embebidas.")
    if requested_cedula and not matching_signatures:
        warnings.append("No se encontraron firmas que coincidan con la cédula consultada.")

    return {
        "hasSignatures": bool(signer_entries),
        "signatureCount": len(signer_entries),
        "totalEntries": len(all_entries),
        "timestampCount": len(timestamp_entries),
        "validSignatureCount": valid_signature_count,
        "matchingCedulaCount": len(matching_signatures),
        "warnings": warnings,
    }


def attach_timestamp_entries(signatures: list[dict[str, Any]], timestamps: list[dict[str, Any]]) -> None:
    signature_index = 0
    for timestamp in timestamps:
        while signature_index < len(signatures) and signatures[signature_index].get("timestampFieldName"):
            signature_index += 1
        if signature_index >= len(signatures):
            break
        signatures[signature_index]["timestampFieldName"] = timestamp.get("fieldName")
        signatures[signature_index]["timestampStatus"] = "Sí"
        signatures[signature_index]["timestampEntry"] = {
            "fieldName": timestamp.get("fieldName"),
            "entryType": timestamp.get("entryType"),
        }
        signature_index += 1

    for signature in signatures:
        if not signature.get("timestampStatus"):
            signature["timestampStatus"] = "No"


def process_validation_job(data: dict[str, Any]) -> dict[str, Any]:
    validation_error = validate_validation_payload(data)
    if validation_error:
        return {"status": "error", "message": validation_error}

    job_id = str(uuid4())
    requested_cedula = str(data.get("cedula") or "").strip() or None
    workspace_root = Path(SIGNER_WORKSPACE_DIR)
    workspace_root.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix=f"{job_id}-", dir=workspace_root) as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        source_pdf = temp_dir / "input.pdf"

        try:
            logger.info("[%s] Descargando PDF para validacion %s", job_id, data["minioPdfPath"])
            download_from_minio(data.get("minioBucket"), data["minioPdfPath"], source_pdf)

            with source_pdf.open("rb") as input_stream:
                reader = PdfFileReader(input_stream)
                validation_context = build_validation_context()
                all_entries = [
                    normalize_signature_entry(index + 1, embedded_signature, validation_context)
                    for index, embedded_signature in enumerate(reader.embedded_signatures or [])
                ]

            signatures = [entry for entry in all_entries if entry.get("entryType") != "timestamp"]
            timestamps = [entry for entry in all_entries if entry.get("entryType") == "timestamp"]
            attach_timestamp_entries(signatures, timestamps)

            for signature in signatures:
                signature["matchesCedula"] = bool(
                    requested_cedula and signature.get("signerCedula") == requested_cedula
                )

            summary = build_validation_summary(all_entries, requested_cedula)

            return {
                "status": "success",
                "message": "Documento validado correctamente.",
                "jobId": job_id,
                "document": {
                    "sourcePath": data["minioPdfPath"],
                    "hasSignatures": summary["hasSignatures"],
                },
                "summary": summary,
                "signatures": signatures,
                "timestamps": timestamps,
                "matchByCedula": {
                    "requestedCedula": requested_cedula,
                    "found": bool(summary["matchingCedulaCount"]),
                    "matches": [
                        {
                            "index": signature.get("index"),
                            "fieldName": signature.get("fieldName"),
                            "signerName": signature.get("signerName"),
                            "signerCedula": signature.get("signerCedula"),
                        }
                        for signature in signatures
                        if signature.get("matchesCedula") is True
                    ],
                },
                "warnings": summary["warnings"],
            }
        except Exception as exc:
            logger.exception("[%s] Error validando documento", job_id)
            return {
                "status": "error",
                "message": str(exc),
                "jobId": job_id,
            }


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
        operations = {
            "/sign": process_job,
            "/validate": process_validation_job,
        }
        operation = operations.get(self.path)
        if operation is None:
            self._send_json(404, {"status": "error", "message": "Not found. Use POST /sign or POST /validate"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._send_json(400, {"status": "error", "message": "Invalid JSON body"})
            return

        result = operation(payload)
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
            channel.queue_declare(queue=VALIDATE_REQUEST_QUEUE, durable=True)
            channel.basic_qos(prefetch_count=1)
            logger.info("RabbitMQ conectado en %s", RABBITMQ_URL)
            logger.info("Escuchando solicitudes en %s", SIGN_REQUEST_QUEUE)
            logger.info("Escuchando validaciones en %s", VALIDATE_REQUEST_QUEUE)

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

                if method.routing_key == VALIDATE_REQUEST_QUEUE:
                    result = process_validation_job(payload)
                else:
                    result = process_job(payload)
                result["correlationId"] = payload.get("correlationId")
                publish_response(ch, response_queue, result)
                ch.basic_ack(delivery_tag=method.delivery_tag)

            channel.basic_consume(queue=SIGN_REQUEST_QUEUE, on_message_callback=on_message)
            channel.basic_consume(queue=VALIDATE_REQUEST_QUEUE, on_message_callback=on_message)
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
