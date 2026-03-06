# Despliegue - Docker

## Ubicacion y rutas

- Compose principal: docker/docker-compose.yml
- Variables de entorno: docker/.env
- Dockerfiles:
  - docker/backend/Dockerfile
  - docker/frontend/Dockerfile
  - docker/signer/Dockerfile
  - docker/analytics/Dockerfile
- Configuracion RabbitMQ: docker/rabbitmq/rabbitmq.conf
- Configuracion EMQX: docker/emqx/emqx.conf
- Bootstrap MinIO: docker/minio/bootstrap.sh
- Publish directo a MinIO: docker/minio/publish-templates.sh
- Carpeta de importacion MinIO: docker/minio/import/

## Servicios definidos (docker-compose)

- mariadb (mariadb:11.4)
- mongodb (mongo:7)
- rabbitmq (rabbitmq:3-management)
- emqx (emqx/emqx:latest)
- minio (minio/minio)
- minio-bootstrap (profile storage-init, minio/mc)
- minio-publish (profile storage-publish, minio/mc)
- minio-publish-seeds (profile storage-publish-seeds, minio/mc)
- backend (build docker/backend/Dockerfile)
- storage-uploader (worker Node para cargas a MinIO via RabbitMQ)
- frontend (build docker/frontend/Dockerfile)
- signer (profile workers)
- analytics (profile workers)

## Imagenes base

- Backend: rockylinux/rockylinux:10.1.20251123-ubi
- Frontend: node:22.12.0-alpine
- Signer: python:3.11-slim
- Analytics: python:3.11-slim

## Runtime

- Backend: Node.js 22 (NodeSource)
- Frontend: Node.js 22.12.0 + pnpm 10

## Puertos expuestos (host -> contenedor)

- MariaDB: 3306 -> 3306
- MongoDB: 27017 -> 27017
- RabbitMQ: 5672 -> 5672, 15672 -> 15672 (UI)
- EMQX: 1883 -> 1883, 18083 -> 18083 (UI)
- MinIO API: ${MINIO_API_PORT} -> 9000
- MinIO Console: ${MINIO_CONSOLE_PORT} -> 9001
- Backend API: ${BACKEND_PORT} -> 3030
- Frontend: ${FRONTEND_PORT} -> 8080

## Volumenes

- mariadb_data, mongodb_data, rabbitmq_data
- emqx_data, emqx_log, minio_data
- backend_node_modules_v2, frontend_node_modules
- uploads_data, storage_data

Montajes relevantes en desarrollo:

- `../backend -> /app/backend`
- `../tools/templates -> /app/tools/templates` (solo lectura en `backend`)
  - Esto permite que el backend lea `tools/templates/dist/Plantillas/`.
  - Lo usa el endpoint de sincronizacion de `template_artifacts` (`Sincronizar dist`).
- `storage_data -> /app/backend/storage` (lectura/escritura en `backend` y `storage-uploader`)
  - El backend deja paquetes temporales en `backend/storage/minio-jobs/...`.
  - `storage-uploader` consume esos paquetes y los sube a MinIO.

## Comandos base

- Iniciar stack principal: docker compose up -d
- Iniciar con workers: docker compose --profile workers up -d
- Script de arranque Linux/macOS: scripts/start-services.sh
- Script de arranque Windows PowerShell: scripts/start-services.ps1
- Cargar templates en MinIO: docker compose --profile storage-init run --rm minio-bootstrap
- Publicar templates desde tools/templates/dist: docker compose --profile storage-publish run --rm minio-publish
- Publicar seeds desde tools/templates/seeds: docker compose --profile storage-publish-seeds run --rm minio-publish-seeds
- Ver logs: docker compose logs -f
- Detener: docker compose down

## Notas

- Backend usa node --watch para recarga en caliente.
- Frontend usa vue-cli-service serve con HMR.
- EMQX_ALLOW_ANONYMOUS=true en compose (ajustar en prod).
- `minio-bootstrap` no se ejecuta en el arranque normal; solo cuando quieras subir el contenido de `docker/minio/import/`.
- `minio-publish` no usa `docker/minio/import/`; publica directo desde `tools/templates/dist/Plantillas`.
- `minio-publish-seeds` no usa `docker/minio/import/`; publica directo desde `tools/templates/seeds`.
- `storage-uploader` debe estar levantado para que los borradores creados desde el admin se publiquen automaticamente en MinIO.
- El bucket ya no es solo para templates; MinIO se usa como storage general con prefijos para documentos, chat y firmas.
- Si cambias `docker-compose.yml` o la ruta de `tools/templates`, recrea `backend` con `docker compose up -d --build --force-recreate backend storage-uploader` para que ambos contenedores tomen el nuevo montaje y dependencias.
