# Despliegue - Infraestructura

## Docker

- Servicios: MariaDB, MongoDB, RabbitMQ, EMQX, Backend, Frontend.
- Workers opcionales: signer, analytics (profile workers).

## Base de datos

- MariaDB: datos relacionales principales.
- MongoDB: chat y notificaciones.

## Broker

- EMQX: realtime (WebSocket/MQTT).
- RabbitMQ: cola de trabajos disponible para procesos asincronos (firmas, storage y jobs pesados).

## Storage

- MinIO como storage principal por buckets de negocio.
- Buckets actuales:
  - `deasy-templates`
  - `deasy-documents`
  - `deasy-chat`
  - `deasy-spool`
  - `deasy-dossier`
- El filesystem local queda solo para flujos legacy o temporales.

## Recomendaciones

- Separar persistencia de contenedores y object storage.
- Definir backup coordinado BD + MinIO.
