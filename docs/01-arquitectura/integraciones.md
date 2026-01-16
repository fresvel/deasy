# Arquitectura - Integraciones

## WhatsApp

- Servicio existente: backend/services/whatsapp/WhatsAppBot.js
- Rutas API: backend/routes/whatsapp_router.js

## Servicios externos

- backend/services/external/webservices_ec.js (servicios externos/terceros).

## Broker/Mensajeria

- EMQX como broker principal para realtime.
- RabbitMQ disponible en el stack (uso por definir).

## Reportes

- LaTeX: backend/services/latex/
- Webtemplate: backend/services/webtemplate/

