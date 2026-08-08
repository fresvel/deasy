"""Carga del PKCS#12 del firmante y guards de vigencia del certificado.

Es el único punto del servicio donde se rechaza firmar. Las pruebas generan
certificados de verdad (autofirmados, curva elíptica para que sea rápido) en
memoria: no hay ningún .p12 de fixture en el repositorio, precisamente para no
meter claves privadas en git.
"""

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

import app


CLAVE = ec.generate_private_key(ec.SECP256R1())
CONTRASENA = "clave-de-prueba"


def certificado(nombre_comun="ANA PEREZ", desde_dias=-1, hasta_dias=365, serie=0x2A):
    ahora = datetime.now(timezone.utc)
    sujeto = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, nombre_comun),
        x509.NameAttribute(NameOID.SERIAL_NUMBER, "1234567890"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "PUCESE"),
    ])
    return (
        x509.CertificateBuilder()
        .subject_name(sujeto)
        .issuer_name(sujeto)
        .public_key(CLAVE.public_key())
        .serial_number(serie)
        .not_valid_before(ahora + timedelta(days=desde_dias))
        .not_valid_after(ahora + timedelta(days=hasta_dias))
        .sign(CLAVE, hashes.SHA256())
    )


def escribir_p12(carpeta: Path, cert, con_clave=True, cadena=None) -> Path:
    datos = pkcs12.serialize_key_and_certificates(
        name=b"prueba",
        key=CLAVE if con_clave else None,
        cert=cert,
        cas=cadena,
        encryption_algorithm=serialization.BestAvailableEncryption(CONTRASENA.encode()),
    )
    ruta = carpeta / "cert.p12"
    ruta.write_bytes(datos)
    return ruta


class CargaDelCertificadoDelFirmante(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(self.carpeta.cleanup)
        self.raiz = Path(self.carpeta.name)

    def test_certificado_vigente_devuelve_la_ficha_completa(self):
        ruta = escribir_p12(self.raiz, certificado())
        info = app.load_certificate_info(ruta, CONTRASENA)
        self.assertEqual(info["common_name"], "ANA PEREZ")
        self.assertEqual(info["serial_number"], "2a")
        self.assertIn("CN=ANA PEREZ", info["subject"])
        self.assertIn("CN=ANA PEREZ", info["issuer"])
        self.assertEqual(info["chain_length"], 0)
        # Fechas normalizadas a ISO-8601, que es lo que viaja al backend.
        datetime.fromisoformat(info["not_valid_before"])
        datetime.fromisoformat(info["not_valid_after"])

    def test_la_cadena_intermedia_se_cuenta(self):
        ruta = escribir_p12(self.raiz, certificado(), cadena=[certificado("AC INTERMEDIA", serie=7)])
        self.assertEqual(app.load_certificate_info(ruta, CONTRASENA)["chain_length"], 1)

    def test_certificado_expirado_se_rechaza(self):
        ruta = escribir_p12(self.raiz, certificado(desde_dias=-400, hasta_dias=-30))
        with self.assertRaises(ValueError) as contexto:
            app.load_certificate_info(ruta, CONTRASENA)
        self.assertEqual(str(contexto.exception), "El certificado está expirado.")

    def test_certificado_aun_no_vigente_se_rechaza(self):
        ruta = escribir_p12(self.raiz, certificado(desde_dias=10, hasta_dias=400))
        with self.assertRaises(ValueError) as contexto:
            app.load_certificate_info(ruta, CONTRASENA)
        self.assertEqual(str(contexto.exception), "El certificado todavía no es válido.")

    def test_pkcs12_sin_clave_privada_se_rechaza(self):
        ruta = escribir_p12(self.raiz, certificado(), con_clave=False)
        with self.assertRaises(ValueError) as contexto:
            app.load_certificate_info(ruta, CONTRASENA)
        self.assertIn("no contiene clave privada", str(contexto.exception))

    def test_contrasena_incorrecta_revienta(self):
        ruta = escribir_p12(self.raiz, certificado())
        with self.assertRaises(Exception):
            app.load_certificate_info(ruta, "contraseña equivocada")


class CargaDeCertificadosDeConfianza(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(self.carpeta.cleanup)
        self.raiz = Path(self.carpeta.name)

    def test_lee_un_pem(self):
        ruta = self.raiz / "ac.pem"
        ruta.write_bytes(certificado("AC RAIZ").public_bytes(serialization.Encoding.PEM))
        self.assertIsNotNone(app.load_certificate_file(ruta))

    def test_lee_un_der_por_el_camino_de_respaldo(self):
        ruta = self.raiz / "ac.der"
        ruta.write_bytes(certificado("AC RAIZ").public_bytes(serialization.Encoding.DER))
        self.assertIsNotNone(app.load_certificate_file(ruta))

    def test_un_fichero_que_no_es_certificado_revienta(self):
        ruta = self.raiz / "basura.pem"
        ruta.write_bytes(b"esto no es un certificado")
        with self.assertRaises(Exception):
            app.load_certificate_file(ruta)


if __name__ == "__main__":
    unittest.main()
