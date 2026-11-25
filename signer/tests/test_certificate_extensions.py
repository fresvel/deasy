"""Las dos fuentes que leen extensiones de un certificado, con certificados REALES.

`extract_certificate_extensions` no tiene un recorrido, tiene dos: la API de
`cryptography` y el TBS crudo por `asn1crypto`. Estaban entrelazadas en una sola
función de 51 líneas y anidamiento 6, y de las dos sólo la primera estaba
probada — con dobles, además.

Aquí los certificados se generan de verdad (autofirmados, curva elíptica para
que sea rápido, como en `test_certificate_loading.py`), porque el reparto de
trabajo entre las dos fuentes **depende del tipo de objeto que llegue**, y eso
un doble no lo reproduce:

- un certificado de `cryptography` expone `.extensions` pero NO se deja convertir
  a ASN.1 (su `public_bytes()` exige el argumento `encoding`), así que sólo corre
  la primera fuente;
- un certificado de `asn1crypto` —el que entrega pyHanko en producción— no expone
  `.extensions`, así que sólo corre la segunda.

De ahí que la asimetría de la clase `AsimetriaEntreLasDosFuentes` importe: no es
un detalle, es lo que de verdad pasa cuando se valida un PDF firmado.
"""

import unittest
from datetime import datetime, timedelta, timezone

from asn1crypto import x509 as asn1_x509
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

import app


CLAVE = ec.generate_private_key(ec.SECP256R1())

# La cédula tal y como viaja dentro de una extensión: un PrintableString DER.
CEDULA = "1234567890"
CEDULA_DER = b"\x13\x0a" + CEDULA.encode()

# El OID de la cédula de cada autoridad certificadora ecuatoriana.
OID_CEDULA_POR_AC = {
    "Security Data": "1.3.6.1.4.1.37746.3.1",
    "iCert": "1.3.6.1.4.1.43745.1.3.1",
    "FirmaSegura": "1.3.6.1.4.1.61305.3.1",
}


def certificado(extensiones=(), san=None):
    """Un certificado autofirmado con las extensiones que se le pidan."""
    ahora = datetime.now(timezone.utc)
    nombre = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "ANA PEREZ"),
        x509.NameAttribute(NameOID.SERIAL_NUMBER, CEDULA),
    ])
    constructor = (
        x509.CertificateBuilder()
        .subject_name(nombre)
        .issuer_name(nombre)
        .public_key(CLAVE.public_key())
        .serial_number(0x2A)
        .not_valid_before(ahora - timedelta(days=1))
        .not_valid_after(ahora + timedelta(days=365))
    )
    for oid, valor in extensiones:
        constructor = constructor.add_extension(
            x509.UnrecognizedExtension(x509.ObjectIdentifier(oid), valor), False
        )
    if san is not None:
        constructor = constructor.add_extension(x509.SubjectAlternativeName(san), False)
    return constructor.sign(CLAVE, hashes.SHA256())


def como_asn1(cert):
    """El mismo certificado tal y como lo entrega pyHanko: un objeto de asn1crypto."""
    return asn1_x509.Certificate.load(cert.public_bytes(serialization.Encoding.DER))


class CedulaDeCadaAutoridadCertificadora(unittest.TestCase):
    """Un caso por AC ecuatoriana y por fuente: seis caminos hasta la cédula."""

    def test_por_la_fuente_de_cryptography(self):
        for autoridad, oid in OID_CEDULA_POR_AC.items():
            with self.subTest(autoridad=autoridad):
                cert = certificado([(oid, CEDULA_DER)])
                extensiones = app.extract_certificate_extensions(cert)
                self.assertEqual(extensiones[oid], CEDULA)
                self.assertEqual(
                    app.normalize_security_data_attributes(extensiones),
                    {"cedula": CEDULA},
                )

    def test_por_la_fuente_de_asn1crypto(self):
        for autoridad, oid in OID_CEDULA_POR_AC.items():
            with self.subTest(autoridad=autoridad):
                cert = como_asn1(certificado([(oid, CEDULA_DER)]))
                extensiones = app.extract_certificate_extensions(cert)
                self.assertEqual(extensiones[oid], CEDULA)
                self.assertEqual(
                    app.normalize_security_data_attributes(extensiones),
                    {"cedula": CEDULA},
                )

    def test_las_dos_fuentes_leen_lo_mismo_del_mismo_certificado(self):
        cert = certificado([
            (OID_CEDULA_POR_AC["Security Data"], CEDULA_DER),
            ("1.3.6.1.4.1.37746.3.2", b"\x0c\x09ANA MARIA"),
            ("1.3.6.1.4.1.37746.3.3", b"\x0c\x05PEREZ"),
        ])
        esperado = {"cedula": CEDULA, "first_names": "ANA MARIA", "last_name": "PEREZ"}
        for etiqueta, objeto in (("cryptography", cert), ("asn1crypto", como_asn1(cert))):
            with self.subTest(fuente=etiqueta):
                extensiones = app.extract_certificate_extensions(objeto)
                self.assertEqual(app.normalize_security_data_attributes(extensiones), esperado)


class CedulaDentroDelSubjectAltName(unittest.TestCase):
    """La rama especial: algunas ACs no crean extensión propia, meten los datos de
    la persona en un `OtherName` del subjectAltName."""

    def test_el_othername_aporta_su_oid_en_lugar_del_oid_del_san(self):
        oid = OID_CEDULA_POR_AC["iCert"]
        cert = certificado(san=[x509.OtherName(x509.ObjectIdentifier(oid), CEDULA_DER)])
        extensiones = app.extract_certificate_extensions(cert)
        self.assertEqual(extensiones[oid], CEDULA)
        # El OID del propio SAN no llega a guardarse: lo sustituyen sus OtherName.
        self.assertNotIn(app.OID_SUBJECT_ALT_NAME, extensiones)
        self.assertEqual(app.normalize_security_data_attributes(extensiones), {"cedula": CEDULA})

    def test_varios_othername_en_una_sola_extension(self):
        cert = certificado(san=[
            x509.OtherName(x509.ObjectIdentifier("1.3.6.1.4.1.37746.3.1"), CEDULA_DER),
            x509.OtherName(x509.ObjectIdentifier("1.3.6.1.4.1.37746.3.3"), b"\x0c\x05PEREZ"),
        ])
        self.assertEqual(
            app.normalize_security_data_attributes(app.extract_certificate_extensions(cert)),
            {"cedula": CEDULA, "last_name": "PEREZ"},
        )

    def test_un_san_sin_othername_se_guarda_como_una_extension_cualquiera(self):
        cert = certificado(san=[x509.DNSName("ejemplo.ec")])
        extensiones = app.extract_certificate_extensions(cert)
        self.assertIn(app.OID_SUBJECT_ALT_NAME, extensiones)

    def test_un_san_ilegible_no_aporta_othernames(self):
        self.assertEqual(app._othernames_del_san(None), {})
        self.assertEqual(app._othernames_del_san(object()), {})

    def test_si_el_san_no_se_deja_leer_la_extension_se_guarda_entera(self):
        # El lote se descarta completo y la extensión cae al camino genérico, en
        # lugar de perderse.
        class ExtensionRota:
            def get_values_for_type(self, _tipo):
                raise RuntimeError("no se deja leer")

        class Extension:
            oid = type("Oid", (), {"dotted_string": app.OID_SUBJECT_ALT_NAME})()
            value = ExtensionRota()

        class Certificado:
            extensions = [Extension()]

        self.assertIn(app.OID_SUBJECT_ALT_NAME, app.extract_certificate_extensions(Certificado()))


class AsimetriaEntreLasDosFuentes(unittest.TestCase):
    """Qué fuente corre con qué objeto, y quién gana cuando corren las dos.

    Congela un boquete real: por la segunda fuente la cédula que viaja dentro de
    un `OtherName` del SAN **no se desenvuelve** (sale el SAN entero en
    hexadecimal), y ésa es justo la fuente que corre en producción. No es una
    regresión de este refactor —era así antes— pero conviene que esté escrito.
    """

    def test_un_certificado_de_cryptography_no_se_convierte_a_asn1(self):
        # `public_bytes()` exige `encoding`, así que la segunda fuente no corre.
        self.assertIsNone(app.to_asn1_certificate(certificado()))

    def test_un_certificado_de_asn1crypto_no_expone_extensions(self):
        # ...y por eso no corre la primera.
        self.assertIsNone(getattr(como_asn1(certificado()), "extensions", None))

    def test_boquete_la_segunda_fuente_no_desenvuelve_el_othername_del_san(self):
        oid = OID_CEDULA_POR_AC["iCert"]
        cert = como_asn1(certificado(san=[
            x509.OtherName(x509.ObjectIdentifier(oid), CEDULA_DER),
        ]))
        extensiones = app.extract_certificate_extensions(cert)
        self.assertNotIn(oid, extensiones)
        self.assertIn(app.OID_SUBJECT_ALT_NAME, extensiones)
        self.assertEqual(app.normalize_security_data_attributes(extensiones), {})

    def test_la_segunda_fuente_no_pisa_lo_que_aporto_la_primera(self):
        cert = como_asn1(certificado([(OID_CEDULA_POR_AC["Security Data"], CEDULA_DER)]))
        extensiones = {OID_CEDULA_POR_AC["Security Data"]: "ya estaba"}
        app._leer_con_asn1(cert, extensiones)
        self.assertEqual(extensiones[OID_CEDULA_POR_AC["Security Data"]], "ya estaba")

    def test_cada_fuente_por_separado_sobre_el_objeto_que_no_le_toca_no_hace_nada(self):
        vacio = {}
        app._leer_con_asn1(certificado(), vacio)
        self.assertEqual(vacio, {})
        app._leer_con_cryptography(como_asn1(certificado()), vacio)
        self.assertEqual(vacio, {})

    def test_un_certificado_sin_extensiones_no_aporta_nada(self):
        self.assertEqual(app.extract_certificate_extensions(certificado()), {})
        self.assertEqual(app.extract_certificate_extensions(como_asn1(certificado())), {})


class ValorDeUnaExtension(unittest.TestCase):
    def test_los_bytes_se_decodifican_como_der(self):
        class Valor:
            value = CEDULA_DER

        self.assertEqual(app._valor_de_extension(Valor()), CEDULA)

    def test_si_el_contenido_no_son_bytes_se_serializa_la_extension_ENTERA(self):
        # Sutileza del original que conviene tener escrita: cuando `.value` no son
        # bytes NO se serializa `.value`, se serializa el objeto extensión.
        class Valor:
            value = "ya es texto"
            native = "lo que se serializa es esto"

        self.assertEqual(app._valor_de_extension(Valor()), "lo que se serializa es esto")

    def test_una_extension_sin_valor_no_revienta(self):
        self.assertIsNone(app._valor_de_extension(None))


if __name__ == "__main__":
    unittest.main()
