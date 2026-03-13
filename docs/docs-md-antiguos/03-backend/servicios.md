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

## Reportes (WebTemplate)

- Servicio: backend/services/webtemplate/
- Router: backend/routes/webtemplate_router.js
- Controladores: backend/controllers/informes/

## Firmas (Signflow)

- Servicio principal: backend/services/signflow/
- Multisigner: backend/services/signflow/multisigner/
- Certificados: backend/services/signflow/src/certmanager/CertificateManager.js

## Integraciones externas

- Servicios externos: backend/services/external/webservices_ec.js

## Mensajeria

- Broker: docker/emqx/emqx.conf
- RabbitMQ: docker/rabbitmq/rabbitmq.conf
