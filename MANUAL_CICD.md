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
- construccion de imagenes Docker.

### CD

`CD` significa `Continuous Delivery` o `Continuous Deployment`, segun el nivel de
automatizacion.

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
- codigo,
- comando de arranque.

Piensa en una imagen como una "foto congelada" de la aplicacion lista para
correr.

### Contenedor

Un contenedor es una instancia en ejecucion de una imagen.

Ejemplo:

- la imagen `ghcr.io/fresvel/deasy-backend:qa` es el paquete,
- el contenedor `backend` de `qa` es la instancia corriendo.

### Registry

Un `registry` es un almacen de imagenes Docker.

Es el equivalente a:

- `npm registry` para paquetes Node,
- pero aplicado a imagenes Docker.

### GHCR

`GHCR` significa `GitHub Container Registry`.

Es el registry de contenedores de GitHub.

En este proyecto se usa para publicar imagenes como:

- `ghcr.io/fresvel/deasy-backend:dev`
- `ghcr.io/fresvel/deasy-backend:qa`
- `ghcr.io/fresvel/deasy-backend:prod`

Eso significa:

- `ghcr.io`: el servidor del registry,
- `fresvel`: el owner,
- `deasy-backend`: el nombre de la imagen,
- `qa` o `prod`: el tag o version.

### Tag de imagen

Un `tag` es una etiqueta de version de una imagen.

Ejemplos:

- `dev`
- `qa`
- `prod`
- `sha-<commit>`

En este repo:

- `dev`, `qa` y `prod` sirven como canales estables por ambiente,
- `sha-<commit>` sirve para identificar una build exacta.

### GitHub Actions

Es el sistema de automatizacion de GitHub.

Ejecuta workflows definidos en `.github/workflows/*.yml`.

### GitHub Environments

Son entornos lógicos de GitHub para separar configuracion sensible por ambiente.

En este caso necesitas al menos:

- `qa`
- `prod`

Cada environment puede tener:

- secrets,
- reglas de aprobacion,
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
- build y publicacion de imagenes,
- despliegue remoto de `qa` y `prod`,
- separacion de compose por ambiente,
- consumo de imagenes versionadas desde GHCR,
- wrappers de operacion local y remota,
- ramas `develop`, `qa` y `main` alineadas.

Lo que aun falta para dejar el sistema completamente operativo es la
configuracion manual en GitHub:

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

- push a `develop`: valida y publica imagenes `dev`, pero no despliega.
- push a `qa`: valida, publica imagenes `qa` y despliega `qa`.
- push a `main`: valida, publica imagenes `prod` y despliega `prod`.

Esto permite:

- usar `develop` como canal de integracion,
- usar `qa` como canal de validacion,
- usar `main` como canal de produccion.

## 5. Archivos principales

### Workflow principal

Archivo:

- [`.github/workflows/cd-multienv.yml`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/.github/workflows/cd-multienv.yml)

Este archivo define toda la automatizacion de CI/CD.

### Wrapper de compose por ambiente

Archivo:

- [`scripts/docker-env.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/docker-env.sh)

Este script simplifica la ejecucion de Docker Compose por ambiente.

En lugar de escribir un comando largo, usas:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa up -d
bash scripts/docker-env.sh prod down
```

### Wrapper de despliegue comun

Archivo:

- [`scripts/apply-env.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/apply-env.sh)

Este script concentra la logica comun de despliegue para `qa` y `prod`.

Su objetivo es evitar que existan dos implementaciones distintas:

- una para GitHub Actions,
- otra para el servidor.

Recibe:

- ambiente,
- modo de origen del despliegue,
- tag opcional de imagen.

Modos actuales previstos:

- `gh-actions`
- `server-pull`

### Wrapper de despliegue remoto por GitHub Actions

Archivo:

- [`scripts/deploy-env.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/deploy-env.sh)

Este script ya no contiene la logica principal; ahora actua como wrapper de
compatibilidad para el flujo iniciado desde GitHub Actions y delega en
`scripts/apply-env.sh`.

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
- `qa` consume imagenes desde GHCR.
- `prod` consume imagenes desde GHCR y agrega hardening.

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
- que tag de imagen se va a usar,
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

### Paso 4. Validacion compose

El job `compose-validate` ejecuta:

```bash
bash scripts/docker-env.sh dev config
bash scripts/docker-env.sh qa config
bash scripts/docker-env.sh prod config
```

Eso verifica que los archivos compose resuelvan correctamente.

### Paso 5. Build y publicacion

El job `publish-images` construye y publica imagenes a GHCR.

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

Ademas, el despliegue remoto por GitHub Actions solo se activa si la variable
de GitHub `DEPLOY_DELIVERY_MODE` existe y vale:

```text
gh-actions
```

Si esa variable no existe o tiene otro valor, el workflow:

- sigue validando,
- sigue publicando imagenes,
- pero no intenta conectarse al servidor por SSH.

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

- baja imagenes nuevas,
- recrea contenedores si hace falta,
- elimina contenedores huérfanos.

## 7.1 Estrategia dual de despliegue

El proyecto queda preparado para dos formas de despliegue:

### Modo 1. Push remoto desde GitHub Actions

GitHub:

- construye,
- publica imagenes,
- entra por SSH al servidor,
- y ejecuta el despliegue.

Este modo es util cuando:

- tienes IP o DNS accesible,
- el runner puede entrar al host,
- quieres mayor automatizacion extremo a extremo.

Para activarlo en GitHub, define:

```text
DEPLOY_DELIVERY_MODE=gh-actions
```

Si no la defines, el camino por SSH queda preparado pero desactivado.

### Modo 2. Pull iniciado desde el servidor

El servidor:

- hace `git pull` o actualiza archivos localmente,
- y luego ejecuta el mismo despliegue usando scripts del repo.

Este modo es util cuando:

- no tienes IP publica estatica,
- no quieres abrir entrada SSH desde GitHub,
- el servidor puede operar de forma autonomica o programada.

Este modo pasa a ser el predeterminado recomendado cuando no existe conectividad
entrante estable desde GitHub hacia el host.

### Regla de diseño adoptada

La logica de despliegue del stack no debe duplicarse.

Por eso:

- `scripts/apply-env.sh` contiene la logica comun,
- `scripts/deploy-env.sh` queda como wrapper del modo `gh-actions`,
- los futuros flujos de `server-pull` reutilizaran `scripts/apply-env.sh`.

## 7.2 Flujo manual desde servidor

Archivo principal:

- [`scripts/server-pull-deploy.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/server-pull-deploy.sh)

Este script agrega la parte que GitHub Actions no necesita:

- verificar rama local,
- verificar limpieza del repo,
- hacer `git fetch`,
- hacer `git pull --ff-only`,
- y luego ejecutar el despliegue del ambiente.

Sintaxis:

```bash
bash scripts/server-pull-deploy.sh <qa|prod> <git|skip-git> [image-tag]
```

Ejemplos:

```bash
bash scripts/server-pull-deploy.sh qa git
bash scripts/server-pull-deploy.sh prod git
bash scripts/server-pull-deploy.sh qa skip-git sha-abc123
```

Validacion sin cambios reales:

```bash
DEASY_DRY_RUN=1 bash scripts/server-pull-deploy.sh qa skip-git qa
DEASY_DRY_RUN=1 bash scripts/server-pull-deploy.sh prod skip-git prod
```

Significado:

- `git`: actualiza el repo desde `origin` antes de desplegar.
- `skip-git`: no toca git y solo aplica el stack.

Mapeo actual:

- `qa` espera estar en rama `qa`
- `prod` espera estar en rama `main`

El modo `git` falla si:

- el repo tiene cambios locales,
- o la rama activa no coincide con el ambiente esperado.

Eso evita despliegues ambiguos desde un checkout desalineado.

Los scripts `apply-env.sh` y `server-pull-deploy.sh` aceptan:

```text
DEASY_DRY_RUN=1
```

para mostrar los comandos que ejecutarian sin tocar contenedores ni git.

## 7.3 Opcion con systemd

Se dejaron ejemplos listos en:

- [`deploy/systemd/deasy-server-pull@.service`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/deploy/systemd/deasy-server-pull@.service)
- [`deploy/systemd/deasy-server-pull@.timer`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/deploy/systemd/deasy-server-pull@.timer)

La idea sigue la buena practica de Context7 para `systemd`:

- un `service` `oneshot` hace el trabajo,
- un `timer` lo programa,
- y no se mezcla logica de scheduling dentro del servicio.

### Que hace el service

El servicio ejecuta:

```bash
/bin/bash /opt/deasy/scripts/server-pull-deploy.sh %i git
```

Donde `%i` es el ambiente:

- `qa`
- `prod`

### Que hace el timer

El timer dispara ese servicio periodicamente.

Configuracion actual de ejemplo:

- primer disparo: `5m` despues de boot
- recurrencia: cada `15m`

Eso es solo una base y puede ajustarse.

### Instalacion ejemplo en servidor

Asumiendo que el repo vive en `/opt/deasy`:

```bash
sudo cp deploy/systemd/deasy-server-pull@.service /etc/systemd/system/
sudo cp deploy/systemd/deasy-server-pull@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now deasy-server-pull@qa.timer
```

Para `prod`:

```bash
sudo systemctl enable --now deasy-server-pull@prod.timer
```

### Ejecucion manual via systemd

```bash
sudo systemctl start deasy-server-pull@qa.service
sudo systemctl status deasy-server-pull@qa.service
```

### Consideraciones

- el `WorkingDirectory` del ejemplo esta en `/opt/deasy`
- si tu ruta real es otra, debes ajustar la unidad
- el host debe tener `git`, `docker` y `docker compose`
- el repo del servidor debe tener acceso al remoto si vas a usar modo `git`

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

Normalmente es tu usuario de GitHub o una cuenta tecnica.

#### GHCR_TOKEN

Token con permisos para leer paquetes del registry.

Como minimo debe permitir descargar imagenes privadas si aplica.

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

### Operativo hoy mismo

Sin cambios extra de infraestructura, hoy ya queda operativo:

1. CI para `develop`, `qa` y `main`
2. publicacion de imagenes a GHCR
3. despliegue iniciado desde el servidor con:
   - `scripts/server-pull-deploy.sh`
   - `scripts/apply-env.sh`
   - opcion de `systemd`
4. validacion segura con `DEASY_DRY_RUN=1`

### Pendiente de infraestructura futura

Para habilitar completamente el modo `gh-actions` por SSH faltan estas acciones:

1. crear `qa` y `prod` en `GitHub Environments`
2. cargar todos los `secrets`
3. definir `DEPLOY_DELIVERY_MODE=gh-actions`
4. verificar que el servidor remoto tenga:
   - `docker`
   - `docker compose`
   - `rsync`
   - acceso SSH correcto
   - conectividad adecuada para ese modelo
5. probar un deploy real a `qa`
6. probar un deploy real a `prod` cuando corresponda

### Tradeoff entre ambos modos

`gh-actions`:

- mas automatizado
- mas comodo para promover cambios desde GitHub
- depende de conectividad entrante y secretos completos

`server-pull`:

- mas simple para hosts cerrados o sin IP publica estatica
- evita entrada SSH desde GitHub
- exige que el propio servidor tenga acceso al repo y al registry

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
