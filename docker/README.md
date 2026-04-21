# Docker Environments

## Declaracion formal del estado actual

El stack actual definido en `docker/docker-compose.yml` equivale formalmente al
ambiente `dev`.

Se considera `dev` porque hoy:

- usa bind mounts del codigo fuente local,
- ejecuta servicios orientados a desarrollo interactivo,
- concentra configuracion en un unico archivo `.env`,
- no separa todavia recursos, redes ni compose por ambiente.

## Decision de transicion

Mientras se completa la migracion multiambiente:

- `docker/docker-compose.yml` se toma como baseline de `dev`,
- `docker/.env` se mantiene como compatibilidad temporal del stack actual,
- `docker/.env.dev`, `docker/.env.qa` y `docker/.env.prod` pasan a ser la base
  de configuracion por ambiente,
- los siguientes pasos moveran la ejecucion a `compose.base.yml` y overrides por
  ambiente siguiendo buenas practicas validadas con Context7 para Docker
  Compose.

## Uso actual de dev

La nueva ruta de ejecucion de `dev` queda asi:

```bash
docker compose \
  --env-file .env.dev \
  -f compose.base.yml \
  -f compose.dev.yml \
  up -d
```

`docker/docker-compose.yml` se conserva temporalmente como referencia del stack
anterior mientras termina la migracion de los siguientes puntos.

## Aislamiento de persistencia y proyecto

Cada override de ambiente define ahora:

- un `name` propio de Compose,
- nombres explicitos de volumen por ambiente.

Mapa actual:

- `dev` -> proyecto `deasy-dev`
- `qa` -> proyecto `deasy-qa`
- `prod` -> proyecto `deasy-prod`

Con esto, MariaDB, MongoDB, RabbitMQ, EMQX, MinIO, uploads y storage quedan
aislados por stack aunque los ambientes convivan en el mismo host.

## Matriz de puertos y redes

Cada ambiente expone puertos distintos y una red propia:

- `dev` usa red `deasy_dev_network`
- `qa` usa red `deasy_qa_network`
- `prod` usa red `deasy_prod_network`

Puertos de referencia:

- `dev`: backend `3030`, frontend `8080`, MariaDB `3306`, MongoDB `27017`,
  RabbitMQ AMQP `5672`, RabbitMQ UI `15672`, EMQX MQTT `1883`, EMQX UI `18083`,
  MinIO API `9000`, MinIO Console `9001`, signer `4000`
- `qa`: backend `3130`, frontend `8180`, MariaDB `13306`, MongoDB `12717`,
  RabbitMQ AMQP `15672`, RabbitMQ UI `15673`, EMQX MQTT `11883`, EMQX UI
  `18084`, MinIO API `9100`, MinIO Console `9101`, signer `14000`
- `prod`: backend `3230`, frontend `8280`, MariaDB `23306`, MongoDB `22717`,
  RabbitMQ AMQP `25672`, RabbitMQ UI `25673`, EMQX MQTT `21883`, EMQX UI
  `28084`, MinIO API `9200`, MinIO Console `9201`, signer `24000`

## Uso previsto por ambiente

`dev`:

```bash
docker compose \
  --env-file .env.dev \
  -f compose.base.yml \
  -f compose.dev.yml \
  up -d
```

`qa`:

```bash
docker compose \
  --env-file .env.qa \
  -f compose.base.yml \
  -f compose.qa.yml \
  up -d
```

`prod`:

```bash
docker compose \
  --env-file .env.prod \
  -f compose.base.yml \
  -f compose.prod.yml \
  up -d
```

Nota temporal:

- `qa` y `prod` ya no usan bind mounts de codigo local en sus overrides.
- `backend` y `frontend` todavia dependen de Dockerfiles orientados a desarrollo.
- Los puntos `7` a `10` completaran esa neutralizacion para que `qa` y `prod`
  queden realmente estables.

## Evaluacion de variantes dev

### Docs

Decision: `condicional`, no se crea `Dockerfile.dev` en este paso.

Fundamento:

- `docs` no forma parte todavia del stack Compose multiambiente actual.
- El proyecto tiene scripts separados de `astro dev` y `astro build`, asi que si
  en el futuro se dockeriza dentro del stack, probablemente si convendra separar
  una variante `dev` y otra estable.
- Mientras no entre al Compose operativo, no agrega valor crear esa variante.

### Signer

Decision: `no requiere Dockerfile.dev` por ahora.

Fundamento:

- `signer` es un servicio operativo especializado, no una superficie de
  desarrollo interactivo diaria como `backend` o `frontend`.
- Su ejecucion ya esta pensada como proceso estable con dependencias de sistema
  y de firma.
- Agregar hot reload o un contenedor `dev` separado hoy aumentaria complejidad
  sin una necesidad clara del flujo de trabajo.

### Analytics

Decision: `no requiere Dockerfile.dev` por ahora.

Fundamento:

- `analytics` hoy es un placeholder muy simple y no expone tooling de
  desarrollo interactivo.
- No hay evidencia de un ciclo de cambio rapido dentro del contenedor que
  justifique una variante `dev`.
- Mantener un solo Dockerfile reduce ruido mientras el servicio madura.

## Politica de ramas por ambiente

Mapa objetivo:

- `develop` -> ambiente `dev`
- `qa` -> ambiente `qa`
- `main` -> ambiente `prod`

Estado actual:

- la rama activa de trabajo sigue siendo `develop`
- la rama local `qa` ya fue creada para formalizar el flujo intermedio
- `main` permanece como rama de produccion

Flujo recomendado:

1. Integrar trabajo diario en `develop`.
2. Promover a `qa` cuando un conjunto de cambios quede listo para validacion.
3. Promover de `qa` a `main` cuando la validacion previa a produccion cierre.

Nota:

- En este paso solo se alineo la estrategia local del repositorio.
- No se hizo push de la rama `qa` al remoto ni se configuraron protecciones.

## Ajuste temporal previo a CD

Antes de activar CD real, la estrategia temporal queda asi:

- `develop` sigue siendo la rama fuente actual
- `qa` se realinea temporalmente para partir del mismo commit de `develop`
- `main` se realinea temporalmente para partir del mismo commit de `develop`
- los estados anteriores de ramas desfasadas se preservan en ramas
  `deprecated/*`

La intencion es evitar activar CD sobre una `main` historicamente atrasada o una
`qa` no confiable, y pasar primero por una etapa de convergencia controlada.

## Preparacion para CI/CD

Se agrega una base inicial para automatizacion:

- workflow de GitHub Actions en `.github/workflows/cd-multienv.yml`
- validacion de compose para `dev`, `qa` y `prod`
- lint de frontend
- build y publicacion de imagenes estables en GHCR para `backend`, `frontend`,
  `signer` y `analytics`
- script operativo `scripts/docker-env.sh` para estandarizar comandos por
  ambiente y reutilizar la misma interfaz en CI y operacion manual
- script `scripts/deploy-env.sh` para despliegue remoto de `qa` y `prod`

Comandos ejemplo:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa up -d
bash scripts/docker-env.sh prod down
```

Con el flujo final de CD, `develop` publica imagenes `dev` en GHCR sin hacer
deploy automatico, mientras `qa` y `main` publican y despliegan sus ambientes.

## CD real por ambiente

El flujo de CD queda asi:

- `push` a `develop`:
  - publica imagenes con tag `dev` en GHCR
  - no despliega automaticamente
- `push` a `qa`:
  - publica imagenes con tag `qa` en GHCR
  - despliega el ambiente `qa`
- `push` a `main`:
  - publica imagenes con tag `prod` en GHCR
  - despliega el ambiente `prod`
- `workflow_dispatch`:
  - permite redeploy manual a `qa` o `prod`
  - permite indicar un `image_tag` especifico

`qa` y `prod` ya no dependen de `build` local en Compose. Ahora consumen
imagenes versionadas desde GHCR mediante variables de entorno por servicio.

El job de deploy por SSH desde GitHub Actions queda condicionado por la variable
de GitHub:

- `DEPLOY_DELIVERY_MODE=gh-actions`

Si esa variable no existe o tiene otro valor, el workflow mantiene CI y
publicacion de imagenes, pero no intenta entrar al host remoto.

## Estrategia dual de despliegue

La estrategia operativa deja dos modos compatibles:

- `gh-actions`: GitHub publica imagenes, entra por SSH al host y ejecuta el
  despliegue remoto.
- `server-pull`: el propio servidor actualiza codigo o artefactos y luego
  ejecuta el despliegue localmente.

La logica comun del stack queda centralizada en `scripts/apply-env.sh`.

Wrappers actuales:

- `scripts/deploy-env.sh`: compatibilidad para el flujo iniciado por GitHub
  Actions.

## Proxy reverso Nginx

El stack multiambiente publica ahora el acceso cliente a traves de
`nginx-proxy`, que termina TLS y enruta internamente hacia:

- `frontend:8080`
- `backend:3030` mediante prefijo `/api/`

El backend ya no se publica directamente en host en los overrides por
ambiente. La matriz publica del proxy queda asi:

- `dev`: HTTP `8088`, HTTPS `8443`
- `qa`: HTTP `9088`, HTTPS `9443`
- `prod`: HTTP `80`, HTTPS `443`

Los certificados se resuelven por ambiente desde la raiz del repositorio:

- `nginx/certs/dev`
- `nginx/certs/qa`
- `nginx/certs/prod`

La validacion base sigue siendo:

```bash
bash scripts/docker-env.sh dev up -d --build
```
- `scripts/docker-env.sh`: interfaz comun para ejecutar compose por ambiente.
- `scripts/seed-db.sh`: ejecuta `seed_pucese.mjs` dentro del contenedor
  `backend` por ambiente.
- `scripts/reset-db.sh`: ejecuta `reset_mariadb.mjs` dentro del contenedor
  `backend` por ambiente.
- `scripts/migrate-db.sh`: ejecuta migraciones SQL de `backend/scripts/`
  dentro del contenedor `backend`.

Esta separacion evita duplicar logica de despliegue entre CI/CD y operacion
manual o programada desde el servidor.

Ejemplos:

```bash
bash scripts/seed-db.sh dev capture
bash scripts/reset-db.sh qa
bash scripts/migrate-db.sh dev --list
```

Politica de prod para operaciones DB:

- `prod` no se ejecuta por defecto.
- requiere `DEASY_PROD_DB_APPROVAL_FILE`
- el archivo debe existir dentro del repo y estar ignorado por git

## Modo server-pull

Para hosts sin IP publica estatica, el servidor puede iniciar su propia
actualizacion usando:

- `scripts/server-pull-deploy.sh`
- o unidades `systemd` basadas en `deploy/systemd/`

Ejemplos manuales:

```bash
bash scripts/server-pull-deploy.sh qa git
bash scripts/server-pull-deploy.sh prod git
bash scripts/server-pull-deploy.sh qa skip-git sha-abc123
DEASY_DRY_RUN=1 bash scripts/server-pull-deploy.sh qa skip-git qa
DEASY_DRY_RUN=1 bash scripts/server-pull-deploy.sh prod skip-git prod
```

Reglas del modo `git`:

- `qa` espera checkout en rama `qa`
- `prod` espera checkout en rama `main`
- falla si el repo tiene cambios locales
- usa `git pull --ff-only` para evitar merges implicitos

Base `systemd` incluida:

- `deploy/systemd/deasy-server-pull@.service`
- `deploy/systemd/deasy-server-pull@.timer`

La ruta por SSH se conserva lista para reactivarse mas adelante definiendo
`DEPLOY_DELIVERY_MODE=gh-actions`.

Estado practico actual:

- operativo hoy para CI y publicacion de imagenes
- operativo hoy para despliegue `server-pull`
- pendiente de infraestructura para despliegue `gh-actions` por SSH

Secrets requeridos en GitHub Environments:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_USERNAME`
- `GHCR_TOKEN`
- `RUNTIME_ENV_FILE`

Notas operativas:

- `RUNTIME_ENV_FILE` debe contener las variables reales del ambiente, fuera del
  repositorio.
- `DEPLOY_PATH` es el directorio remoto donde se sincronizan `docker/` y
  `scripts/`.
- el runner hace login en GHCR sobre el host remoto y ejecuta
  `scripts/deploy-env.sh`.

## Endurecimiento inicial de prod

Se aplican medidas iniciales de endurecimiento en `compose.prod.yml`:

- healthcheck HTTP para `backend`
- healthcheck HTTP para `frontend`
- healthcheck HTTP para `signer`
- `no-new-privileges` en servicios aplicables de `prod`
- `frontend` en modo `read_only` con `tmpfs` para rutas temporales
- `signer` con `tmpfs` para `/tmp`
- correccion del Dockerfile principal de `signer` para ejecutar el servicio real
  (`python app.py`) en lugar de un contenedor placeholder

Estas medidas no agotan el hardening, pero dejan a `prod` en un estado
operativamente mas serio y verificable.
