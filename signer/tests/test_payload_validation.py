"""Validación de payloads y decisiones de política previas a la firma.

Todo lo que se prueba aquí es puro: no toca disco, ni red, ni PDF.
Es el primer guardián de un servicio que firma documentos legales, así que el
orden de los guards y los mensajes de error forman parte del contrato con el
backend (`backend/services/infrastructure/rabbit_signer.js` propaga
`message` tal cual al usuario).
"""

import unittest
from unittest import mock

import app


PAYLOAD_COORDENADAS = {
    "signType": "coordinates",
    "minioPdfPath": "spool/doc.pdf",
    "stampText": "Firmado por X",
    "finalPath": "final/doc.pdf",
    "minioCertPath": "certs/x.p12",
    "certPassword": "secreto",
    "coordinates": {"page": 1, "x": 100, "y": 200},
}

PAYLOAD_TOKEN = {
    "signType": "token",
    "minioPdfPath": "spool/doc.pdf",
    "stampText": "Firmado por X",
    "finalPath": "final/doc.pdf",
    "minioCertPath": "certs/x.p12",
    "certPassword": "secreto",
    "token": "{{firma_1}}",
}


class ValidarPayloadDeFirma(unittest.TestCase):
    def test_payload_de_coordenadas_valido_no_devuelve_error(self):
        self.assertIsNone(app.validate_payload(dict(PAYLOAD_COORDENADAS)))

    def test_payload_de_token_valido_no_devuelve_error(self):
        self.assertIsNone(app.validate_payload(dict(PAYLOAD_TOKEN)))

    def test_falta_un_campo_obligatorio(self):
        for campo in ("signType", "minioPdfPath", "stampText", "finalPath",
                      "minioCertPath", "certPassword"):
            with self.subTest(campo=campo):
                payload = dict(PAYLOAD_COORDENADAS)
                del payload[campo]
                self.assertEqual(
                    app.validate_payload(payload),
                    f"Missing required field: {campo}",
                )

    def test_cadena_vacia_cuenta_como_campo_ausente(self):
        payload = dict(PAYLOAD_COORDENADAS, stampText="")
        self.assertEqual(app.validate_payload(payload), "Missing required field: stampText")

    def test_el_orden_de_los_campos_obligatorios_fija_que_error_sale_primero(self):
        # Faltan dos: gana el que aparece antes en la lista `required`.
        payload = dict(PAYLOAD_COORDENADAS)
        del payload["minioPdfPath"]
        del payload["certPassword"]
        self.assertEqual(app.validate_payload(payload), "Missing required field: minioPdfPath")

    def test_sign_type_desconocido(self):
        payload = dict(PAYLOAD_COORDENADAS, signType="qr")
        self.assertEqual(
            app.validate_payload(payload),
            "Invalid signType: must be 'coordinates' or 'token'",
        )

    def test_coordenadas_incompletas(self):
        for coordenadas in ({}, {"page": 1}, {"page": 1, "x": 2}, {"page": 1, "x": 2, "y": None}):
            with self.subTest(coordenadas=coordenadas):
                payload = dict(PAYLOAD_COORDENADAS, coordinates=coordenadas)
                self.assertEqual(
                    app.validate_payload(payload),
                    "signType 'coordinates' requires coordinates: { page, x, y }",
                )

    def test_coordenadas_como_texto_se_rechazan(self):
        payload = dict(PAYLOAD_COORDENADAS, coordinates={"page": "1", "x": 2, "y": 3})
        self.assertEqual(
            app.validate_payload(payload),
            "signType 'coordinates' requires coordinates: { page, x, y }",
        )

    def test_coordenadas_flotantes_se_aceptan(self):
        payload = dict(PAYLOAD_COORDENADAS, coordinates={"page": 1.0, "x": 2.5, "y": 3.5})
        self.assertIsNone(app.validate_payload(payload))

    def test_token_debe_ser_texto(self):
        payload = dict(PAYLOAD_TOKEN, token=123)
        self.assertEqual(app.validate_payload(payload), "signType 'token' requires a token string")

    def test_boquete_conocido_los_booleanos_pasan_como_coordenadas(self):
        # `isinstance(True, int)` es cierto en Python: el guard deja pasar
        # booleanos donde espera números. Queda documentado, no "arreglado":
        # cambiarlo sería reescribir comportamiento, no mover código.
        payload = dict(PAYLOAD_COORDENADAS, coordinates={"page": True, "x": True, "y": True})
        self.assertIsNone(app.validate_payload(payload))

    def test_boquete_conocido_el_cero_no_cuenta_como_campo_vacio(self):
        # El guard compara con `""` y con `None`, no por falsedad.
        payload = dict(PAYLOAD_COORDENADAS, stampText=0)
        self.assertIsNone(app.validate_payload(payload))


class ValidarPayloadDeValidacion(unittest.TestCase):
    def test_ruta_valida(self):
        self.assertIsNone(app.validate_validation_payload({"minioPdfPath": "spool/a.pdf"}))

    def test_extension_en_mayusculas_se_acepta(self):
        self.assertIsNone(app.validate_validation_payload({"minioPdfPath": "spool/a.PDF"}))

    def test_ruta_ausente(self):
        for payload in ({}, {"minioPdfPath": None}, {"minioPdfPath": "   "}):
            with self.subTest(payload=payload):
                self.assertEqual(
                    app.validate_validation_payload(payload),
                    "Missing required field: minioPdfPath",
                )

    def test_ruta_que_no_es_pdf(self):
        self.assertEqual(
            app.validate_validation_payload({"minioPdfPath": "spool/a.docx"}),
            "minioPdfPath must reference a PDF file",
        )


class ConversionABooleano(unittest.TestCase):
    def test_booleanos_se_devuelven_tal_cual(self):
        self.assertIs(app.as_bool(True), True)
        self.assertIs(app.as_bool(False), False)

    def test_numeros(self):
        self.assertIs(app.as_bool(1), True)
        self.assertIs(app.as_bool(0), False)
        self.assertIs(app.as_bool(0.0), False)
        self.assertIs(app.as_bool(-1), True)

    def test_textos_afirmativos(self):
        for texto in ("1", "true", "TRUE", " yes ", "On"):
            with self.subTest(texto=texto):
                self.assertIs(app.as_bool(texto), True)

    def test_textos_negativos(self):
        for texto in ("0", "false", "no", "", "sí", "2"):
            with self.subTest(texto=texto):
                self.assertIs(app.as_bool(texto), False)

    def test_cualquier_otro_tipo_es_falso(self):
        self.assertIs(app.as_bool(None), False)
        self.assertIs(app.as_bool([1]), False)
        self.assertIs(app.as_bool({"a": 1}), False)


class ResolucionDeTsa(unittest.TestCase):
    """Precedencia: payload > variable de entorno > TSA por defecto > sin sello."""

    def setUp(self):
        self.env_tsa = mock.patch.object(app, "PYHANKO_TSA_URL", "")
        self.env_default = mock.patch.object(app, "PYHANKO_DEFAULT_TSA_URL", "https://por-defecto/tsr")
        self.env_tsa.start()
        self.env_default.start()
        self.addCleanup(self.env_tsa.stop)
        self.addCleanup(self.env_default.stop)

    def test_el_payload_manda_sobre_todo(self):
        with mock.patch.object(app, "PYHANKO_TSA_URL", "https://entorno/tsr"):
            self.assertEqual(
                app.resolve_tsa_url({"tsaUrl": " https://payload/tsr ", "use_timestamp": True}),
                "https://payload/tsr",
            )

    def test_la_variable_de_entorno_gana_al_flag(self):
        with mock.patch.object(app, "PYHANKO_TSA_URL", "https://entorno/tsr"):
            self.assertEqual(app.resolve_tsa_url({"use_timestamp": False}), "https://entorno/tsr")

    def test_el_flag_use_timestamp_activa_la_tsa_por_defecto(self):
        self.assertEqual(app.resolve_tsa_url({"use_timestamp": True}), "https://por-defecto/tsr")

    def test_el_alias_use_default_tsa_tambien_la_activa(self):
        self.assertEqual(app.resolve_tsa_url({"useDefaultTsa": "1"}), "https://por-defecto/tsr")

    def test_sin_nada_no_hay_sello_de_tiempo(self):
        self.assertEqual(app.resolve_tsa_url({}), "")


class PoliticaDeAvisosDeValidacion(unittest.TestCase):
    def test_ambos_alias_valen(self):
        self.assertTrue(app.is_validation_warning_allowed({"allow_untrusted_signer": True}))
        self.assertTrue(app.is_validation_warning_allowed({"allowValidationWarning": "yes"}))

    def test_por_defecto_no_se_toleran_avisos(self):
        self.assertFalse(app.is_validation_warning_allowed({}))
        self.assertFalse(app.is_validation_warning_allowed({"allow_untrusted_signer": "no"}))


class ResolucionDeCoordenadas(unittest.TestCase):
    def test_modo_coordenadas_trunca_a_entero(self):
        datos = {"signType": "coordinates", "coordinates": {"page": 2.9, "x": 10.7, "y": 20.2}}
        self.assertEqual(
            app.resolve_coordinates(datos, "/no/importa.pdf"),
            {"page": 2, "x": 10, "y": 20},
        )

    def test_modo_coordenadas_devuelve_lista_de_uno(self):
        datos = {"signType": "coordinates", "coordinates": {"page": 1, "x": 5, "y": 6}}
        self.assertEqual(
            app.resolve_coordinate_list(datos, "/no/importa.pdf"),
            [{"page": 1, "x": 5, "y": 6}],
        )

    def test_modo_token_delega_en_el_buscador_de_marcas(self):
        with mock.patch.object(app, "find_marker_coordinates",
                               return_value={"page": 3, "x": 1, "y": 2}) as buscar:
            resultado = app.resolve_coordinates({"signType": "token", "token": "{{f}}"}, "/tmp/a.pdf")
        self.assertEqual(resultado, {"page": 3, "x": 1, "y": 2})
        buscar.assert_called_once_with("/tmp/a.pdf", "{{f}}")

    def test_modo_token_sin_marca_es_error_no_firma_silenciosa(self):
        with mock.patch.object(app, "find_marker_coordinates", return_value=None):
            with self.assertRaises(ValueError) as contexto:
                app.resolve_coordinates({"signType": "token", "token": "{{f}}"}, "/tmp/a.pdf")
        self.assertIn("{{f}}", str(contexto.exception))

    def test_modo_token_devuelve_todas_las_marcas(self):
        marcas = [{"page": 1, "x": 1, "y": 1}, {"page": 2, "x": 2, "y": 2}]
        with mock.patch.object(app, "find_all_marker_coordinates", return_value=marcas):
            self.assertEqual(
                app.resolve_coordinate_list({"signType": "token", "token": "{{f}}"}, "/tmp/a.pdf"),
                marcas,
            )

    def test_modo_token_sin_ninguna_marca_es_error_en_la_lista(self):
        with mock.patch.object(app, "find_all_marker_coordinates", return_value=[]):
            with self.assertRaises(ValueError):
                app.resolve_coordinate_list({"signType": "token", "token": "{{f}}"}, "/tmp/a.pdf")


if __name__ == "__main__":
    unittest.main()
