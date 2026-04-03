# Manual de CI/CD de Deasy

## 1. Objetivo de este documento

Este documento explica como quedo implementado el CI/CD del proyecto, que
conceptos intervienen, que hace cada archivo y como se opera el flujo.

La idea es que sirva incluso si no manejas todavia conceptos como:

- `CI`
- `CD`
- `registry`
- `imagen Docker`
- `GHCR`
- `GitHub Actions`
- `GitHub Environments`
- `secrets`

Tambien deja claro que parte ya esta automatizada en el repositorio y que parte
todavia requiere configuracion manual dentro de GitHub.

## 2. Glosario base

### CI

`CI` significa `Continuous Integration` o integracion continua.

En terminos practicos:

- cada vez que subes cambios a una rama importante,
- GitHub ejecuta tareas automaticas,
- y valida que el proyecto siga sano.

En este repositorio, CI verifica principalmente:

- lint del frontend,
- validez del `docker compose` de `dev`, `qa` y `prod`,
- construcción de imágenes Docker.

### CD

`CD` significa `Continuous Delivery` o `Continuous Deployment`, segun el nivel de
automatización.

En este caso, CD significa:

- construir imagenes,
- publicarlas en un registro,
- conectarse al servidor,
- y desplegar el ambiente correspondiente.

### Imagen Docker

Una imagen Docker es un paquete ejecutable del software.

Contiene:

- sistema base,
- dependencias,
- código,
- comando de arranque.

Piensa en una imagen como una "foto congelada" de la aplicación lista para
correr.

### Contenedor

Un contenedor es una instancia en ejecución de una imagen.

Ejemplo:

- la imagen `ghcr.io/fresvel/deasy-backend:qa` es el paquete,
- el contenedor `backend` de `qa` es la instancia corriendo.

### Registry

Un `registry` es un almacén de imágenes Docker.

Es el equivalente a:

- `npm registry` para paquetes Node,
- pero aplicado a imágenes Docker.

### GHCR

`GHCR` significa `GitHub Container Registry`.

Es el registry de contenedores de GitHub.

En este proyecto se usa para publicar imágenes como:

- `ghcr.io/fresvel/deasy-backend:dev`
- `ghcr.io/fresvel/deasy-backend:qa`
- `ghcr.io/fresvel/deasy-backend:prod`

Eso significa:

- `ghcr.io`: el servidor del registry,
- `fresvel`: el owner,
- `deasy-backend`: el nombre de la imagen,
- `qa` o `prod`: el tag o versión.

### Tag de imagen

Un `tag` es una etiqueta de versión de una imagen.

Ejemplos:

- `dev`
- `qa`
- `prod`
- `sha-<commit>`

En este repo:

- `dev`, `qa` y `prod` sirven como canales estables por ambiente,
- `sha-<commit>` sirve para identificar una build exacta.

### GitHub Actions

Es el sistema de automatización de GitHub.

Ejecuta workflows definidos en `.github/workflows/*.yml`.

### GitHub Environments

Son entornos lógicos de GitHub para separar configuración sensible por ambiente.

En este caso necesitas al menos:

- `qa`
- `prod`

Cada environment puede tener:

- secrets,
- reglas de aprobación,
- restricciones,
- variables propias.

### Secret

Un `secret` es un valor sensible que no debe ir en el repositorio.

Ejemplos:

- llaves SSH,
- tokens,
- credenciales,
- variables reales de runtime.

## 3. Estado actual del CI/CD

El repositorio ya tiene implementados:

- workflow de CI/CD,
- build y publicación de imágenes,
- despliegue remoto de `qa` y `prod`,
- separación de compose por ambiente,
- consumo de imágenes versionadas desde GHCR,
- wrappers de operación local y remota,
- ramas `develop`, `qa` y `main` alineadas.

Lo que aun falta para dejar el sistema completamente operativo es la
configuración manual en GitHub:

- crear/verificar `GitHub Environments`,
- cargar sus `secrets`.

Sin eso, el workflow existe pero el deploy no puede autenticarse contra el
servidor ni contra GHCR desde el host remoto.

## 4. Mapa de ramas y ambientes

La estrategia actual es:

- `develop` -> `dev`
- `qa` -> `qa`
- `main` -> `prod`

Comportamiento:

- push a `develop`: valida y publica imágenes `dev`, pero no despliega.
- push a `qa`: valida, publica imágenes `qa` y despliega `qa`.
- push a `main`: valida, publica imágenes `prod` y despliega `prod`.

Esto permite:

- usar `develop` como canal de integración,
- usar `qa` como canal de validación,
- usar `main` como canal de producción.

## 5. Archivos principales

### Workflow principal

Archivo:

- [`.github/workflows/cd-multienv.yml`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/.github/workflows/cd-multienv.yml)

Este archivo define toda la automatización de CI/CD.

### Wrapper de compose por ambiente

Archivo:

- [`scripts/docker-env.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/docker-env.sh)

Este script simplifica la ejecución de Docker Compose por ambiente.

En lugar de escribir un comando largo, usas:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa up -d
bash scripts/docker-env.sh prod down
```

### Wrapper de despliegue remoto

Archivo:

- [`scripts/deploy-env.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/deploy-env.sh)

Este script:

- carga el archivo runtime del ambiente si existe,
- sobreescribe tags si se indica uno,
- hace `pull` de imagenes,
- levanta el stack con compose.

### Compose base

Archivo:

- [`docker/compose.base.yml`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docker/compose.base.yml)

Contiene lo comun a todos los ambientes.

### Overrides por ambiente

Archivos:

- [`docker/compose.dev.yml`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docker/compose.dev.yml)
- [`docker/compose.qa.yml`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docker/compose.qa.yml)
- [`docker/compose.prod.yml`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docker/compose.prod.yml)

Diferencias principales:

- `dev` construye localmente y usa mounts.
- `qa` consume imágenes desde GHCR.
- `prod` consume imágenes desde GHCR y agrega hardening.

### Variables por ambiente

Archivos:

- [`docker/.env.dev`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docker/.env.dev)
- [`docker/.env.qa`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docker/.env.qa)
- [`docker/.env.prod`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docker/.env.prod)

## 6. Como funciona el workflow

### Paso 1. Trigger

El workflow se dispara por:

- `push` a `develop`, `qa` o `main`
- `pull_request` hacia `develop`, `qa` o `main`
- `workflow_dispatch` manual

### Paso 2. Prepare

El job `prepare` decide:

- que ambiente corresponde,
- si ese ambiente se despliega o no,
- que tag de imágen se va a usar,
- que `VITE_API_PORT` se necesita para build del frontend.

Reglas actuales:

- `develop` => `dev`, sin deploy
- `qa` => `qa`, con deploy
- `main` => `prod`, con deploy

### Paso 3. Lint

El job `frontend-lint` instala dependencias del frontend y ejecuta:

```bash
pnpm run lint
```

Si esto falla, no sigue.

### Paso 4. Validación compose

El job `compose-validate` ejecuta:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa config
bash scripts/docker-env.sh prod config
```

Eso verifica que los archivos compose resuelvan correctamente.

### Paso 5. Build y publicación

El job `publish-images` construye y publica imágenes a GHCR.

Servicios incluidos:

- `backend`
- `frontend`
- `signer`
- `analytics`

Tags publicados:

- tag de canal: `dev`, `qa` o `prod`
- tag exacto: `sha-<commit>`

Ejemplo:

- `ghcr.io/fresvel/deasy-frontend:qa`
- `ghcr.io/fresvel/deasy-frontend:sha-abc123`

### Paso 6. Deploy

El job `deploy` solo corre en:

- push a `qa`
- push a `main`
- o `workflow_dispatch`

Lo que hace:

1. prepara SSH en el runner,
2. sincroniza `docker/` y `scripts/` al host remoto,
3. sube el archivo de variables runtime del ambiente,
4. hace login a GHCR en el servidor remoto,
5. ejecuta `scripts/deploy-env.sh`.

## 7. Como funciona el deploy remoto

En el servidor remoto, el flujo es este:

1. se recibe `docker/` y `scripts/`,
2. se crea o actualiza `docker/.env.qa.runtime` o `docker/.env.prod.runtime`,
3. el servidor ejecuta:

```bash
bash scripts/deploy-env.sh qa qa
```

o:

```bash
bash scripts/deploy-env.sh prod prod
```

Ese script internamente hace:

```bash
bash scripts/docker-env.sh <ambiente> pull
bash scripts/docker-env.sh <ambiente> --profile workers up -d --remove-orphans
```

Eso significa:

- baja imágenes nuevas,
- recrea contenedores si hace falta,
- elimina contenedores huérfanos.

## 8. Diferencia entre dev, qa y prod

### dev

`dev` es para desarrollo.

Caracteristicas:

- usa `Dockerfile.dev` donde aplica,
- usa bind mounts,
- construye localmente,
- no depende de GHCR,
- no despliega automatico.

### qa

`qa` es para validacion.

Caracteristicas:

- consume imagenes ya publicadas,
- tiene puertos propios,
- tiene redes y volumenes propios,
- se despliega automatico al hacer push a `qa`.

### prod

`prod` es produccion.

Caracteristicas:

- consume imagenes desde GHCR,
- tiene puertos propios,
- tiene hardening adicional,
- agrega healthchecks,
- usa `restart: always`,
- aplica restricciones como `no-new-privileges`,
- el frontend corre en `read_only`.

## 9. Que significa que qa y prod usen imagenes en vez de build local

Antes, el servidor podia necesitar construir el proyecto en el mismo host.

Ahora el modelo es mejor:

1. GitHub construye las imagenes.
2. GitHub las publica en GHCR.
3. El servidor solo descarga la imagen lista.
4. El servidor levanta contenedores.

Ventajas:

- despliegue mas predecible,
- menos dependencias instaladas en el servidor,
- menos diferencias entre una corrida y otra,
- posibilidad de volver a una imagen exacta.

## 10. Secrets que faltan en GitHub

Para que el deploy funcione de verdad, debes crear `Environments`:

- `qa`
- `prod`

Y dentro de cada uno cargar estos `secrets`:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_USERNAME`
- `GHCR_TOKEN`
- `RUNTIME_ENV_FILE`

### Que significa cada secret

#### DEPLOY_HOST

IP o hostname del servidor remoto.

Ejemplo:

```text
mi-servidor.ejemplo.com
```

#### DEPLOY_USER

Usuario con el que GitHub se conectara por SSH.

Ejemplo:

```text
deployer
```

#### DEPLOY_SSH_KEY

Clave privada SSH que el runner usara para entrar al servidor.

Debe corresponder a una clave publica ya autorizada en el servidor remoto.

#### DEPLOY_PATH

Ruta del proyecto en el servidor.

Ejemplo:

```text
/opt/deasy
```

Dentro de esa ruta, el workflow crea:

- `/opt/deasy/docker`
- `/opt/deasy/scripts`

#### GHCR_USERNAME

Usuario que tiene permiso para hacer `docker login` en GHCR desde el servidor.

Normalmente es tu usuario de GitHub o una cuenta técnica.

#### GHCR_TOKEN

Token con permisos para leer paquetes del registry.

Como mínimo debe permitir descargar imagenes privadas si aplica.

#### RUNTIME_ENV_FILE

Este es uno de los secretos mas importantes.

No es un nombre de archivo: es el contenido completo del archivo `.env` real del
ambiente.

Por ejemplo, para `qa`, GitHub toma ese contenido y lo escribe en el servidor
como:

```text
docker/.env.qa.runtime
```

Y para `prod`:

```text
docker/.env.prod.runtime
```

Ese archivo debe contener las variables reales, por ejemplo:

- passwords reales,
- endpoints reales,
- credenciales reales,
- cualquier override sensible.

## 11. Como crear los Environments en GitHub

Esto se hace manualmente en la interfaz web del repositorio.

Ruta general:

1. entrar al repositorio en GitHub,
2. `Settings`,
3. `Environments`,
4. crear `qa`,
5. crear `prod`,
6. cargar sus `secrets`.

Si quieres endurecer mas el flujo, puedes ademas:

- pedir aprobacion manual para `prod`,
- limitar que ramas pueden desplegar,
- exigir revisores.

## 12. Como operar el sistema manualmente

### Validar compose

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa config
bash scripts/docker-env.sh prod config
```

### Levantar un ambiente local

```bash
bash scripts/docker-env.sh dev up -d
```

### Bajar un ambiente

```bash
bash scripts/docker-env.sh qa down
```

### Traer imagenes de qa o prod

```bash
bash scripts/docker-env.sh qa pull
bash scripts/docker-env.sh prod pull
```

### Desplegar manualmente en un servidor ya preparado

```bash
bash scripts/deploy-env.sh qa qa
bash scripts/deploy-env.sh prod prod
```

### Desplegar un tag puntual

```bash
bash scripts/deploy-env.sh qa sha-abc123
```

Eso fuerza a usar ese tag para:

- backend
- frontend
- signer
- analytics

## 13. Como se hace un redeploy manual desde GitHub

El workflow soporta `workflow_dispatch`.

Eso sirve para:

- volver a desplegar sin hacer un nuevo commit,
- indicar un tag concreto.

Casos tipicos:

- redeploy de `qa` con `qa`
- rollback a un tag `sha-...`
- redeploy de `prod` por incidente operativo

## 14. Rollback

Rollback significa volver a una version anterior.

En este sistema tienes dos opciones:

### Opcion 1. Rehacer deploy con un tag sha

Ejemplo:

- `sha-abc123`

Ventaja:

- no necesitas reescribir ramas,
- el rollback es preciso.

### Opcion 2. Crear un nuevo commit correctivo

Ventaja:

- mantiene la historia normal del repositorio.

En general, en produccion suele ser preferible:

- rollback rapido con tag,
- luego commit correctivo ordenado.

## 15. Seguridad

### Lo correcto

- secrets fuera del repositorio,
- variables sensibles en GitHub Environments,
- despliegue por SSH con clave dedicada,
- login a GHCR con token controlado.

### Lo incorrecto

- poner API keys en codigo,
- poner passwords en `.env` versionados si son reales,
- meter llaves privadas en archivos del repo,
- compartir un mismo secreto entre todos los ambientes si no hace falta.

## 16. Incidente de secreto ya remediado

El repositorio tuvo una fuga historica de una key de Groq en commits viejos.

Se hizo esta remediacion:

- registro del incidente,
- purga del valor del historial accesible,
- republicacion de referencias afectadas,
- verificacion de que el patron ya no aparece en `git rev-list --all`.

Lo que todavia debes hacer fuera del repo es:

- revocar esa key en Groq,
- generar una nueva si la necesitas,
- cerrar la alerta de GitHub como `revoked`.

## 17. Que falta para considerar CI/CD completamente operativo

Tecnologicamente, la base ya esta implementada.

Para considerarlo completamente operativo faltan estas acciones manuales:

1. crear `qa` y `prod` en `GitHub Environments`,
2. cargar todos los `secrets`,
3. verificar que el servidor remoto tenga:
   - `docker`
   - `docker compose`
   - `rsync`
   - acceso SSH correcto
4. probar un deploy real a `qa`,
5. probar un deploy real a `prod` cuando corresponda.

## 18. Como saber si todo esta bien

Checklist minimo:

### CI

- push a `develop`
- workflow exitoso
- imagenes `dev` publicadas en GHCR

### QA

- push a `qa`
- workflow exitoso
- imagenes `qa` publicadas en GHCR
- servidor `qa` actualizado

### PROD

- push a `main`
- workflow exitoso
- imagenes `prod` publicadas en GHCR
- servidor `prod` actualizado

## 19. Resumen corto

El sistema ya esta diseñado para funcionar asi:

- GitHub Actions valida,
- construye imagenes,
- publica imagenes a GHCR,
- y despliega `qa` o `prod` por SSH.

`develop` sirve para integracion y publicacion de imagenes `dev`.

`qa` y `main` son las ramas que activan deploy.

La unica parte que no vive en git y aun requiere accion manual es la
configuracion de `GitHub Environments` y sus `secrets`.
