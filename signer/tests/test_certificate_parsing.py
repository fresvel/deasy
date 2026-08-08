"""Lectura de identidad desde certificados: DN, extensiones y cédula.

Es la parte del servicio que decide QUIÉN firmó. No genera criptografía, pero
sí produce el `signerCedula` con el que el backend cruza firmas contra
personas, así que un cambio silencioso aquí sí es un incidente.

Todas las pruebas usan dobles (`tests/dobles.py`): ni un certificado real, ni
disco, ni red.
"""

import unittest
from datetime import datetime, timezone

import app

from tests.dobles import (
    AtributoNombre,
    Certificado,
    NombreDistinguido,
    NombreNoIterable,
    ValorNativo,
    ValorVolcable,
)


class SerializacionSegura(unittest.TestCase):
    def test_escalares_pasan_intactos(self):
        for valor in (None, "texto", 3, 3.5, True):
            with self.subTest(valor=valor):
                self.assertEqual(app.safe_serialize(valor), valor)

    def test_bytes_utf8_se_decodifican(self):
        self.assertEqual(app.safe_serialize(b"hola"), "hola")

    def test_bytes_no_decodificables_caen_a_hexadecimal(self):
        self.assertEqual(app.safe_serialize(b"\xff\xfe"), "fffe")

    def test_fechas_a_iso8601(self):
        momento = datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)
        self.assertEqual(app.safe_serialize(momento), "2024-01-15T10:30:00+00:00")

    def test_secuencias_se_normalizan_a_lista(self):
        self.assertEqual(app.safe_serialize((1, b"a", None)), [1, "a", None])

    def test_diccionarios_normalizan_las_claves_a_texto(self):
        self.assertEqual(app.safe_serialize({1: b"a"}), {"1": "a"})

    def test_objetos_con_native_se_desenvuelven(self):
        self.assertEqual(app.safe_serialize(ValorNativo({"a": b"b"})), {"a": "b"})

    def test_objetos_con_dump_binario_van_a_hexadecimal(self):
        self.assertEqual(app.safe_serialize(ValorVolcable(b"\x01\x02")), "0102")

    def test_ultimo_recurso_es_el_str(self):
        class Opaco:
            def __str__(self):
                return "opaco"

        self.assertEqual(app.safe_serialize(Opaco()), "opaco")


class ParseoDeDistinguishedName(unittest.TestCase):
    def test_desde_diccionario_con_alias(self):
        self.assertEqual(
            app.parse_distinguished_name_text({"common name": " Ana ", "sn": "Perez", "zzz": "x"}),
            {"commonName": "Ana", "surname": "Perez"},
        )

    def test_desde_texto_rfc4514(self):
        self.assertEqual(
            app.parse_distinguished_name_text("CN=Ana Perez,SERIALNUMBER=1234567890,O=PUCESE"),
            {"commonName": "Ana Perez", "serialNumber": "1234567890", "organization": "PUCESE"},
        )

    def test_desde_texto_con_dos_puntos(self):
        self.assertEqual(
            app.parse_distinguished_name_text("common name: Ana, serial number: 0987654321"),
            {"commonName": "Ana", "serialNumber": "0987654321"},
        )

    def test_gana_la_primera_aparicion(self):
        self.assertEqual(
            app.parse_distinguished_name_text("CN=Primera,CN=Segunda"),
            {"commonName": "Primera"},
        )

    def test_partes_sin_separador_se_ignoran(self):
        self.assertEqual(app.parse_distinguished_name_text("solo texto,CN=Ana"), {"commonName": "Ana"})

    def test_entrada_vacia(self):
        self.assertEqual(app.parse_distinguished_name_text(None), {})
        self.assertEqual(app.parse_distinguished_name_text(""), {})


class ExtraccionDeAtributosDeNombre(unittest.TestCase):
    def test_camino_normal_indexa_por_oid(self):
        nombre = NombreDistinguido([
            AtributoNombre("2.5.4.3", "Ana Perez"),
            AtributoNombre("2.5.4.5", "1234567890"),
        ])
        self.assertEqual(
            app.extract_name_attributes(nombre),
            {"2.5.4.3": "Ana Perez", "2.5.4.5": "1234567890"},
        )

    def test_atributos_sin_oid_o_sin_valor_se_descartan(self):
        nombre = NombreDistinguido([
            AtributoNombre(None, "sin oid"),
            AtributoNombre("2.5.4.3", ""),
            AtributoNombre("2.5.4.6", "EC"),
        ])
        self.assertEqual(app.extract_name_attributes(nombre), {"2.5.4.6": "EC"})

    def test_si_no_sale_nada_se_reparsea_el_texto_a_oids(self):
        nombre = NombreNoIterable("CN=Ana,SERIALNUMBER=1234567890,O=PUCESE,C=EC")
        self.assertEqual(
            app.extract_name_attributes(nombre),
            {
                "2.5.4.3": "Ana",
                "2.5.4.5": "1234567890",
                "2.5.4.10": "PUCESE",
                "2.5.4.6": "EC",
            },
        )

    def test_nombre_nulo(self):
        self.assertEqual(app.extract_name_attributes(None), {})


class ExtraccionDeCommonName(unittest.TestCase):
    def test_prefiere_el_oid_2_5_4_3(self):
        nombre = NombreDistinguido([
            AtributoNombre("2.5.4.10", "PUCESE"),
            AtributoNombre("2.5.4.3", "Ana Perez"),
        ])
        self.assertEqual(app.extract_common_name(nombre), "Ana Perez")

    def test_sin_common_name_cae_al_human_friendly(self):
        nombre = NombreDistinguido([AtributoNombre("2.5.4.10", "PUCESE")], human_friendly="Legible")
        self.assertEqual(app.extract_common_name(nombre), "Legible")

    def test_nombre_nulo(self):
        self.assertIsNone(app.extract_common_name(None))

    def test_boquete_conocido_una_cadena_se_devuelve_entera(self):
        # Una cadena es iterable: recorre caracteres, no encuentra OID y acaba
        # devolviendo el DN completo como si fuera el CN.
        self.assertEqual(app.extract_common_name("CN=Ana,O=X"), "CN=Ana,O=X")


class RepresentacionTextualDeNombres(unittest.TestCase):
    def test_prefiere_rfc4514(self):
        nombre = NombreDistinguido([], rfc4514="CN=Ana", human_friendly="Legible")
        self.assertEqual(app.stringify_name(nombre), "CN=Ana")

    def test_si_rfc4514_falla_usa_human_friendly(self):
        nombre = NombreDistinguido([], human_friendly="Legible")
        self.assertEqual(app.stringify_name(nombre), "Legible")

    def test_si_no_hay_nada_usa_native(self):
        nombre = NombreDistinguido([], native={"cn": "Ana"})
        self.assertEqual(app.stringify_name(nombre), "{'cn': 'Ana'}")

    def test_nombre_nulo(self):
        self.assertIsNone(app.stringify_name(None))


class ExtraccionDeCedula(unittest.TestCase):
    def test_encuentra_diez_digitos_dentro_de_texto(self):
        self.assertEqual(app.extract_cedula_from_values("id 1234567890 fin"), "1234567890")

    def test_gana_el_primer_valor_que_case(self):
        self.assertEqual(
            app.extract_cedula_from_values(None, "sin numero", "0987654321", "1234567890"),
            "0987654321",
        )

    def test_acepta_ruc_de_trece_digitos(self):
        self.assertEqual(app.extract_cedula_from_values("1234567890001"), "1234567890001")

    def test_aplana_diccionarios_y_listas(self):
        self.assertEqual(app.extract_cedula_from_values({"a": "1234567890"}), "1234567890")
        self.assertEqual(app.extract_cedula_from_values(["x", "1234567890"]), "1234567890")

    def test_no_confunde_un_numero_demasiado_largo(self):
        self.assertIsNone(app.extract_cedula_from_values("12345678901234"))

    def test_sin_candidatos(self):
        self.assertIsNone(app.extract_cedula_from_values(None, "", "abc"))


class DecodificacionDeExtensiones(unittest.TestCase):
    def test_printable_string_der(self):
        self.assertEqual(app.decode_extension_bytes(b"\x13\x0a1234567890"), "1234567890")

    def test_utf8_string_der(self):
        self.assertEqual(app.decode_extension_bytes(b"\x0c\x05Pedro"), "Pedro")

    def test_texto_plano_sin_der_valido(self):
        self.assertEqual(app.decode_extension_bytes(b"hola"), "hola")

    def test_binario_indescifrable_va_a_hexadecimal(self):
        self.assertEqual(app.decode_extension_bytes(b"\xff\xfe\xfd"), "fffefd")

    def test_desenvuelve_el_octet_string_y_la_cedula_sale_limpia(self):
        # R-3, corregido. Antes el candidato desenvuelto iba DETRAS del valor crudo, y como el
        # crudo tambien parsea como OctetString el bucle retornaba en la primera vuelta: la
        # cedula salia con la cabecera del tipo interno pegada delante y solo la rescataba
        # despues `extract_cedula_from_values` con una regex. Ahora sale limpia de origen.
        self.assertEqual(
            app.decode_extension_bytes(b"\x04\x0c\x13\x0a1234567890"),
            "1234567890",
        )
        # La regex de aguas abajo sigue siendo idempotente sobre el valor ya limpio.
        self.assertEqual(app.extract_cedula_from_values("1234567890"), "1234567890")


class NormalizacionDeAtributosDePersona(unittest.TestCase):
    def test_mapea_los_oids_de_security_data(self):
        extensiones = {
            "1.3.6.1.4.1.37746.3.1": "1234567890",
            "1.3.6.1.4.1.37746.3.2": "ANA MARIA",
            "1.3.6.1.4.1.37746.3.3": "PEREZ",
        }
        self.assertEqual(
            app.normalize_security_data_attributes(extensiones),
            {"cedula": "1234567890", "first_names": "ANA MARIA", "last_name": "PEREZ"},
        )

    def test_mapea_los_oids_de_icert(self):
        self.assertEqual(
            app.normalize_security_data_attributes({"1.3.6.1.4.1.43745.1.3.1": "1234567890"}),
            {"cedula": "1234567890"},
        )

    def test_mapea_los_oids_de_firmasegura(self):
        self.assertEqual(
            app.normalize_security_data_attributes({"1.3.6.1.4.1.61305.3.1": "1234567890"}),
            {"cedula": "1234567890"},
        )

    def test_el_orden_de_las_autoridades_decide_el_empate(self):
        # Security Data se consulta antes que iCert y que FirmaSegura.
        extensiones = {
            "1.3.6.1.4.1.37746.3.1": "PRIMERA",
            "1.3.6.1.4.1.43745.1.3.1": "SEGUNDA",
            "1.3.6.1.4.1.61305.3.1": "TERCERA",
        }
        self.assertEqual(app.normalize_security_data_attributes(extensiones)["cedula"], "PRIMERA")

    def test_valores_vacios_no_ocupan_la_clave(self):
        extensiones = {"1.3.6.1.4.1.37746.3.1": "", "1.3.6.1.4.1.43745.1.3.1": "1234567890"}
        self.assertEqual(app.normalize_security_data_attributes(extensiones), {"cedula": "1234567890"})

    def test_sin_extensiones(self):
        self.assertEqual(app.normalize_security_data_attributes({}), {})


class NormalizacionDeInformacionDeCertificado(unittest.TestCase):
    def test_certificado_nulo_devuelve_la_forma_vacia_completa(self):
        # El backend y el frontend leen estas claves siempre: si desaparecen,
        # la vista de validación se rompe en silencio.
        self.assertEqual(
            app.normalize_certificate_info(None),
            {
                "subject": None,
                "issuer": None,
                "serial_number": None,
                "common_name": None,
                "not_valid_before": None,
                "not_valid_after": None,
                "subject_attributes": {},
                "issuer_attributes": {},
            },
        )

    def test_certificado_completo(self):
        sujeto = NombreDistinguido([AtributoNombre("2.5.4.3", "Ana Perez")], rfc4514="CN=Ana Perez")
        emisor = NombreDistinguido([AtributoNombre("2.5.4.3", "AC PUCESE")], rfc4514="CN=AC PUCESE")
        certificado = Certificado(
            subject=sujeto,
            issuer=emisor,
            serial_number=255,
            not_valid_before=datetime(2024, 1, 1, tzinfo=timezone.utc),
            not_valid_after=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        info = app.normalize_certificate_info(certificado)
        self.assertEqual(info["subject"], "CN=Ana Perez")
        self.assertEqual(info["issuer"], "CN=AC PUCESE")
        self.assertEqual(info["serial_number"], "ff")
        self.assertEqual(info["common_name"], "Ana Perez")
        self.assertEqual(info["not_valid_before"], "2024-01-01T00:00:00+00:00")
        self.assertEqual(info["not_valid_after"], "2026-01-01T00:00:00+00:00")
        self.assertEqual(info["subject_attributes"], {"2.5.4.3": "Ana Perez"})
        self.assertEqual(info["issuer_attributes"], {"2.5.4.3": "AC PUCESE"})


class ExtraccionDeExtensionesDelCertificado(unittest.TestCase):
    def test_certificado_nulo(self):
        self.assertEqual(app.extract_certificate_extensions(None), {})

    def test_extensiones_de_cryptography_indexadas_por_oid(self):
        class ValorExtension:
            def __init__(self, contenido):
                self.value = contenido

        class Extension:
            def __init__(self, oid, contenido):
                self.oid = type("Oid", (), {"dotted_string": oid})()
                self.value = ValorExtension(contenido)

        certificado = Certificado(extensions=[
            Extension("1.3.6.1.4.1.37746.3.1", b"\x13\x0a1234567890"),
            Extension("1.3.6.1.4.1.37746.3.2", b"\x0c\x03ANA"),
        ])
        self.assertEqual(
            app.extract_certificate_extensions(certificado),
            {"1.3.6.1.4.1.37746.3.1": "1234567890", "1.3.6.1.4.1.37746.3.2": "ANA"},
        )

    def test_extensiones_sin_oid_se_saltan(self):
        class Extension:
            oid = None
            value = None

        self.assertEqual(app.extract_certificate_extensions(Certificado(extensions=[Extension()])), {})


class ConversionAsn1(unittest.TestCase):
    def test_objeto_no_convertible_devuelve_none(self):
        self.assertIsNone(app.to_asn1_certificate(object()))

    def test_certificado_nulo(self):
        self.assertIsNone(app.to_asn1_certificate(None))

    def test_dump_ilegible_no_revienta(self):
        self.assertIsNone(app.to_asn1_certificate(ValorVolcable(b"no soy un certificado")))


if __name__ == "__main__":
    unittest.main()
