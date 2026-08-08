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
- RabbitMQ UI: `http://127.0.0.1:15672` (**solo dev, y solo desde la propia maquina**)
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

## Reset y estado inicial

### El estado inicial lo produce el bootstrap

Ya no hay seed SQL: no existe ningun snapshot que capturar ni aplicar. El estado
inicial del sistema lo crea el **bootstrap**, desde la UI en `/setup` o llamando
directamente a `POST /deasy/v1/system/bootstrap/initialize`. Sobre una base vacia
el backend detecta la instalacion virgen y la UI pide crear el primer
administrador.

Las credenciales de los usuarios que crea el bootstrap estan en
`docs/03-backend/seed-users-dev.md`.

El mecanismo de migraciones incrementales fue retirado con la
migracion a PostgreSQL: `backend/database/postgres_schema.sql` es la unica fuente
de verdad del esquema (se aplica al arrancar via `ensurePostgresSchema`).

### Reset de PostgreSQL

Resetea el esquema PostgreSQL del ambiente:

```bash
bash scripts/reset-db.sh dev
```

### Reset total del sistema

Dropea todas las tablas de PostgreSQL, vacia los buckets gestionados de MinIO y
recicla los servicios de app (`backend` y `signer`) para que reconecten en limpio;
el backend vuelve a modo bootstrap:

```bash
bash scripts/reset-system.sh dev
```

Flags soportados:

- `--keep-db`: conserva PostgreSQL.
- `--keep-minio`: conserva los buckets de MinIO.
- `--rebuild`: reconstruye las imagenes y recrea los servicios en vez de solo reiniciarlos (para `qa`/`prod` o cuando cambien dependencias).
- `--no-restart`: no toca los servicios; habra que reiniciar el backend a mano.

### Fixture de desarrollo

Carga un juego de datos rico (procesos, plantillas, entregables) sobre un sistema
ya inicializado por el bootstrap. Solo para `dev`:

```bash
bash scripts/docker-env.sh dev exec -T backend node /app/backend/scripts/seed_dev_rich.mjs
```

Notas de seguridad:

- `qa` y `prod` tambien son soportados por estos scripts.
- `prod` exige `DEASY_PROD_DB_APPROVAL_FILE` apuntando a un archivo dentro del repo e ignorado por git.

## Seeds de storage en MinIO

Estos comandos son los que publican archivos de plantillas en MinIO; no tocan
datos de PostgreSQL.

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
- RabbitMQ AMQP: `5672` — **enlazado a `127.0.0.1`**
- RabbitMQ UI: `15672` — **enlazado a `127.0.0.1`**
- MinIO API: `9000`
- MinIO Console: `9001`
- Signer: `4000`

QA:

- PostgreSQL: `15432`
- RabbitMQ: **no se publica** (ver el aviso de abajo)
- MinIO API: `9100`
- MinIO Console: `9101`
- Signer: `14000`

Prod:

- PostgreSQL: `25432`
- RabbitMQ: **no se publica** (ver el aviso de abajo)
- MinIO API: `9200`
- MinIO Console: `9201`
- Signer: `24000`

> ### RabbitMQ ya NO se publica al host (2026-08-08)
>
> Hasta esa fecha el broker se publicaba en **todas** las interfaces en dev, qa y prod, con el
> usuario `guest` como administrador y la proteccion de loopback desactivada. Como la interfaz de
> gestion muestra el **cuerpo** de los mensajes, y la contrasena del PKCS#12 del firmante
> (`certPassword`) viaja ahi dentro, eso dejaba las claves de firma al alcance de cualquiera que
> llegase al puerto.
>
> Hoy: en **qa y prod no se publica ningun puerto** del broker, y en **dev van enlazados a
> `127.0.0.1`**. Backend y signer lo alcanzan por la red interna de compose
> (`rabbitmq:5672`, `http://rabbitmq:15672/api`), que es lo que ya hacian: los puertos del host no
> daban servicio a nadie. El usuario `guest` esta retirado; se conectan con
> `RABBITMQ_USER` / `RABBITMQ_PASSWORD`.
>
> En un entorno ya desplegado hay que crear el usuario **antes** de recrear los servicios, porque
> `RABBITMQ_DEFAULT_USER` solo actua en el primer arranque con el volumen vacio:
>
> ```bash
> bash scripts/rabbitmq-migrar-usuario.sh prod
> bash scripts/docker-env.sh prod up -d backend signer   # `restart` NO vale: reutiliza el entorno viejo
> ```

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
