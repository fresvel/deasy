> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Backend - Servicios (tecnico)

## WhatsApp

- Servicio: backend/services/whatsapp/WhatsAppBot.js
- Router: backend/routes/whatsapp_router.js
- Controlador: backend/controllers/whatsapp/

## Reportes (LaTeX)

- Servicio: backend/services/latex/
- Builder: backend/services/latex/src/builder/
- Transpiler: backend/services/latex/src/transpiler/
- Templates LaTeX runtime: backend/services/latex/templates/
- Templates legacy auxiliares: backend/templates_legacy/

## Firmas

- Servicio principal: signer/
- Contenedor: docker/signer/
- Flujo de certificados y firmado: signer/app.py y signer/signService.js

## Integraciones externas

- Servicios externos: backend/services/external/webservices_ec.js

## Mensajeria

- Broker: docker/emqx/emqx.conf
- RabbitMQ: docker/rabbitmq/rabbitmq.conf
