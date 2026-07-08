# Comandos clave del proyecto Deasy

Ultima revision local: 2026-05-05

Este archivo resume el analisis operativo del repositorio y los comandos mas
importantes para levantar, validar y administrar el proyecto. La fuente principal
de estos comandos son `package.json`, `Dockerfile`, `docker/README.md`,
`docker/compose*.yml`, `README.md` y los scripts de `scripts/`.

## Analisis rapido

El repositorio esta organizado como un monorepo con capas separadas:

- `frontend/`: aplicacion web en Vue 3, Vite y TailwindCSS. Usa `pnpm`.
- `backend/`: API Express en ESM. Usa `npm` y expone la API bajo `/deasy/v1`.
- `docs/`: sitio de documentacion en Astro Starlight. Usa `pnpm`.
- `signer/`: servicio de firma digital con Python, `pyhanko`, MinIO y un helper Node en `sigmaker/`.
- `docker/`: composicion de servicios para PostgreSQL, RabbitMQ, MinIO, Nginx, backend, frontend, signer y analytics. El chat en tiempo real usa WebSockets (Socket.IO) dentro del backend, sin broker externo.
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
- API via proxy: `https://localhost:9443/api/deasy/v1`
- Swagger UI: `https://localhost:9443/api/deasy/docs`
- MinIO API: `http://localhost:9100`
- MinIO Console: `http://localhost:9101`
- RabbitMQ UI: `http://localhost:15673`
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

## URLs utiles en desarrollo

Con el stack Docker de `dev`:

- Aplicacion via proxy HTTP: `http://localhost:8088`
- Aplicacion via proxy HTTPS: `https://localhost:8443`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- RabbitMQ UI: `http://localhost:15672`
- Signer: `http://localhost:4000`

Si el backend se ejecuta directamente en local:

- API base: `http://localhost:3030/deasy/v1`
- Swagger UI: `http://localhost:3030/deasy/docs`
- Swagger JSON: `http://localhost:3030/deasy/docs.json`
- Healthcheck: `http://localhost:3030/health`

Con el proxy Nginx de Docker, la API se consume bajo `/api`, por ejemplo:

```text
https://localhost:8443/api/deasy/v1
https://localhost:8443/api/deasy/docs
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
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `RABBITMQ_HTTP_API`

El backend necesita que PostgreSQL, RabbitMQ y MinIO esten
disponibles si se usan los flujos completos del sistema. El chat en tiempo real
se sirve por WebSockets (Socket.IO) desde el propio backend.

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

### Seed SQL de PostgreSQL

Estos comandos trabajan con datos SQL, no con archivos de plantillas en MinIO.
Sirven para capturar o aplicar el snapshot `backend/scripts/seeds/pucese.seed.json`
contra la base PostgreSQL del ambiente indicado.

Capturar seed desde `dev`:

```bash
bash scripts/seed-db.sh dev capture
```

Aplicar seed en `dev`:

```bash
bash scripts/seed-db.sh dev apply
```

Si estas trabajando en QA local, usa `qa-local`, no `dev`:

```bash
bash scripts/seed-db.sh qa-local capture
bash scripts/seed-db.sh qa-local apply
```

Si se debe usar una semilla base compartida y solo agregar permisos/roles sin
reemplazar usuarios existentes, aplica primero la semilla y luego el patch RBAC:

```bash
bash scripts/seed-db.sh qa-local apply
bash scripts/seed-db.sh qa-local rbac
```

Aplicar seed especifico dentro del contenedor backend:

```bash
bash scripts/seed-db.sh dev apply --file /app/backend/scripts/seeds/pucese.seed.json
```

Notas importantes:

- `capture` lee la base PostgreSQL actual y escribe el JSON de semilla.
- `apply` borra y reinserta las tablas incluidas en el JSON; no lo uses sobre datos que quieras conservar.
- `rbac` crea/actualiza roles, recursos, acciones, permisos, permisos por rol y asignaciones derivadas desde cargos existentes.
- Si solo levantaste QA local con `bash scripts/docker-env.sh qa-local up -d --build`, el comando `bash scripts/seed-db.sh dev apply` no encuentra el backend de `dev`.
- Para QA local el comando correcto es `bash scripts/seed-db.sh qa-local apply`.
- Estos comandos no suben archivos de plantillas a MinIO.

Aplicar semilla demo de cuentas, roles, workflow y dossier en QA local:

```powershell
cd docker
docker compose --env-file .env.qa -f compose.base.yml -f compose.proxy.yml -f compose.qa.local.yml exec -T backend node /app/backend/scripts/seed_demo_accounts.mjs
```

La clave por defecto de los usuarios demo es `Deasy1234!`. Para cambiarla en una
ejecucion puntual, definir `DEASY_DEMO_PASSWORD` antes de correr el comando.

El mecanismo de migraciones incrementales fue retirado con la
migracion a PostgreSQL: `backend/database/postgres_schema.sql` es la unica fuente
de verdad del esquema (se aplica al arrancar via `ensurePostgresSchema`).

Reset de PostgreSQL:

```bash
bash scripts/reset-db.sh dev
```

Notas de seguridad:

- `qa` y `prod` tambien son soportados por estos scripts.
- `prod` exige `DEASY_PROD_DB_APPROVAL_FILE` apuntando a un archivo dentro del repo e ignorado por git.

## Seeds de storage en MinIO

Estos comandos son los que publican archivos de plantillas en MinIO. Son
distintos a `seed-db.sh`.

Inicializar buckets y estructura de MinIO en `dev`:

```bash
bash scripts/docker-env.sh dev --profile storage-init run --rm minio-bootstrap
```

Publicar seeds de plantillas en `dev`:

```bash
bash scripts/docker-env.sh dev --profile storage-publish-seeds run --rm --no-deps minio-publish-seeds
```

Publicar plantillas generadas en `dev`:

```bash
bash scripts/docker-env.sh dev --profile storage-publish run --rm --no-deps minio-publish
```

Equivalentes para QA local:

```bash
bash scripts/docker-env.sh qa-local --profile storage-init run --rm minio-bootstrap
bash scripts/docker-env.sh qa-local --profile storage-publish-seeds run --rm --no-deps minio-publish-seeds
bash scripts/docker-env.sh qa-local --profile storage-publish run --rm --no-deps minio-publish
```

El comando `storage-publish-seeds` toma los archivos desde
`tools/templates/seeds/` y los sube al bucket configurado en
`MINIO_TEMPLATES_BUCKET`, bajo el prefijo `MINIO_TEMPLATES_SEEDS_PREFIX`.
El comando `storage-publish` toma archivos desde `tools/templates/dist/Plantillas`;
si esa carpeta no existe o esta vacia, primero hay que generar las plantillas.

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
- PostgreSQL: `5432`
- RabbitMQ AMQP: `5672`
- RabbitMQ UI: `15672`
- MinIO API: `9000`
- MinIO Console: `9001`
- Signer: `4000`

QA:

- PostgreSQL: `15432`
- RabbitMQ AMQP: `15672`
- RabbitMQ UI: `15673`
- MinIO API: `9100`
- MinIO Console: `9101`
- Signer: `14000`

Prod:

- PostgreSQL: `25432`
- RabbitMQ AMQP: `25672`
- RabbitMQ UI: `25673`
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

- El unico stack es `docker/compose.base.yml` con overlays por ambiente; se ejecuta via `scripts/docker-env.sh`.
- El motor de datos es PostgreSQL unicamente (MariaDB y MongoDB fueron retirados).
- `backend/README.md` menciona `backend/.env_model`, pero el archivo real encontrado esta en `docker/.env_model`.
- El `README.md` principal referencia documentacion en rutas como `docs/07-despliegue/docker.md`; en el arbol actual esas versiones estan bajo `docs/docs-md-antiguos/`.
- El frontend tiene lint configurado; el backend no declara lint ni tests en `package.json`.
- Para cambios frontend, el comando de validacion principal es `cd frontend && pnpm run lint`.
