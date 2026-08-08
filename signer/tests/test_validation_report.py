"""El informe de validación: la forma exacta que consume el frontend.

`frontend/src/modules/firmas/components/FirmarPdf.vue` lee estas claves por
nombre. Cambiar una es romper la vista de validación sin que ningún test de
backend se entere, porque el signer vive detrás de RabbitMQ.
"""

import unittest
from unittest import mock

import app

from tests.dobles import (
    AtributoNombre,
    Certificado,
    DiccionarioPdf,
    EstadoValidacion,
    FirmaEmbebida,
    NombreDistinguido,
)


class ExtensionPlana:
    """Extensión de certificado tal y como la itera `cryptography`."""

    def __init__(self, oid, contenido):
        self.oid = type("Oid", (), {"dotted_string": oid})()
        self.value = type("Valor", (), {"value": contenido})()


def certificado_de_ana():
    sujeto = NombreDistinguido([AtributoNombre("2.5.4.3", "ANA PEREZ")], rfc4514="CN=ANA PEREZ")
    emisor = NombreDistinguido([AtributoNombre("2.5.4.3", "AC SECURITY DATA")], rfc4514="CN=AC SECURITY DATA")
    return Certificado(
        subject=sujeto,
        issuer=emisor,
        serial_number=4886718345,
        extensions=[
            ExtensionPlana("1.3.6.1.4.1.37746.3.1", b"\x13\x0a1234567890"),
            ExtensionPlana("1.3.6.1.4.1.37746.3.2", b"\x0c\x03ANA"),
            ExtensionPlana("1.3.6.1.4.1.37746.3.3", b"\x0c\x05PEREZ"),
        ],
    )


DICCIONARIO_DE_FIRMA = {
    "/Type": "/Sig",
    "/SubFilter": "/ETSI.CAdES.detached",
    "/Name": "ANA PEREZ",
    "/Reason": "Firma electrónica DEASY",
    "/Location": "Ecuador",
    "/M": "D:20240115103000Z",
    "/ByteRange": [0, 100, 200, 300],
    "/ContactInfo": "ana@pucese.edu.ec",
    "/Contents": "aabbccdd",
}


class NormalizacionDeUnaFirma(unittest.TestCase):
    def normalizar(self, estado=None, error=None, diccionario=None, certificado=None):
        firma = FirmaEmbebida(
            field_name="sig_1",
            sig_object=DiccionarioPdf(diccionario if diccionario is not None else DICCIONARIO_DE_FIRMA),
            signer_cert=certificado if certificado is not None else certificado_de_ana(),
        )
        if error is not None:
            doble = mock.Mock(side_effect=error)
        else:
            doble = mock.Mock(return_value=estado)
        with mock.patch.object(app, "validate_pdf_signature", doble):
            return app.normalize_signature_entry(1, firma, None)

    def test_firma_valida_completa(self):
        entrada = self.normalizar(EstadoValidacion(
            bottom_line=True, intact=True, trusted=True, revoked=False,
        ))
        self.assertEqual(entrada["index"], 1)
        self.assertEqual(entrada["fieldName"], "sig_1")
        self.assertEqual(entrada["entryType"], "signature")
        self.assertTrue(entrada["valid"])
        self.assertTrue(entrada["intact"])
        self.assertTrue(entrada["trusted"])
        self.assertIs(entrada["revoked"], False)
        self.assertEqual(entrada["revocationStatus"], "No revocado")
        self.assertEqual(entrada["reason"], "Firma electrónica DEASY")
        self.assertEqual(entrada["location"], "Ecuador")
        self.assertEqual(entrada["signingTime"], "2024-01-15T10:30:00+00:00")
        self.assertEqual(entrada["certificateAuthority"], "AC SECURITY DATA")

    def test_el_nombre_se_arma_con_los_atributos_de_la_autoridad_certificadora(self):
        # Nombres + primer apellido + segundo apellido, no el CN del sujeto.
        entrada = self.normalizar(EstadoValidacion(bottom_line=True))
        self.assertEqual(entrada["firstNames"], "ANA")
        self.assertEqual(entrada["lastName"], "PEREZ")
        self.assertIsNone(entrada["secondLastName"])
        self.assertEqual(entrada["signerName"], "ANA PEREZ")

    def test_sin_atributos_de_persona_cae_al_common_name(self):
        certificado = Certificado(
            subject=NombreDistinguido([AtributoNombre("2.5.4.3", "SOLO CN")], rfc4514="CN=SOLO CN"),
            issuer=NombreDistinguido([], rfc4514="CN=AC"),
            extensions=[],
        )
        entrada = self.normalizar(EstadoValidacion(bottom_line=True), certificado=certificado)
        self.assertEqual(entrada["signerName"], "SOLO CN")

    def test_la_cedula_sale_de_las_extensiones(self):
        entrada = self.normalizar(EstadoValidacion(bottom_line=True))
        self.assertEqual(entrada["signerCedula"], "1234567890")

    def test_la_cedula_tambien_se_rescata_del_serialnumber_del_sujeto(self):
        certificado = Certificado(
            subject=NombreDistinguido(
                [AtributoNombre("2.5.4.3", "ANA"), AtributoNombre("2.5.4.5", "0987654321")],
                rfc4514="CN=ANA",
            ),
            issuer=NombreDistinguido([], rfc4514="CN=AC"),
            extensions=[],
        )
        entrada = self.normalizar(EstadoValidacion(bottom_line=True), certificado=certificado)
        self.assertEqual(entrada["signerCedula"], "0987654321")

    def test_un_doctimestamp_no_se_valida_como_firma(self):
        diccionario = dict(DICCIONARIO_DE_FIRMA, **{"/Type": "/DocTimeStamp"})
        doble = mock.Mock()
        firma = FirmaEmbebida(field_name="ts_1", sig_object=DiccionarioPdf(diccionario))
        with mock.patch.object(app, "validate_pdf_signature", doble):
            entrada = app.normalize_signature_entry(2, firma, None)
        doble.assert_not_called()
        self.assertEqual(entrada["entryType"], "timestamp")
        self.assertFalse(entrada["valid"])

    def test_el_subfilter_rfc3161_tambien_marca_sello_de_tiempo(self):
        diccionario = dict(DICCIONARIO_DE_FIRMA, **{"/SubFilter": "/ETSI.RFC3161"})
        firma = FirmaEmbebida(field_name="ts_2", sig_object=DiccionarioPdf(diccionario))
        with mock.patch.object(app, "validate_pdf_signature", mock.Mock()) as doble:
            entrada = app.normalize_signature_entry(3, firma, None)
        doble.assert_not_called()
        self.assertEqual(entrada["entryType"], "timestamp")

    def test_un_fallo_de_validacion_no_tumba_la_entrada(self):
        entrada = self.normalizar(error=RuntimeError("cadena rota"))
        self.assertFalse(entrada["valid"])
        self.assertIsNone(entrada["intact"])
        self.assertEqual(entrada["extras"]["validationError"], "cadena rota")
        # Los metadatos del PDF siguen presentes aunque la criptografía falle.
        self.assertEqual(entrada["signerName"], "ANA PEREZ")

    def test_el_contenido_cms_no_se_vuelca_entero(self):
        # /Contents es la firma binaria: se resume por longitud, nunca se copia.
        entrada = self.normalizar(EstadoValidacion(bottom_line=True))
        self.assertEqual(
            entrada["extras"]["rawPdfDictionary"]["/Contents"],
            {"type": "cms_signature_container", "length": 8},
        )

    def test_el_resto_del_diccionario_se_vuelca_en_extras(self):
        entrada = self.normalizar(EstadoValidacion(bottom_line=True))
        crudo = entrada["extras"]["rawPdfDictionary"]
        self.assertEqual(crudo["/Reason"], "Firma electrónica DEASY")
        self.assertEqual(crudo["/ByteRange"], [0, 100, 200, 300])

    def test_sin_certificado_las_claves_siguen_existiendo(self):
        firma = FirmaEmbebida(field_name="sig_1", sig_object=DiccionarioPdf(DICCIONARIO_DE_FIRMA))
        with mock.patch.object(app, "validate_pdf_signature",
                               mock.Mock(return_value=EstadoValidacion(bottom_line=False))):
            entrada = app.normalize_signature_entry(1, firma, None)
        self.assertIsNone(entrada["certificateIssuedAt"])
        self.assertIsNone(entrada["certificateExpiresAt"])
        self.assertEqual(entrada["extras"]["subjectAttributes"], {})


class ResumenDeValidacion(unittest.TestCase):
    def test_documento_sin_firmas(self):
        resumen = app.build_validation_summary([], None)
        self.assertFalse(resumen["hasSignatures"])
        self.assertEqual(resumen["signatureCount"], 0)
        self.assertEqual(resumen["warnings"], ["El documento no contiene firmas embebidas."])

    def test_separa_firmas_de_sellos_de_tiempo(self):
        entradas = [
            {"entryType": "signature", "valid": True},
            {"entryType": "signature", "valid": False},
            {"entryType": "timestamp"},
        ]
        resumen = app.build_validation_summary(entradas, None)
        self.assertEqual(resumen["signatureCount"], 2)
        self.assertEqual(resumen["timestampCount"], 1)
        self.assertEqual(resumen["totalEntries"], 3)
        self.assertEqual(resumen["validSignatureCount"], 1)
        self.assertEqual(resumen["warnings"], [])

    def test_avisa_si_se_pidio_una_cedula_y_no_aparece(self):
        entradas = [{"entryType": "signature", "valid": True, "matchesCedula": False}]
        resumen = app.build_validation_summary(entradas, "1234567890")
        self.assertEqual(resumen["matchingCedulaCount"], 0)
        self.assertEqual(
            resumen["warnings"],
            ["No se encontraron firmas que coincidan con la cédula consultada."],
        )

    def test_cuenta_las_coincidencias_de_cedula(self):
        entradas = [
            {"entryType": "signature", "valid": True, "matchesCedula": True},
            {"entryType": "signature", "valid": True, "matchesCedula": False},
        ]
        resumen = app.build_validation_summary(entradas, "1234567890")
        self.assertEqual(resumen["matchingCedulaCount"], 1)
        self.assertEqual(resumen["warnings"], [])

    def test_solo_valid_estrictamente_true_cuenta_como_valida(self):
        entradas = [{"entryType": "signature", "valid": 1}, {"entryType": "signature", "valid": True}]
        self.assertEqual(app.build_validation_summary(entradas, None)["validSignatureCount"], 1)


class EmparejadoDeSellosDeTiempo(unittest.TestCase):
    def test_empareja_uno_a_uno_en_orden(self):
        firmas = [{"fieldName": "sig_a"}, {"fieldName": "sig_b"}]
        sellos = [{"fieldName": "ts_a", "entryType": "timestamp"},
                  {"fieldName": "ts_b", "entryType": "timestamp"}]
        app.attach_timestamp_entries(firmas, sellos)
        self.assertEqual(firmas[0]["timestampFieldName"], "ts_a")
        self.assertEqual(firmas[1]["timestampFieldName"], "ts_b")
        self.assertEqual([f["timestampStatus"] for f in firmas], ["Sí", "Sí"])

    def test_las_firmas_sin_sello_quedan_marcadas_con_no(self):
        firmas = [{"fieldName": "sig_a"}, {"fieldName": "sig_b"}]
        app.attach_timestamp_entries(firmas, [{"fieldName": "ts_a", "entryType": "timestamp"}])
        self.assertEqual(firmas[0]["timestampStatus"], "Sí")
        self.assertEqual(firmas[1]["timestampStatus"], "No")
        self.assertNotIn("timestampFieldName", firmas[1])

    def test_sobran_sellos_y_no_revienta(self):
        firmas = [{"fieldName": "sig_a"}]
        sellos = [{"fieldName": "ts_a", "entryType": "timestamp"},
                  {"fieldName": "ts_b", "entryType": "timestamp"}]
        app.attach_timestamp_entries(firmas, sellos)
        self.assertEqual(firmas[0]["timestampFieldName"], "ts_a")

    def test_documento_sin_firmas(self):
        firmas = []
        app.attach_timestamp_entries(firmas, [{"fieldName": "ts_a"}])
        self.assertEqual(firmas, [])

    def test_no_pisa_un_sello_ya_asignado(self):
        firmas = [{"fieldName": "sig_a", "timestampFieldName": "ya_tenia"}, {"fieldName": "sig_b"}]
        app.attach_timestamp_entries(firmas, [{"fieldName": "ts_nuevo", "entryType": "timestamp"}])
        self.assertEqual(firmas[0]["timestampFieldName"], "ya_tenia")
        self.assertEqual(firmas[1]["timestampFieldName"], "ts_nuevo")


if __name__ == "__main__":
    unittest.main()
