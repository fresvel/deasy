# Comandos clave del proyecto Deasy

Ultima revision local: 2026-05-04

Este archivo resume el analisis operativo del repositorio y los comandos mas
importantes para levantar, validar y administrar el proyecto. La fuente principal
de estos comandos son `package.json`, `Dockerfile`, `docker/README.md`,
`docker/compose*.yml`, `README.md` y los scripts de `scripts/`.

## Analisis rapido

El repositorio esta organizado como un monorepo con capas separadas:

- `frontend/`: aplicacion web en Vue 3, Vite y TailwindCSS. Usa `pnpm`.
- `backend/`: API Express en ESM. Usa `npm` y expone la API bajo `/easym/v1`.
- `docs/`: sitio de documentacion en Astro Starlight. Usa `pnpm`.
- `signer/`: servicio de firma digital con Python, `pyhanko`, MinIO y un helper Node en `sigmaker/`.
- `docker/`: composicion de servicios para MariaDB, MongoDB, RabbitMQ, EMQX, MinIO, Nginx, backend, frontend, signer y analytics.
- `scripts/`: wrappers operativos para arranque, despliegue, seeds, reset y migraciones.
- `tools/`: herramientas auxiliares, incluyendo plantillas.

Para trabajar el stack completo, la ruta mas consistente es Docker. Para cambios
puntuales de UI o API, tambien se puede correr `frontend/` y `backend/` en local,
siempre que las dependencias externas esten disponibles.

## Requisitos base

- Docker Desktop o Docker Engine con Docker Compose.
- Git Bash, WSL o un shell compatible con Bash para los scripts `.sh`.
- Node.js compatible con el frontend: `^20.19.0` o `>=22.12.0`.
- `pnpm >= 10` para `frontend/` y `docs/`.
- `npm` para `backend/` y algunos helpers de `signer/`.
- Python para ejecutar `signer/` fuera de Docker.

## Arranque recomendado con Docker

Desde la raiz del repo:

```bash
bash scripts/docker-env.sh dev up -d --build
```

Ver configuracion efectiva antes de levantar:

```bash
bash scripts/docker-env.sh dev config
```

## QA local para desarrollo

Cuando se necesita trabajar con comportamiento de QA pero modificando el codigo
local, usar `qa-local`. Este modo usa `docker/.env.qa`, puertos de QA y build
local de `backend/`, `frontend/`, `signer` y `analytics`.

```bash
bash scripts/docker-env.sh qa-local up -d --build
```

URLs locales:

- Aplicacion via proxy HTTP: `http://localhost:9088`
- Aplicacion via proxy HTTPS: `https://localhost:9443`
- API via proxy: `https://localhost:9443/api/easym/v1`
- Swagger UI: `https://localhost:9443/api/easym/docs`
- MinIO API: `http://localhost:9100`
- MinIO Console: `http://localhost:9101`
- RabbitMQ UI: `http://localhost:15673`
- EMQX UI: `http://localhost:18084`
- Signer: `http://localhost:14000`

Ver estado:

```bash
bash scripts/docker-env.sh qa-local ps
```

Ver logs:

```bash
bash scripts/docker-env.sh qa-local logs -f backend
bash scripts/docker-env.sh qa-local logs -f frontend
```

Apagar QA local:

```bash
bash scripts/docker-env.sh qa-local down
```

Nota: `qa-local` es para desarrollo con codigo local. El ambiente `qa` sin
`-local` esta pensado para imagenes publicadas en GHCR y despliegue operativo.

Ver servicios:

```bash
bash scripts/docker-env.sh dev ps
```

Ver logs:

```bash
bash scripts/docker-env.sh dev logs -f backend
bash scripts/docker-env.sh dev logs -f frontend
bash scripts/docker-env.sh dev logs -f signer
```

Apagar el ambiente:

```bash
bash scripts/docker-env.sh dev down
```

Apagar y limpiar contenedores huerfanos:

```bash
bash scripts/docker-env.sh dev down --remove-orphans
```

## Arranque alternativo con scripts legacy

Estos scripts usan `docker/docker-compose.yml` y crean `docker/.env` desde
`docker/.env.example` si no existe.

En Windows PowerShell:

```powershell
.\scripts\start-services.ps1
```

En Bash:

```bash
bash scripts/start-services.sh
bash scripts/start-services.sh --build
bash scripts/start-services.sh --no-cache
```

Ver estado si se usa el compose legacy:

```bash
cd docker
docker compose ps
docker compose logs -f backend
```

## URLs utiles en desarrollo

Con el stack Docker de `dev`:

- Aplicacion via proxy HTTP: `http://localhost:8088`
- Aplicacion via proxy HTTPS: `https://localhost:8443`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- RabbitMQ UI: `http://localhost:15672`
- EMQX UI: `http://localhost:18083`
- Signer: `http://localhost:4000`

Si el backend se ejecuta directamente en local:

- API base: `http://localhost:3030/easym/v1`
- Swagger UI: `http://localhost:3030/easym/docs`
- Swagger JSON: `http://localhost:3030/easym/docs.json`
- Healthcheck: `http://localhost:3030/health`

Con el proxy Nginx de Docker, la API se consume bajo `/api`, por ejemplo:

```text
https://localhost:8443/api/easym/v1
https://localhost:8443/api/easym/docs
```

## Frontend local

```bash
cd frontend
pnpm install
pnpm run dev
```

Comandos utiles:

```bash
pnpm run lint
pnpm run build
pnpm run preview
```

Notas:

- El servidor Vite queda en `http://localhost:8080/`.
- Si no se define `VITE_API_BASE_URL`, el frontend apunta por defecto al host actual con puerto `3030`.
- En Docker se usa `VITE_API_BASE_URL=/api` para pasar por el proxy Nginx.

## Backend local

```bash
cd backend
npm install
npm run start
```

Antes de correr fuera de Docker, crear un `.env` en `backend/` con las variables
necesarias. El archivo de referencia existente esta en:

```text
docker/.env_model
```

Variables clave:

- `PORT=3030`
- `URI_MONGO`
- `MARIADB_HOST`
- `MARIADB_PORT`
- `MARIADB_USER`
- `MARIADB_PASSWORD`
- `MARIADB_DATABASE`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `RABBITMQ_HTTP_API`

El backend necesita que MariaDB, MongoDB, RabbitMQ, EMQX y MinIO esten
disponibles si se usan los flujos completos del sistema.

## Documentacion local

```bash
cd docs
pnpm install
pnpm run dev
```

Comandos utiles:

```bash
pnpm run build
pnpm run preview
```

El sitio Astro queda en `http://localhost:4321/`.

## Signer local

La forma mas estable de ejecutar `signer` es con Docker, porque requiere Python,
dependencias de sistema y el helper Node `sigmaker`. Si se necesita correr local:

```powershell
cd signer
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm install
cd sigmaker
npm install
cd ..
python app.py
```

Variables importantes del signer:

- `SIGNER_PORT=4000`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_SPOOL_BUCKET`
- `RABBITMQ_URL`
- `SIGN_REQUEST_QUEUE`
- `SIGN_VALIDATE_REQUEST_QUEUE`

## Seeds, reset y migraciones

Capturar seed desde el ambiente:

```bash
bash scripts/seed-db.sh dev capture
```

Aplicar seed:

```bash
bash scripts/seed-db.sh dev apply
```

Aplicar seed especifico:

```bash
bash scripts/seed-db.sh dev apply --file /app/backend/scripts/seeds/pucese.seed.json
```

Aplicar semilla demo de cuentas, roles, workflow y dossier en QA local:

```powershell
cd docker
docker compose --env-file .env.qa -f compose.base.yml -f compose.proxy.yml -f compose.qa.local.yml exec -T backend node /app/backend/scripts/seed_demo_accounts.mjs
```

La clave por defecto de los usuarios demo es `Deasy1234!`. Para cambiarla en una
ejecucion puntual, definir `DEASY_DEMO_PASSWORD` antes de correr el comando.

Listar migraciones disponibles:

```bash
bash scripts/migrate-db.sh dev --list
```

Ejecutar una migracion:

```bash
bash scripts/migrate-db.sh dev migrate-process-definition-series
```

Reset de MariaDB:

```bash
bash scripts/reset-db.sh dev
```

Notas de seguridad:

- `qa` y `prod` tambien son soportados por estos scripts.
- `prod` exige `DEASY_PROD_DB_APPROVAL_FILE` apuntando a un archivo dentro del repo e ignorado por git.

## Seeds de storage en MinIO

Inicializar buckets y estructura de MinIO:

```bash
bash scripts/docker-env.sh dev --profile storage-init run --rm minio-bootstrap
```

Publicar seeds de plantillas:

```bash
bash scripts/docker-env.sh dev --profile storage-publish-seeds run --rm --no-deps minio-publish-seeds
```

Publicar plantillas generadas:

```bash
bash scripts/docker-env.sh dev --profile storage-publish run --rm --no-deps minio-publish
```

Existe tambien un wrapper legacy para seeds locales:

```powershell
.\scripts\run-seeds.ps1
.\scripts\run-seeds.ps1 -SkipDb
.\scripts\run-seeds.ps1 -SkipStorage
```

En Bash:

```bash
bash scripts/run-seeds.sh
bash scripts/run-seeds.sh --skip-db
bash scripts/run-seeds.sh --skip-storage
```

## Comandos por ambiente

Validar compose:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa config
bash scripts/docker-env.sh prod config
bash scripts/docker-env.sh ingress config
```

Levantar ambientes:

```bash
bash scripts/docker-env.sh dev up -d --build
bash scripts/docker-env.sh qa up -d
bash scripts/docker-env.sh prod up -d
bash scripts/docker-env.sh ingress up -d
```

Actualizar imagenes en `qa` o `prod`:

```bash
bash scripts/docker-env.sh qa pull
bash scripts/docker-env.sh prod pull
```

Desplegar por wrapper:

```bash
bash scripts/deploy-env.sh qa qa
bash scripts/deploy-env.sh prod prod
bash scripts/deploy-env.sh ingress
```

Modo `server-pull`:

```bash
bash scripts/server-pull-deploy.sh qa git
bash scripts/server-pull-deploy.sh prod git
bash scripts/server-pull-deploy.sh qa skip-git qa
DEASY_DRY_RUN=1 bash scripts/server-pull-deploy.sh qa skip-git qa
```

## Builds y validaciones

Frontend:

```bash
cd frontend
pnpm run lint
pnpm run build
```

Docs:

```bash
cd docs
pnpm run build
```

Compose:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa config
bash scripts/docker-env.sh prod config
```

Backend:

```bash
cd backend
npm run start
```

No hay scripts de test o lint declarados en `backend/package.json` al momento de
esta revision. Si se agregan pruebas, conviene seguir el patron local
`*.test.js` o `*.spec.js`.

## Puertos principales por ambiente

Dev:

- Proxy HTTP: `8088`
- Proxy HTTPS: `8443`
- Backend interno: `3030`
- Frontend interno: `8080`
- MariaDB: `3306`
- MongoDB: `27017`
- RabbitMQ AMQP: `5672`
- RabbitMQ UI: `15672`
- EMQX MQTT: `1883`
- EMQX UI: `18083`
- MinIO API: `9000`
- MinIO Console: `9001`
- Signer: `4000`

QA:

- MariaDB: `13306`
- MongoDB: `12717`
- RabbitMQ AMQP: `15672`
- RabbitMQ UI: `15673`
- EMQX MQTT: `11883`
- EMQX UI: `18084`
- MinIO API: `9100`
- MinIO Console: `9101`
- Signer: `14000`

Prod:

- MariaDB: `23306`
- MongoDB: `22717`
- RabbitMQ AMQP: `25672`
- RabbitMQ UI: `25673`
- EMQX MQTT: `21883`
- EMQX UI: `28084`
- MinIO API: `9200`
- MinIO Console: `9201`
- Signer: `24000`

## CI/CD observado

El workflow principal es `.github/workflows/cd-multienv.yml`.

- Push a `develop`: publica imagenes con tag `dev`, sin deploy automatico.
- Push a `qa`: publica imagenes con tag `qa` y despliega si `DEPLOY_DELIVERY_MODE=gh-actions`.
- Push a `main`: publica imagenes con tag `prod` y despliega si `DEPLOY_DELIVERY_MODE=gh-actions`.
- `workflow_dispatch`: permite despliegue manual de `ingress`, `qa` o `prod`.

Imagenes publicadas:

- `deasy-backend`
- `deasy-frontend`
- `deasy-signer`
- `deasy-analytics`

## Notas importantes encontradas

- `docker/docker-compose.yml` sigue existiendo como baseline legacy de dev.
- La ruta recomendada multiambiente es `scripts/docker-env.sh`.
- `backend/README.md` menciona `backend/.env_model`, pero el archivo real encontrado esta en `docker/.env_model`.
- El `README.md` principal referencia documentacion en rutas como `docs/07-despliegue/docker.md`; en el arbol actual esas versiones estan bajo `docs/docs-md-antiguos/`.
- El frontend tiene lint configurado; el backend no declara lint ni tests en `package.json`.
- Para cambios frontend, el comando de validacion principal es `cd frontend && pnpm run lint`.
