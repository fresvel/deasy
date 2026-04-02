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

## Preparacion para CI/CD

Se agrega una base inicial para automatizacion:

- workflow de GitHub Actions en `.github/workflows/docker-multienv.yml`
- validacion de compose para `dev`, `qa` y `prod`
- lint de frontend
- build de imagenes estables de `backend`, `frontend` y `signer`
- script operativo `scripts/docker-env.sh` para estandarizar comandos por
  ambiente y reutilizar la misma interfaz en CI y operacion manual

Comandos ejemplo:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa up -d
bash scripts/docker-env.sh prod down
```

La publicacion a registry no se activa todavia, pero el workflow ya deja el
repositorio preparado para ese paso posterior sin depender de builds manuales
locales para validar `qa` y `prod`.

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
