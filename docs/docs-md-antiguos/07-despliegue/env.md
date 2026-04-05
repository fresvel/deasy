# Despliegue - Variables de entorno

## Archivo base

- docker/.env

Contenido actual:

- BACKEND_PORT=3030
- FRONTEND_PORT=8080
- MARIADB_ROOT_PASSWORD=deasy_root
- MARIADB_DATABASE=deasy
- MARIADB_USER=deasy
- MARIADB_PASSWORD=deasy
- URI_MONGO=mongodb://mongodb:27017/deasy
- MINIO_API_PORT=9000
- MINIO_CONSOLE_PORT=9001
- MINIO_ROOT_USER=deasy_minio
- MINIO_ROOT_PASSWORD=deasy_minio_secret
- MINIO_TEMPLATES_BUCKET=deasy-templates
- MINIO_TEMPLATES_PREFIX=System
- MINIO_TEMPLATES_SEEDS_PREFIX=Seeds
- MINIO_TEMPLATES_USERS_PREFIX=Users
- MINIO_DOCUMENTS_BUCKET=deasy-documents
- MINIO_DOCUMENTS_PREFIX=Unidades
- MINIO_CHAT_BUCKET=deasy-chat
- MINIO_CHAT_PREFIX=Chat
- MINIO_SPOOL_BUCKET=deasy-spool
- MINIO_SIGNATURES_PREFIX=Firmas
- MINIO_DOSSIER_BUCKET=deasy-dossier
- MINIO_DOSSIER_PREFIX=Dosier
- RABBITMQ_HTTP_API=http://rabbitmq:15672/api
- RABBITMQ_HTTP_USER=guest
- RABBITMQ_HTTP_PASSWORD=guest
- RABBITMQ_STORAGE_QUEUE=deasy.storage.uploads
- EMQX_API_BASE_URL=http://emqx:18083/api/v5
- EMQX_API_USERNAME=admin
- EMQX_API_PASSWORD=public
- CHAT_REALTIME_ENABLED=1

## Backend (docker env)

Variables inyectadas en el contenedor backend desde docker-compose:

- MARIADB_HOST=mariadb
- MARIADB_PORT=3306
- MARIADB_DATABASE
- MARIADB_USER
- MARIADB_PASSWORD
- URI_MONGO
- PORT (usa BACKEND_PORT)
- MINIO_ENDPOINT=http://minio:9000
- MINIO_PUBLIC_ENDPOINT=http://localhost:${MINIO_API_PORT}
- MINIO_ACCESS_KEY
- MINIO_SECRET_KEY
- MINIO_USE_SSL=0
- MINIO_TEMPLATES_BUCKET
- MINIO_TEMPLATES_PREFIX
- MINIO_TEMPLATES_SEEDS_PREFIX
- MINIO_TEMPLATES_USERS_PREFIX
- MINIO_DOCUMENTS_BUCKET
- MINIO_DOCUMENTS_PREFIX
- MINIO_CHAT_BUCKET
- MINIO_CHAT_PREFIX
- MINIO_SPOOL_BUCKET
- MINIO_SIGNATURES_PREFIX
- MINIO_DOSSIER_BUCKET
- MINIO_DOSSIER_PREFIX
- RABBITMQ_HTTP_API
- RABBITMQ_HTTP_USER
- RABBITMQ_HTTP_PASSWORD
- RABBITMQ_STORAGE_QUEUE
- EMQX_API_BASE_URL
- EMQX_API_USERNAME
- EMQX_API_PASSWORD
- CHAT_REALTIME_ENABLED

## Frontend (docker env)

- FRONTEND_PORT (mapea el puerto 8080 del contenedor)

## Broker

- EMQX_ALLOW_ANONYMOUS (en docker-compose, por defecto true)
- el backend publica eventos realtime por la API HTTP de EMQX usando:
  - EMQX_API_BASE_URL
  - EMQX_API_USERNAME
  - EMQX_API_PASSWORD
- si CHAT_REALTIME_ENABLED=0, el envío de mensajes persiste igual pero no intenta
  publicar eventos realtime.

## Storage

- El storage principal ya se resuelve con MinIO, no con `SHARED_STORAGE_ROOT`.
- Mantener `SHARED_STORAGE_ROOT` solo si algun flujo legacy puntual vuelve a requerir filesystem local.

## Backend (.env local)

Variables ya alineadas en `backend/.env` y `backend/.env_model`:

- MINIO_ENDPOINT=http://localhost:9000
- MINIO_PUBLIC_ENDPOINT=http://localhost:9000
- MINIO_ACCESS_KEY=deasy_minio
- MINIO_SECRET_KEY=deasy_minio_secret
- MINIO_USE_SSL=0
- MINIO_TEMPLATES_BUCKET=deasy-templates
- MINIO_TEMPLATES_PREFIX=System
- MINIO_TEMPLATES_SEEDS_PREFIX=Seeds
- MINIO_TEMPLATES_USERS_PREFIX=Users
- MINIO_DOCUMENTS_BUCKET=deasy-documents
- MINIO_DOCUMENTS_PREFIX=Unidades
- MINIO_CHAT_BUCKET=deasy-chat
- MINIO_CHAT_PREFIX=Chat
- MINIO_SPOOL_BUCKET=deasy-spool
- MINIO_SIGNATURES_PREFIX=Firmas
- MINIO_DOSSIER_BUCKET=deasy-dossier
- MINIO_DOSSIER_PREFIX=Dosier
- RABBITMQ_HTTP_API=http://localhost:15672/api
- RABBITMQ_HTTP_USER=guest
- RABBITMQ_HTTP_PASSWORD=guest
- RABBITMQ_STORAGE_QUEUE=deasy.storage.uploads
- EMQX_API_BASE_URL=http://localhost:18083/api/v5
- EMQX_API_USERNAME=admin
- EMQX_API_PASSWORD=public
- CHAT_REALTIME_ENABLED=1

## Politica de buckets

La configuracion actual separa MinIO por dominio funcional:

- `deasy-templates`
  - templates publicados
  - contenido estable y casi inmutable

- `deasy-documents`
  - documentos generados por procesos
  - informes, PDFs y resultados finales

- `deasy-chat`
  - adjuntos de chat
  - contenido con mayor rotacion

- `deasy-spool`
  - spool temporal de firmas
  - colas y temporales antes de consolidar el documento final

- `deasy-dossier`
  - archivos del dosier del usuario
  - evidencias, anexos y soportes asociados a su historial
