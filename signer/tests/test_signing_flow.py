"""Colocación del sello, política PAdES y contrato de respuesta de los jobs.

Aquí NO se firma de verdad: pyHanko está sustituido por dobles. Lo que se fija
es la parte que `app.py` decide por su cuenta y que, si cambia sin querer,
mueve el sello de sitio o rebaja el nivel de firma sin que nadie lo note:

* la caja del sello (`box`) y el desplazamiento extra del modo token,
* los interruptores `embed_validation_info` y `use_pades_lta`,
* el encadenado de firmas múltiples (cada firma parte del PDF anterior),
* las claves exactas de la respuesta que consume el backend.
"""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

import app


class ColocacionDelSelloYPoliticaPades(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(self.carpeta.cleanup)
        raiz = Path(self.carpeta.name)
        self.rutas = app.JobPaths(
            source_pdf=raiz / "input.pdf",
            cleaned_pdf=raiz / "cleaned.pdf",
            signed_pdf=raiz / "signed.pdf",
            cert_file=raiz / "cert.p12",
        )
        self.rutas.cleaned_pdf.write_bytes(b"%PDF-1.4 falso")
        self.rutas.cert_file.write_bytes(b"p12 falso")

        self.metadatos = mock.patch.object(app, "PdfSignatureMetadata").start()
        self.campos = mock.patch.object(app, "fields").start()
        self.firmador = mock.patch.object(app, "PdfSigner").start()
        mock.patch.object(app, "signers").start()
        mock.patch.object(app, "generate_stamp_image").start()
        mock.patch.object(app, "build_stamp_style").start()
        mock.patch.object(app, "PdfFileReader").start()
        mock.patch.object(app, "IncrementalPdfFileWriter").start()
        self.sellador = mock.patch.object(app, "HTTPTimeStamper").start()
        self.contexto = mock.patch.object(app, "build_validation_context").start()
        self.addCleanup(mock.patch.stopall)

        # `sign_pdf` no escribe nada: los ficheros de salida ya existen porque
        # el `with ... open("wb")` los crea.
        self.firmador.return_value.sign_pdf = mock.Mock()

    def firmar(self, datos, marcas):
        # El resolutor de coordenadas ya tiene sus propias pruebas; aquí se fija
        # a la lista dada para aislar la geometría del sello.
        with mock.patch.object(app, "resolve_coordinate_list", return_value=marcas):
            return app.sign_pdf_document(datos, self.rutas, {"common_name": "ANA PEREZ"})

    def datos_base(self, **extra):
        base = {
            "signType": "coordinates",
            "certPassword": "secreto",
            "stampText": "Firmado por ANA",
            "minioPdfPath": "spool/a.pdf",
            "coordinates": {"page": 1, "x": 100, "y": 300},
        }
        base.update(extra)
        return base

    def test_la_caja_del_sello_cuelga_hacia_abajo_del_punto_dado(self):
        resultado = self.firmar(self.datos_base(), [{"page": 1, "x": 100, "y": 300}])
        caja = self.campos.SigFieldSpec.call_args[1]["box"]
        self.assertEqual(caja, (100, 300 - 48, 100 + 124, 300))
        self.assertEqual(resultado["coordinates"], {"page": 1, "x": 100, "y": 300,
                                                    "width": 124, "height": 48})

    def test_el_ancho_y_el_alto_son_configurables_por_payload(self):
        self.firmar(self.datos_base(boxWidth=200, boxHeight=60), [{"page": 1, "x": 10, "y": 100}])
        caja = self.campos.SigFieldSpec.call_args[1]["box"]
        self.assertEqual(caja, (10, 40, 210, 100))

    def test_el_modo_token_sube_el_sello_medio_alto(self):
        datos = self.datos_base(signType="token", token="{{firma}}")
        self.firmar(datos, [{"page": 1, "x": 100, "y": 300}])
        caja = self.campos.SigFieldSpec.call_args[1]["box"]
        # top = 300 + 24; la caja va de top-48 a top.
        self.assertEqual(caja, (100, 276, 224, 324))

    def test_la_pagina_se_convierte_a_indice_base_cero_sin_bajar_de_cero(self):
        self.firmar(self.datos_base(), [{"page": 3, "x": 1, "y": 1}])
        self.assertEqual(self.campos.SigFieldSpec.call_args[1]["on_page"], 2)
        self.firmar(self.datos_base(), [{"page": 0, "x": 1, "y": 1}])
        self.assertEqual(self.campos.SigFieldSpec.call_args[1]["on_page"], 0)

    def test_firma_pades_con_sha256_y_el_nombre_del_certificado(self):
        self.firmar(self.datos_base(), [{"page": 1, "x": 1, "y": 1}])
        opciones = self.metadatos.call_args[1]
        self.assertEqual(opciones["md_algorithm"], "sha256")
        self.assertEqual(opciones["name"], "ANA PEREZ")
        self.assertEqual(opciones["subfilter"], app.SigSeedSubFilter.PADES)

    def test_el_motivo_y_el_lugar_caen_a_los_valores_del_servicio(self):
        self.firmar(self.datos_base(), [{"page": 1, "x": 1, "y": 1}])
        opciones = self.metadatos.call_args[1]
        self.assertEqual(opciones["reason"], app.SIGNER_REASON)
        self.assertEqual(opciones["location"], app.SIGNER_LOCATION)

    def test_el_payload_puede_sobreescribir_motivo_y_lugar(self):
        self.firmar(self.datos_base(reason="Acta", location="Esmeraldas"),
                    [{"page": 1, "x": 1, "y": 1}])
        opciones = self.metadatos.call_args[1]
        self.assertEqual(opciones["reason"], "Acta")
        self.assertEqual(opciones["location"], "Esmeraldas")

    def test_tolerar_avisos_apaga_el_contexto_de_validacion_y_la_info_embebida(self):
        # Si el firmante acepta un certificado no confiable, no se puede
        # embeber información de validación: quedaría una firma LTV mentirosa.
        self.firmar(self.datos_base(allow_untrusted_signer=True), [{"page": 1, "x": 1, "y": 1}])
        self.contexto.assert_not_called()
        opciones = self.metadatos.call_args[1]
        self.assertIsNone(opciones["validation_context"])
        self.assertFalse(opciones["embed_validation_info"])
        self.assertFalse(opciones["use_pades_lta"])

    def test_con_contexto_y_flag_se_embebe_informacion_de_validacion(self):
        self.contexto.return_value = mock.Mock()
        with mock.patch.object(app, "SIGNER_EMBED_VALIDATION_INFO", True):
            self.firmar(self.datos_base(), [{"page": 1, "x": 1, "y": 1}])
        self.assertTrue(self.metadatos.call_args[1]["embed_validation_info"])

    def test_pades_lta_exige_contexto_y_sello_de_tiempo(self):
        self.contexto.return_value = mock.Mock()
        with mock.patch.object(app, "SIGNER_USE_PADES_LTA", True), \
             mock.patch.object(app, "PYHANKO_TSA_URL", "https://tsa/tsr"):
            self.firmar(self.datos_base(), [{"page": 1, "x": 1, "y": 1}])
        self.assertTrue(self.metadatos.call_args[1]["use_pades_lta"])

    def test_sin_tsa_no_hay_pades_lta_aunque_este_activado(self):
        self.contexto.return_value = mock.Mock()
        with mock.patch.object(app, "SIGNER_USE_PADES_LTA", True), \
             mock.patch.object(app, "PYHANKO_TSA_URL", ""), \
             mock.patch.object(app, "PYHANKO_DEFAULT_TSA_URL", ""):
            self.firmar(self.datos_base(), [{"page": 1, "x": 1, "y": 1}])
        self.assertFalse(self.metadatos.call_args[1]["use_pades_lta"])

    def test_sin_tsa_no_se_instancia_el_sellador(self):
        with mock.patch.object(app, "PYHANKO_TSA_URL", ""), \
             mock.patch.object(app, "PYHANKO_DEFAULT_TSA_URL", ""):
            resultado = self.firmar(self.datos_base(), [{"page": 1, "x": 1, "y": 1}])
        self.sellador.assert_not_called()
        self.assertIsNone(resultado["tsaUrl"])

    def test_con_tsa_se_instancia_el_sellador_con_esa_url(self):
        resultado = self.firmar(self.datos_base(tsaUrl="https://tsa/tsr"),
                                [{"page": 1, "x": 1, "y": 1}])
        self.sellador.assert_called_once_with("https://tsa/tsr")
        self.assertEqual(resultado["tsaUrl"], "https://tsa/tsr")

    def test_cada_firma_usa_un_nombre_de_campo_distinto(self):
        marcas = [{"page": 1, "x": 1, "y": 1}, {"page": 2, "x": 2, "y": 2}]
        datos = self.datos_base(signType="token", token="{{f}}")
        resultado = self.firmar(datos, marcas)
        self.assertEqual(len(resultado["fieldNames"]), 2)
        self.assertEqual(len(set(resultado["fieldNames"])), 2)
        for nombre in resultado["fieldNames"]:
            self.assertTrue(nombre.startswith("sig_"))

    def test_varias_marcas_producen_varias_firmas_encadenadas(self):
        marcas = [{"page": 1, "x": 1, "y": 1}, {"page": 2, "x": 2, "y": 2},
                  {"page": 3, "x": 3, "y": 3}]
        datos = self.datos_base(signType="token", token="{{f}}")
        resultado = self.firmar(datos, marcas)
        self.assertEqual(resultado["matchCount"], 3)
        self.assertEqual(len(resultado["coordinateMatches"]), 3)
        self.assertEqual(self.firmador.return_value.sign_pdf.call_count, 3)
        # La última firma es la que queda en `coordinates`/`fieldName`.
        self.assertEqual(resultado["coordinates"]["page"], 3)
        self.assertEqual(resultado["fieldName"], resultado["fieldNames"][-1])

    def test_la_ultima_firma_escribe_en_el_pdf_final(self):
        marcas = [{"page": 1, "x": 1, "y": 1}, {"page": 2, "x": 2, "y": 2}]
        datos = self.datos_base(signType="token", token="{{f}}")
        self.firmar(datos, marcas)
        self.assertTrue(self.rutas.signed_pdf.exists())
        # El intermedio se borra al encadenar.
        self.assertFalse((self.rutas.signed_pdf.parent / "signed_0.pdf").exists())


class PoliticaDeValidacionPosteriorALaFirma(unittest.TestCase):
    """Qué pasa cuando el PDF ya está firmado pero la cadena no valida."""

    def test_validacion_correcta_pasa_tal_cual(self):
        informe = {"performed": True, "bottomLine": True, "details": "ok"}
        with mock.patch.object(app, "validate_signed_pdf", return_value=informe):
            self.assertEqual(app.validate_signed_pdf_with_policy(Path("/tmp/a.pdf"), {}), informe)

    def test_validacion_fallida_sin_permiso_aborta_el_job(self):
        informe = {"performed": True, "bottomLine": False, "details": "cadena no confiable"}
        with mock.patch.object(app, "validate_signed_pdf", return_value=informe):
            with self.assertRaises(ValueError) as contexto:
                app.validate_signed_pdf_with_policy(Path("/tmp/a.pdf"), {})
        self.assertEqual(str(contexto.exception), "cadena no confiable")

    def test_validacion_fallida_con_permiso_se_degrada_a_aviso(self):
        informe = {"performed": True, "bottomLine": False, "details": "cadena no confiable"}
        with mock.patch.object(app, "validate_signed_pdf", return_value=informe):
            resultado = app.validate_signed_pdf_with_policy(
                Path("/tmp/a.pdf"), {"allow_untrusted_signer": True})
        self.assertEqual(resultado["warning"], "cadena no confiable")
        self.assertTrue(resultado["warningAccepted"])
        self.assertFalse(resultado["bottomLine"])

    def test_una_excepcion_al_validar_sin_permiso_se_propaga(self):
        with mock.patch.object(app, "validate_signed_pdf", side_effect=RuntimeError("revienta")):
            with self.assertRaises(RuntimeError):
                app.validate_signed_pdf_with_policy(Path("/tmp/a.pdf"), {})

    def test_una_excepcion_al_validar_con_permiso_se_convierte_en_aviso(self):
        with mock.patch.object(app, "validate_signed_pdf", side_effect=RuntimeError("revienta")):
            resultado = app.validate_signed_pdf_with_policy(
                Path("/tmp/a.pdf"), {"allowValidationWarning": True})
        self.assertEqual(resultado["warning"], "revienta")
        self.assertTrue(resultado["warningAccepted"])
        self.assertFalse(resultado["bottomLine"])

    def test_un_informe_sin_bottomline_se_considera_correcto(self):
        # `validate_signed_pdf` devuelve {"performed": False, ...} cuando el PDF
        # no tiene firmas embebidas; ese informe NO lleva `bottomLine` y el
        # `.get(..., True)` lo deja pasar. Documentado, no corregido.
        informe = {"performed": False, "message": "El PDF firmado no contiene firmas embebidas."}
        with mock.patch.object(app, "validate_signed_pdf", return_value=informe):
            self.assertEqual(app.validate_signed_pdf_with_policy(Path("/tmp/a.pdf"), {}), informe)


class ContratoDeRespuestaDelJobDeFirma(unittest.TestCase):
    """Las claves que lee `backend/controllers/sign/sign_controller.js`."""

    def setUp(self):
        self.descargar = mock.patch.object(app, "download_from_minio").start()
        self.subir = mock.patch.object(app, "upload_to_minio").start()
        mock.patch.object(app, "clean_pdf_if_needed").start()
        mock.patch.object(app, "load_certificate_info",
                          return_value={"common_name": "ANA PEREZ"}).start()
        mock.patch.object(app, "sign_pdf_document", return_value={
            "fieldName": "sig_x", "fieldNames": ["sig_x"], "tsaUrl": "https://tsa/tsr",
            "coordinates": {"page": 1, "x": 1, "y": 1, "width": 124, "height": 48},
            "coordinateMatches": [{"page": 1, "x": 1, "y": 1, "width": 124, "height": 48}],
            "matchCount": 1,
        }).start()
        mock.patch.object(app, "validate_signed_pdf_with_policy",
                          return_value={"performed": True, "bottomLine": True}).start()
        self.addCleanup(mock.patch.stopall)

        self.payload = {
            "signType": "coordinates",
            "minioPdfPath": "spool/a.pdf",
            "stampText": "Firmado",
            "finalPath": "spool/a.pdf",
            "minioCertPath": "certs/a.p12",
            "certPassword": "secreto",
            "coordinates": {"page": 1, "x": 1, "y": 1},
        }

    def test_respuesta_de_exito(self):
        resultado = app.process_job(dict(self.payload))
        self.assertEqual(resultado["status"], "success")
        self.assertEqual(resultado["message"], "Documento firmado correctamente.")
        self.assertEqual(resultado["signedPath"], "spool/a.pdf")
        self.assertEqual(resultado["workingPath"], "spool/a.pdf")
        self.assertEqual(resultado["finalPath"], "spool/a.pdf")
        self.assertTrue(resultado["timestamped"])
        self.assertEqual(resultado["tsaUrl"], "https://tsa/tsr")
        self.assertIn("certificate", resultado)
        self.assertIn("signature", resultado)
        self.assertIn("validation", resultado)
        self.assertIn("jobId", resultado)

    def test_un_payload_invalido_no_llega_a_descargar_nada(self):
        resultado = app.process_job({"signType": "coordinates"})
        self.assertEqual(resultado["status"], "error")
        self.assertEqual(resultado["message"], "Missing required field: minioPdfPath")
        self.assertNotIn("jobId", resultado)
        self.descargar.assert_not_called()

    def test_finalpath_distinto_provoca_dos_subidas(self):
        resultado = app.process_job(dict(self.payload, finalPath="final/a.pdf"))
        self.assertEqual(self.subir.call_count, 2)
        self.assertEqual(self.subir.call_args_list[0][0][1], "spool/a.pdf")
        self.assertEqual(self.subir.call_args_list[1][0][1], "final/a.pdf")
        self.assertEqual(resultado["signedPath"], "final/a.pdf")

    def test_finalpath_igual_provoca_una_sola_subida(self):
        app.process_job(dict(self.payload))
        self.assertEqual(self.subir.call_count, 1)

    def test_un_fallo_se_devuelve_como_error_con_jobid_y_sin_subir_nada(self):
        with mock.patch.object(app, "sign_pdf_document", side_effect=RuntimeError("firma rota")):
            resultado = app.process_job(dict(self.payload))
        self.assertEqual(resultado["status"], "error")
        self.assertEqual(resultado["message"], "firma rota")
        self.assertIn("jobId", resultado)
        self.subir.assert_not_called()

    def test_sin_tsa_el_documento_no_queda_marcado_como_sellado(self):
        with mock.patch.object(app, "sign_pdf_document",
                               return_value={"fieldName": "sig_x", "tsaUrl": None}):
            resultado = app.process_job(dict(self.payload))
        self.assertFalse(resultado["timestamped"])
        self.assertIsNone(resultado["tsaUrl"])


class ContratoDeRespuestaDelJobDeValidacion(unittest.TestCase):
    def setUp(self):
        # La descarga está simulada, pero el job abre el fichero de verdad:
        # el doble tiene que dejar algo en disco o el job aborta.
        def descargar(_bucket, _objeto, destino):
            destino.write_bytes(b"%PDF-1.4 falso")

        mock.patch.object(app, "download_from_minio", side_effect=descargar).start()
        mock.patch.object(app, "build_validation_context", return_value=None).start()
        self.lector = mock.patch.object(app, "PdfFileReader").start()
        self.addCleanup(mock.patch.stopall)

    def _con_entradas(self, entradas):
        self.lector.return_value.embedded_signatures = [object()] * len(entradas)
        return mock.patch.object(app, "normalize_signature_entry", side_effect=list(entradas))

    def test_documento_con_una_firma_que_coincide_con_la_cedula(self):
        entrada = {"index": 1, "entryType": "signature", "fieldName": "sig_1",
                   "valid": True, "signerName": "ANA PEREZ", "signerCedula": "1234567890"}
        with self._con_entradas([entrada]):
            resultado = app.process_validation_job(
                {"minioPdfPath": "spool/a.pdf", "cedula": "1234567890"})
        self.assertEqual(resultado["status"], "success")
        self.assertEqual(resultado["message"], "Documento validado correctamente.")
        self.assertTrue(resultado["document"]["hasSignatures"])
        self.assertEqual(resultado["document"]["sourcePath"], "spool/a.pdf")
        self.assertEqual(resultado["summary"]["signatureCount"], 1)
        self.assertTrue(resultado["matchByCedula"]["found"])
        self.assertEqual(resultado["matchByCedula"]["requestedCedula"], "1234567890")
        self.assertEqual(resultado["matchByCedula"]["matches"][0]["fieldName"], "sig_1")
        self.assertEqual(resultado["warnings"], [])
        self.assertEqual(resultado["timestamps"], [])

    def test_documento_sin_firmas_avisa_pero_no_falla(self):
        self.lector.return_value.embedded_signatures = []
        resultado = app.process_validation_job({"minioPdfPath": "spool/a.pdf"})
        self.assertEqual(resultado["status"], "success")
        self.assertFalse(resultado["document"]["hasSignatures"])
        self.assertEqual(resultado["warnings"], ["El documento no contiene firmas embebidas."])

    def test_la_cedula_que_no_coincide_produce_aviso(self):
        entrada = {"index": 1, "entryType": "signature", "signerCedula": "0000000000"}
        with self._con_entradas([entrada]):
            resultado = app.process_validation_job(
                {"minioPdfPath": "spool/a.pdf", "cedula": "1234567890"})
        self.assertFalse(resultado["matchByCedula"]["found"])
        self.assertIn("No se encontraron firmas que coincidan con la cédula consultada.",
                      resultado["warnings"])

    def test_los_sellos_de_tiempo_van_en_su_propia_lista(self):
        entradas = [
            {"index": 1, "entryType": "signature", "signerCedula": None},
            {"index": 2, "entryType": "timestamp", "fieldName": "ts_1"},
        ]
        with self._con_entradas(entradas):
            resultado = app.process_validation_job({"minioPdfPath": "spool/a.pdf"})
        self.assertEqual(len(resultado["signatures"]), 1)
        self.assertEqual(len(resultado["timestamps"]), 1)
        self.assertEqual(resultado["signatures"][0]["timestampFieldName"], "ts_1")
        self.assertEqual(resultado["summary"]["timestampCount"], 1)

    def test_payload_invalido(self):
        resultado = app.process_validation_job({"minioPdfPath": "spool/a.docx"})
        self.assertEqual(resultado, {"status": "error",
                                     "message": "minioPdfPath must reference a PDF file"})

    def test_un_fallo_de_descarga_se_devuelve_como_error_con_jobid(self):
        with mock.patch.object(app, "download_from_minio", side_effect=RuntimeError("no está")):
            resultado = app.process_validation_job({"minioPdfPath": "spool/a.pdf"})
        self.assertEqual(resultado["status"], "error")
        self.assertEqual(resultado["message"], "no está")
        self.assertIn("jobId", resultado)

    def test_la_cedula_vacia_se_normaliza_a_ausente(self):
        self.lector.return_value.embedded_signatures = []
        resultado = app.process_validation_job({"minioPdfPath": "spool/a.pdf", "cedula": "   "})
        self.assertIsNone(resultado["matchByCedula"]["requestedCedula"])


if __name__ == "__main__":
    unittest.main()
