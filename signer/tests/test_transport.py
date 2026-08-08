"""Transporte: el servidor HTTP interno y la publicación por RabbitMQ.

Es fontanería pura y no debería contener ninguna decisión de negocio. La
única que contiene hoy —el mapeo de `status` a código HTTP— se fija aquí.
"""

import io
import json
import unittest
from unittest import mock

import app


class ManejadorFalso(app.SignHttpHandler):
    """Instancia el manejador sin socket: `BaseHTTPRequestHandler.__init__`
    intenta servir la petición nada más construirse, así que se salta."""

    def __init__(self, ruta="/", cuerpo=b""):
        self.path = ruta
        self.headers = {"Content-Length": str(len(cuerpo))}
        self.rfile = io.BytesIO(cuerpo)
        self.wfile = io.BytesIO()
        self.respuestas = []
        self.cabeceras = []

    def send_response(self, codigo, mensaje=None):
        self.respuestas.append(codigo)

    def send_header(self, clave, valor):
        self.cabeceras.append((clave, valor))

    def end_headers(self):
        pass


class RespuestaJson(unittest.TestCase):
    def test_serializa_el_cuerpo_y_declara_longitud_y_tipo(self):
        manejador = ManejadorFalso()
        manejador._send_json(200, {"status": "ok"})
        cuerpo = manejador.wfile.getvalue()
        self.assertEqual(json.loads(cuerpo), {"status": "ok"})
        self.assertEqual(manejador.respuestas, [200])
        self.assertIn(("Content-Type", "application/json"), manejador.cabeceras)
        self.assertIn(("Content-Length", str(len(cuerpo))), manejador.cabeceras)


class RutasHttp(unittest.TestCase):
    def test_health_responde_ok(self):
        manejador = ManejadorFalso("/health")
        manejador.do_GET()
        self.assertEqual(manejador.respuestas, [200])
        self.assertEqual(json.loads(manejador.wfile.getvalue()),
                         {"status": "ok", "service": "signer"})

    def test_get_desconocido_es_404(self):
        manejador = ManejadorFalso("/lo-que-sea")
        manejador.do_GET()
        self.assertEqual(manejador.respuestas, [404])

    def test_post_desconocido_es_404_y_no_lee_el_cuerpo(self):
        manejador = ManejadorFalso("/otra", b'{"a":1}')
        with mock.patch.object(app, "process_job") as firmar:
            manejador.do_POST()
        firmar.assert_not_called()
        self.assertEqual(manejador.respuestas, [404])

    def test_cuerpo_no_json_es_400(self):
        manejador = ManejadorFalso("/sign", b"esto no es json")
        manejador.do_POST()
        self.assertEqual(manejador.respuestas, [400])
        self.assertEqual(json.loads(manejador.wfile.getvalue())["message"], "Invalid JSON body")

    def test_sign_delega_en_process_job_y_devuelve_200_si_hay_exito(self):
        cuerpo = json.dumps({"signType": "token"}).encode()
        manejador = ManejadorFalso("/sign", cuerpo)
        with mock.patch.object(app, "process_job", return_value={"status": "success"}) as firmar:
            manejador.do_POST()
        firmar.assert_called_once_with({"signType": "token"})
        self.assertEqual(manejador.respuestas, [200])

    def test_un_error_de_negocio_viaja_como_500(self):
        # Ojo: un payload inválido (culpa del cliente) también sale como 500.
        manejador = ManejadorFalso("/sign", b"{}")
        with mock.patch.object(app, "process_job",
                               return_value={"status": "error", "message": "falta algo"}):
            manejador.do_POST()
        self.assertEqual(manejador.respuestas, [500])

    def test_validate_delega_en_process_validation_job(self):
        manejador = ManejadorFalso("/validate", b'{"minioPdfPath":"a.pdf"}')
        with mock.patch.object(app, "process_validation_job",
                               return_value={"status": "success"}) as validar:
            manejador.do_POST()
        validar.assert_called_once_with({"minioPdfPath": "a.pdf"})
        self.assertEqual(manejador.respuestas, [200])


class InvocacionDeSigmaker(unittest.TestCase):
    """El sello lo dibuja un CLI de Node (`sigmaker/cli.mjs`). El contrato es
    posicional, así que el orden de los argumentos ES la interfaz."""

    def test_orden_de_los_argumentos(self):
        datos = {"stampText": "  Firmado por ANA  ", "finalPath": "final/a.pdf",
                 "minioPdfPath": "spool/a.pdf"}
        with mock.patch.object(app.subprocess, "run") as ejecutar:
            app.generate_stamp_image(datos, "/tmp/stamp.png")
        orden = ejecutar.call_args[0][0]
        self.assertEqual(orden[0], "node")
        self.assertEqual(orden[1], str(app.SIGMAKER_DIR / "cli.mjs"))
        self.assertEqual(orden[2], "/tmp/stamp.png")
        self.assertEqual(orden[3], "Firmado por ANA")  # se recorta
        self.assertEqual(orden[4], "final/a.pdf")      # el QR apunta al destino final
        self.assertEqual(orden[5], str(app.SIGMAKER_DIR / "puce_logo.png"))
        self.assertTrue(ejecutar.call_args[1]["check"])

    def test_sin_finalpath_el_qr_apunta_al_pdf_de_trabajo(self):
        datos = {"stampText": "X", "minioPdfPath": "spool/a.pdf"}
        with mock.patch.object(app.subprocess, "run") as ejecutar:
            app.generate_stamp_image(datos, "/tmp/stamp.png")
        self.assertEqual(ejecutar.call_args[0][0][4], "spool/a.pdf")


class EstiloDelSello(unittest.TestCase):
    def test_el_sello_es_solo_imagen_sin_texto_ni_borde(self):
        with mock.patch.object(app, "PdfImage") as imagen:
            estilo = app.build_stamp_style("/tmp/stamp.png")
        imagen.assert_called_once_with("/tmp/stamp.png")
        self.assertEqual(estilo.stamp_text, "")
        self.assertEqual(estilo.border_width, 0)
        self.assertEqual(estilo.background_opacity, 1)


class EnrutadoDeMensajesDeRabbit(unittest.TestCase):
    """La única decisión de negocio del transporte: el mensaje que llega por la
    cola de validación va a `process_validation_job` y todo lo demás a
    `process_job`. Se decide por `routing_key`, no por el contenido."""

    def setUp(self):
        self.canal = mock.Mock()
        self.firmar = mock.patch.object(app, "process_job",
                                        return_value={"status": "success"}).start()
        self.validar = mock.patch.object(app, "process_validation_job",
                                         return_value={"status": "success"}).start()
        self.publicar = mock.patch.object(app, "publish_response").start()
        self.addCleanup(mock.patch.stopall)

    def _entrega(self, cola):
        return mock.Mock(routing_key=cola, delivery_tag=7)

    def _cuerpo(self, **campos):
        base = {"responseQueue": "deasy.sign.response.abc", "correlationId": "abc"}
        base.update(campos)
        return json.dumps(base).encode()

    def test_la_cola_de_validacion_va_al_job_de_validacion(self):
        app.on_message(self.canal, self._entrega(app.VALIDATE_REQUEST_QUEUE), None, self._cuerpo())
        self.validar.assert_called_once()
        self.firmar.assert_not_called()

    def test_cualquier_otra_cola_va_al_job_de_firma(self):
        app.on_message(self.canal, self._entrega(app.SIGN_REQUEST_QUEUE), None, self._cuerpo())
        self.firmar.assert_called_once()
        self.validar.assert_not_called()

    def test_el_correlation_id_se_devuelve_en_la_respuesta(self):
        app.on_message(self.canal, self._entrega(app.SIGN_REQUEST_QUEUE), None,
                       self._cuerpo(correlationId="xyz"))
        self.assertEqual(self.publicar.call_args[0][2]["correlationId"], "xyz")
        self.assertEqual(self.publicar.call_args[0][1], "deasy.sign.response.abc")

    def test_el_mensaje_se_reconoce_siempre_al_terminar(self):
        app.on_message(self.canal, self._entrega(app.SIGN_REQUEST_QUEUE), None, self._cuerpo())
        self.canal.basic_ack.assert_called_once_with(delivery_tag=7)

    def test_un_payload_ilegible_se_descarta_reconociendolo(self):
        # No hay reintentos ni cola de descarte: el mensaje malo se pierde.
        app.on_message(self.canal, self._entrega(app.SIGN_REQUEST_QUEUE), None, b"no es json")
        self.firmar.assert_not_called()
        self.publicar.assert_not_called()
        self.canal.basic_ack.assert_called_once_with(delivery_tag=7)

    def test_sin_response_queue_no_se_hace_el_trabajo(self):
        cuerpo = json.dumps({"minioPdfPath": "a.pdf"}).encode()
        app.on_message(self.canal, self._entrega(app.SIGN_REQUEST_QUEUE), None, cuerpo)
        self.firmar.assert_not_called()
        self.publicar.assert_not_called()
        self.canal.basic_ack.assert_called_once_with(delivery_tag=7)

    def test_un_error_de_negocio_tambien_se_publica_y_se_reconoce(self):
        self.firmar.return_value = {"status": "error", "message": "falló"}
        app.on_message(self.canal, self._entrega(app.SIGN_REQUEST_QUEUE), None, self._cuerpo())
        self.assertEqual(self.publicar.call_args[0][2]["status"], "error")
        self.canal.basic_ack.assert_called_once_with(delivery_tag=7)


class PublicacionEnRabbit(unittest.TestCase):
    def test_declara_la_cola_de_respuesta_como_duradera_antes_de_publicar(self):
        canal = mock.Mock()
        app.publish_response(canal, "deasy.sign.response.abc", {"status": "success"})
        canal.queue_declare.assert_called_once_with(queue="deasy.sign.response.abc", durable=True)
        canal.basic_publish.assert_called_once()
        opciones = canal.basic_publish.call_args[1]
        self.assertEqual(opciones["exchange"], "")
        self.assertEqual(opciones["routing_key"], "deasy.sign.response.abc")
        self.assertEqual(json.loads(opciones["body"]), {"status": "success"})

    def test_el_mensaje_se_publica_persistente_y_como_json(self):
        canal = mock.Mock()
        app.publish_response(canal, "cola", {"a": 1})
        propiedades = canal.basic_publish.call_args[1]["properties"]
        self.assertEqual(propiedades.content_type, "application/json")
        self.assertEqual(propiedades.delivery_mode, 2)


if __name__ == "__main__":
    unittest.main()


class RedaccionDeCredencialesEnLogs(unittest.TestCase):
    """La URL de AMQP lleva credenciales desde que el broker dejo de aceptar `guest`."""

    def test_oculta_la_contrasena_conservando_el_usuario(self):
        self.assertEqual(
            app.redact_amqp_url("amqp://deasy:s3cr3t0@rabbitmq:5672"),
            "amqp://deasy:***@rabbitmq:5672",
        )

    def test_una_url_sin_credenciales_no_se_toca(self):
        self.assertEqual(app.redact_amqp_url("amqp://rabbitmq:5672"), "amqp://rabbitmq:5672")

    def test_tolera_vacio(self):
        self.assertEqual(app.redact_amqp_url(""), "")

    def test_no_deja_pasar_una_contrasena_con_simbolos(self):
        redactada = app.redact_amqp_url("amqps://usuario:p@ss/w:rd@broker:5671")
        self.assertNotIn("w:rd", redactada)
        self.assertIn(":***@", redactada)
