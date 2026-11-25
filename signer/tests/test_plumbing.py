"""Fontanería: MinIO, material de confianza, Ghostscript y temporales.

Nada de esto es lógica de firma, pero decide qué PDF entra al firmador y con
qué anclas de confianza se valida el resultado. Es la capa que la auditoría
propone extraer primero, y estas pruebas son la red que lo permite.
"""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

import app


class ConstruccionDelClienteMinio(unittest.TestCase):
    def test_quita_el_esquema_http_y_desactiva_tls(self):
        with mock.patch.object(app, "MINIO_ENDPOINT", "http://minio:9000"), \
             mock.patch.object(app, "Minio") as constructor:
            app.create_minio_client()
        constructor.assert_called_once()
        argumentos, opciones = constructor.call_args
        self.assertEqual(argumentos[0], "minio:9000")
        self.assertFalse(opciones["secure"])

    def test_https_activa_tls(self):
        with mock.patch.object(app, "MINIO_ENDPOINT", "https://minio.example:9000"), \
             mock.patch.object(app, "Minio") as constructor:
            app.create_minio_client()
        argumentos, opciones = constructor.call_args
        self.assertEqual(argumentos[0], "minio.example:9000")
        self.assertTrue(opciones["secure"])

    def test_endpoint_sin_esquema_se_toma_tal_cual_y_sin_tls(self):
        with mock.patch.object(app, "MINIO_ENDPOINT", "minio:9000"), \
             mock.patch.object(app, "Minio") as constructor:
            app.create_minio_client()
        argumentos, opciones = constructor.call_args
        self.assertEqual(argumentos[0], "minio:9000")
        self.assertFalse(opciones["secure"])


class TransferenciasConMinio(unittest.TestCase):
    def setUp(self):
        self.cliente = mock.Mock()
        parche = mock.patch.object(app, "MINIO_CLIENT", self.cliente)
        parche.start()
        self.addCleanup(parche.stop)
        parche_bucket = mock.patch.object(app, "MINIO_SPOOL_BUCKET", "deasy-spool")
        parche_bucket.start()
        self.addCleanup(parche_bucket.stop)

    def test_descarga_con_bucket_explicito(self):
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta) / "sub" / "a.pdf"
            app.download_from_minio("otro-bucket", "ruta/a.pdf", destino)
            # `ensure_parent` crea la carpeta intermedia antes de descargar.
            self.assertTrue(destino.parent.is_dir())
        self.cliente.fget_object.assert_called_once_with("otro-bucket", "ruta/a.pdf", str(destino))

    def test_descarga_sin_bucket_usa_el_spool(self):
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta) / "a.pdf"
            app.download_from_minio(None, "ruta/a.pdf", destino)
        self.assertEqual(self.cliente.fget_object.call_args[0][0], "deasy-spool")

    def test_la_subida_siempre_declara_content_type_pdf(self):
        app.upload_to_minio(None, "ruta/a.pdf", Path("/tmp/a.pdf"))
        self.cliente.fput_object.assert_called_once_with(
            "deasy-spool", "ruta/a.pdf", "/tmp/a.pdf", content_type="application/pdf",
        )


class NormalizacionDelPdfDeEntrada(unittest.TestCase):
    """El PDF pasa por Ghostscript salvo que ya lleve firmas: si las lleva,
    aplanarlo las destruiría. Es una regla de negocio, no una optimización."""

    def setUp(self):
        self.copiar = mock.patch.object(app.shutil, "copyfile").start()
        self.ejecutar = mock.patch.object(app.subprocess, "run").start()
        self.addCleanup(mock.patch.stopall)

    def test_un_pdf_ya_firmado_se_copia_sin_tocar(self):
        with mock.patch.object(app, "pdf_has_embedded_signatures", return_value=True):
            app.clean_pdf_if_needed(Path("/tmp/in.pdf"), Path("/tmp/out.pdf"))
        self.ejecutar.assert_not_called()
        self.copiar.assert_called_once_with(Path("/tmp/in.pdf"), Path("/tmp/out.pdf"))

    def test_con_ghostscript_desactivado_se_copia(self):
        with mock.patch.object(app, "pdf_has_embedded_signatures", return_value=False), \
             mock.patch.object(app, "SIGNER_USE_GHOSTSCRIPT", False):
            app.clean_pdf_if_needed(Path("/tmp/in.pdf"), Path("/tmp/out.pdf"))
        self.ejecutar.assert_not_called()
        self.copiar.assert_called_once()

    def test_pdf_limpio_pasa_por_ghostscript(self):
        with mock.patch.object(app, "pdf_has_embedded_signatures", return_value=False), \
             mock.patch.object(app, "SIGNER_USE_GHOSTSCRIPT", True):
            app.clean_pdf_if_needed(Path("/tmp/in.pdf"), Path("/tmp/out.pdf"))
        self.copiar.assert_not_called()
        orden = self.ejecutar.call_args[0][0]
        self.assertEqual(orden[0], "gs")
        self.assertIn("-sDEVICE=pdfwrite", orden)
        self.assertEqual(orden[-2:], ["/tmp/out.pdf", "/tmp/in.pdf"])

    def test_si_ghostscript_falla_se_sigue_con_el_original(self):
        self.ejecutar.side_effect = RuntimeError("gs no está")
        with mock.patch.object(app, "pdf_has_embedded_signatures", return_value=False), \
             mock.patch.object(app, "SIGNER_USE_GHOSTSCRIPT", True):
            app.clean_pdf_if_needed(Path("/tmp/in.pdf"), Path("/tmp/out.pdf"))
        self.copiar.assert_called_once_with(Path("/tmp/in.pdf"), Path("/tmp/out.pdf"))

    def test_un_pdf_ilegible_se_trata_como_sin_firmas(self):
        with mock.patch.object(app, "PdfFileReader", side_effect=RuntimeError("roto")), \
             tempfile.TemporaryDirectory() as carpeta:
            fichero = Path(carpeta) / "a.pdf"
            fichero.write_bytes(b"no soy un pdf")
            self.assertFalse(app.pdf_has_embedded_signatures(fichero))


class CargaDeMaterialDeConfianza(unittest.TestCase):
    def setUp(self):
        self.carpeta = tempfile.TemporaryDirectory()
        self.addCleanup(self.carpeta.cleanup)
        self.raiz = Path(self.carpeta.name)

    def _escribir(self, ruta_relativa: str):
        destino = self.raiz / ruta_relativa
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(b"certificado falso")
        return destino

    def test_carpeta_inexistente_devuelve_lista_vacia(self):
        self.assertEqual(app.load_certificates_from_dir(self.raiz / "no-existe"), [])

    def test_filtra_por_extension_y_ordena(self):
        self._escribir("b.pem")
        self._escribir("a.crt")
        self._escribir("z.txt")
        self._escribir("sub/c.cer")  # los subdirectorios no se recorren
        with mock.patch.object(app, "load_certificate_file", side_effect=lambda ruta: ruta.name):
            cargados = app.load_certificates_from_dir(self.raiz)
        self.assertEqual(cargados, ["a.crt", "b.pem"])

    def test_un_certificado_ilegible_no_tumba_la_carga(self):
        self._escribir("bueno.pem")
        self._escribir("malo.der")

        def cargar(ruta):
            if ruta.name == "malo.der":
                raise ValueError("no parsea")
            return ruta.name

        with mock.patch.object(app, "load_certificate_file", side_effect=cargar):
            self.assertEqual(app.load_certificates_from_dir(self.raiz), ["bueno.pem"])

    def test_lee_roots_y_extra_por_separado(self):
        self._escribir("roots/r.pem")
        self._escribir("extra/e.pem")
        with mock.patch.object(app, "SIGNER_TRUST_DIR", self.raiz), \
             mock.patch.object(app, "load_certificate_file", side_effect=lambda ruta: ruta.name):
            raices, extra = app.load_trust_material()
        self.assertEqual(raices, ["r.pem"])
        self.assertEqual(extra, ["e.pem"])

    def test_compatibilidad_sin_subcarpetas_todo_es_root(self):
        self._escribir("suelto.pem")
        with mock.patch.object(app, "SIGNER_TRUST_DIR", self.raiz), \
             mock.patch.object(app, "load_certificate_file", side_effect=lambda ruta: ruta.name):
            raices, extra = app.load_trust_material()
        self.assertEqual(raices, ["suelto.pem"])
        self.assertEqual(extra, [])

    def test_sin_material_devuelve_dos_listas_vacias(self):
        with mock.patch.object(app, "SIGNER_TRUST_DIR", self.raiz / "vacio"):
            self.assertEqual(app.load_trust_material(), ([], []))


class ContextoDeValidacion(unittest.TestCase):
    def test_sin_confianza_ni_tsa_no_se_construye_contexto(self):
        with mock.patch.object(app, "load_trust_material", return_value=([], [])), \
             mock.patch.object(app, "SIGNER_EMBED_VALIDATION_INFO", False), \
             mock.patch.object(app, "PYHANKO_TSA_URL", ""), \
             mock.patch.object(app, "PYHANKO_DEFAULT_TSA_URL", ""):
            self.assertIsNone(app.build_validation_context())

    def test_con_raices_se_construye_en_modo_soft_fail(self):
        with mock.patch.object(app, "load_trust_material", return_value=(["r"], ["e"])), \
             mock.patch.object(app, "ValidationContext") as constructor:
            app.build_validation_context()
        opciones = constructor.call_args[1]
        self.assertEqual(opciones["trust_roots"], ["r"])
        self.assertEqual(opciones["other_certs"], ["r", "e"])
        self.assertEqual(opciones["revocation_mode"], "soft-fail")
        self.assertTrue(opciones["allow_fetching"])

    def test_sin_raices_pero_con_tsa_por_defecto_si_hay_contexto(self):
        with mock.patch.object(app, "load_trust_material", return_value=([], [])), \
             mock.patch.object(app, "SIGNER_EMBED_VALIDATION_INFO", False), \
             mock.patch.object(app, "PYHANKO_TSA_URL", ""), \
             mock.patch.object(app, "PYHANKO_DEFAULT_TSA_URL", "https://freetsa.org/tsr"), \
             mock.patch.object(app, "ValidationContext") as constructor:
            app.build_validation_context()
        opciones = constructor.call_args[1]
        self.assertIsNone(opciones["trust_roots"])
        self.assertIsNone(opciones["other_certs"])


if __name__ == "__main__":
    unittest.main()
