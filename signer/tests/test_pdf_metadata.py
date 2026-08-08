"""Lectura de metadatos del diccionario /Sig del PDF y del estado de pyHanko.

Son accesos defensivos: pyHanko cambia nombres de atributo entre versiones y
`app.py` los busca por varios alias. Estas pruebas fijan qué alias se prueban
y en qué orden, que es justo lo que se rompería en una actualización de la
librería sin que nadie se entere.
"""

import unittest

import app

from tests.dobles import DiccionarioPdf, EstadoValidacion, FirmaEmbebida


class ParseoDeFechasPdf(unittest.TestCase):
    def test_formato_completo_con_zona_horaria(self):
        self.assertEqual(app.parse_pdf_datetime("D:20240115103000-05'00'"), "2024-01-15T10:30:00-05:00")

    def test_zona_horaria_zulu(self):
        self.assertEqual(app.parse_pdf_datetime("D:20240115103000Z"), "2024-01-15T10:30:00+00:00")

    def test_desplazamiento_positivo(self):
        self.assertEqual(app.parse_pdf_datetime("D:20240115103000+02'30'"), "2024-01-15T10:30:00+02:30")

    def test_sin_prefijo_d(self):
        self.assertEqual(app.parse_pdf_datetime("20240115103000Z"), "2024-01-15T10:30:00+00:00")

    def test_fecha_truncada_se_completa_con_minimos(self):
        self.assertEqual(app.parse_pdf_datetime("20240115"), "2024-01-15T00:00:00")
        self.assertEqual(app.parse_pdf_datetime("2024"), "2024-01-01T00:00:00")

    def test_sin_zona_horaria_queda_ingenua(self):
        self.assertEqual(app.parse_pdf_datetime("D:20240115103000"), "2024-01-15T10:30:00")

    def test_valores_vacios(self):
        self.assertIsNone(app.parse_pdf_datetime(None))
        self.assertIsNone(app.parse_pdf_datetime(""))
        self.assertIsNone(app.parse_pdf_datetime("   "))

    def test_texto_no_reconocible_se_devuelve_tal_cual(self):
        self.assertEqual(app.parse_pdf_datetime("basura"), "basura")

    def test_fecha_imposible_se_devuelve_tal_cual(self):
        self.assertEqual(app.parse_pdf_datetime("D:99999999999999"), "D:99999999999999")


class AccesoAlDiccionarioPdf(unittest.TestCase):
    def test_busca_la_clave_con_y_sin_barra(self):
        diccionario = DiccionarioPdf({"/Reason": "motivo", "Location": "Ecuador"})
        self.assertEqual(app.get_pdf_dictionary_value(diccionario, "Reason"), "motivo")
        self.assertEqual(app.get_pdf_dictionary_value(diccionario, "Location"), "Ecuador")

    def test_clave_inexistente(self):
        self.assertIsNone(app.get_pdf_dictionary_value(DiccionarioPdf({}), "Reason"))

    def test_diccionario_nulo(self):
        self.assertIsNone(app.get_pdf_dictionary_value(None, "Reason"))

    def test_objeto_sin_get(self):
        self.assertIsNone(app.get_pdf_dictionary_value(object(), "Reason"))


class LocalizacionDelDiccionarioDeFirma(unittest.TestCase):
    def test_prefiere_sig_object(self):
        firma = FirmaEmbebida(sig_object="el bueno")
        firma.sig_dict = "el otro"
        self.assertEqual(app.get_signature_dictionary(firma), "el bueno")

    def test_cae_a_sig_dict(self):
        firma = FirmaEmbebida()
        firma.sig_dict = "el otro"
        self.assertEqual(app.get_signature_dictionary(firma), "el otro")

    def test_sin_ninguno_devuelve_none(self):
        self.assertIsNone(app.get_signature_dictionary(FirmaEmbebida()))


class LecturaDefensivaDeAtributos(unittest.TestCase):
    def test_devuelve_el_primer_alias_presente(self):
        estado = EstadoValidacion(signer_cert="segundo")
        self.assertEqual(app.get_status_attr(estado, "signing_cert", "signer_cert"), "segundo")

    def test_sin_ningun_alias(self):
        self.assertIsNone(app.get_status_attr(EstadoValidacion(), "no_existe"))

    def test_objeto_nulo(self):
        self.assertIsNone(app.get_status_attr(None, "lo_que_sea"))

    def test_certificado_del_firmante_prefiere_el_estado(self):
        estado = EstadoValidacion(signing_cert="del estado")
        firma = FirmaEmbebida(signer_cert="de la firma")
        self.assertEqual(app.get_signing_certificate(estado, firma), "del estado")

    def test_certificado_del_firmante_cae_a_la_firma_embebida(self):
        firma = FirmaEmbebida(signer_cert="de la firma")
        self.assertEqual(app.get_signing_certificate(EstadoValidacion(), firma), "de la firma")

    def test_sin_certificado_por_ningun_lado(self):
        self.assertIsNone(app.get_signing_certificate(EstadoValidacion(), FirmaEmbebida()))


class EstadoDeRevocacion(unittest.TestCase):
    def test_revocado_explicito(self):
        self.assertEqual(app.build_revocation_status(EstadoValidacion(revoked=True)), ("Revocado", True))

    def test_no_revocado_explicito(self):
        self.assertEqual(app.build_revocation_status(EstadoValidacion(revoked=False)), ("No revocado", False))

    def test_revoked_manda_sobre_revocation_ok(self):
        estado = EstadoValidacion(revoked=True, revocation_ok=True)
        self.assertEqual(app.build_revocation_status(estado), ("Revocado", True))

    def test_revocation_ok_verdadero(self):
        self.assertEqual(
            app.build_revocation_status(EstadoValidacion(revocation_ok=True)),
            ("No revocado", False),
        )

    def test_revocation_ok_falso_es_sospecha_no_certeza(self):
        self.assertEqual(
            app.build_revocation_status(EstadoValidacion(revocation_ok=False)),
            ("Posible revocacion", None),
        )

    def test_sin_informacion(self):
        self.assertEqual(app.build_revocation_status(None), (None, None))


class ResumenDeErrorDeValidacion(unittest.TestCase):
    def test_usa_el_mensaje_de_la_excepcion(self):
        self.assertEqual(app.summarize_validation_error(ValueError("  roto  ")), "roto")

    def test_sin_mensaje_usa_el_nombre_de_la_clase(self):
        self.assertEqual(app.summarize_validation_error(ValueError()), "ValueError")


class SerializacionDeEntradasPdf(unittest.TestCase):
    def test_valor_nulo(self):
        self.assertIsNone(app.serialize_pdf_entry(None))

    def test_valor_con_native(self):
        class Envuelto:
            native = b"contenido"

        self.assertEqual(app.serialize_pdf_entry(Envuelto()), "contenido")

    def test_valor_plano(self):
        self.assertEqual(app.serialize_pdf_entry("/DocTimeStamp"), "/DocTimeStamp")


if __name__ == "__main__":
    unittest.main()
