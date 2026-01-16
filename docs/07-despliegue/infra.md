# Despliegue - Infraestructura

## Docker

- Servicios: MariaDB, MongoDB, RabbitMQ, EMQX, Backend, Frontend.
- Workers opcionales: signer, analytics (profile workers).

## Base de datos

- MariaDB: datos relacionales principales.
- MongoDB: chat y notificaciones.

## Broker

- EMQX: realtime (WebSocket/MQTT).
- RabbitMQ: cola de trabajos (uso pendiente).

## Storage compartido

- Volumen storage_data en docker-compose.
- En despliegue real usar NFS u otro FS compartido.
- Variable: SHARED_STORAGE_ROOT.

## Recomendaciones

- Separar persistencia de contenedores y filesystem.
- Definir backup coordinado BD + storage compartido.

