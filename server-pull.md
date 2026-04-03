# Configuracion de `server-pull`

## 1. Que es `server-pull`

`server-pull` es el modo en el que el propio servidor actualiza y despliega el
proyecto.

No depende de que GitHub Actions entre por SSH al servidor.

La idea es esta:

1. el servidor tiene una copia local del repositorio,
2. el servidor hace `git pull` cuando corresponde,
3. el servidor ejecuta el despliegue localmente,
4. Docker Compose actualiza los contenedores del ambiente.

Este modo es especialmente util cuando:

- no tienes IP publica estatica,
- no quieres abrir acceso SSH desde GitHub,
- prefieres que el servidor se actualice por iniciativa propia,
- o quieres poder correr actualizaciones manuales con control local.

## 2. Que parte va en el codigo y que parte va en el servidor

### Ya quedó implementado en el codigo

En el repositorio ya existe la base necesaria:

- [`scripts/apply-env.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/apply-env.sh)
- [`scripts/server-pull-deploy.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/server-pull-deploy.sh)
- [`scripts/docker-env.sh`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/scripts/docker-env.sh)
- [`deploy/systemd/deasy-server-pull@.service`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/deploy/systemd/deasy-server-pull@.service)
- [`deploy/systemd/deasy-server-pull@.timer`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/deploy/systemd/deasy-server-pull@.timer)

### Lo que debes configurar tu en el servidor

Eso no se resuelve solo con git. Debes preparar:

- sistema operativo,
- Docker,
- acceso al repositorio,
- acceso a GHCR,
- variables runtime del ambiente,
- opcion manual o `systemd`.

## 3. Requisitos previos del servidor

El servidor debe tener instalado:

- `git`
- `docker`
- `docker compose`
- `bash`

Si vas a usar timer automatico, tambien:

- `systemd`

Para comprobarlo:

```bash
git --version
docker --version
docker compose version
systemctl --version
```

## 4. Donde debe vivir el proyecto

En la documentacion y ejemplos se asume:

```text
/opt/deasy
```

Puedes usar otra ruta, pero si cambias esto debes ajustar:

- los comandos manuales,
- el `WorkingDirectory` del archivo `.service`,
- la ruta del `ExecStart`.

## 5. Como clonar el repositorio en el servidor

### Opcion recomendada: un checkout por ambiente

Lo mas limpio es tener un checkout separado por ambiente.

Ejemplo:

```text
/opt/deasy-qa
/opt/deasy-prod
```

Ventajas:

- `qa` y `prod` no comparten rama en el mismo checkout,
- se evita estar cambiando de rama,
- reduce errores operativos.

### Opcion minima: un solo checkout

Tambien puedes usar un unico checkout, pero en ese caso:

- para `qa` debes estar parado en rama `qa`
- para `prod` debes estar parado en rama `main`

Eso es mas delicado.

### Clonado ejemplo

Para `qa`:

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone git@github.com:fresvel/deasy.git deasy-qa
cd /opt/deasy-qa
sudo git checkout qa
```

Para `prod`:

```bash
cd /opt
sudo git clone git@github.com:fresvel/deasy.git deasy-prod
cd /opt/deasy-prod
sudo git checkout main
```

## 6. Como dar acceso del servidor al repositorio

El servidor necesita poder leer el repo.

Tienes dos opciones:

### Opcion A. SSH deploy key

Es la mas recomendada para servidores.

Pasos:

1. generar clave SSH en el servidor
2. copiar la clave publica
3. agregarla en GitHub como deploy key o como clave del usuario

Generar clave:

```bash
ssh-keygen -t ed25519 -C "deasy-server-pull"
```

La publica normalmente quedara en:

```text
~/.ssh/id_ed25519.pub
```

Luego debes registrar esa clave publica en GitHub.

### Opcion B. HTTPS con token

Es posible, pero menos comodo para automatizacion local.

Si usas esta ruta, tendras que resolver almacenamiento seguro del token.

## 7. Como dar acceso del servidor a GHCR

El servidor no construye las imagenes de `qa` y `prod`.

Lo que hace es descargarlas desde GHCR.

Por eso debe poder hacer login a:

```text
ghcr.io
```

### Login manual

```bash
docker login ghcr.io -u TU_USUARIO_GITHUB
```

Te pedira el token.

### Requisito del token

El token debe tener permisos para leer paquetes del registry.

Si las imagenes fueran privadas, esto es obligatorio.

### Verificacion

```bash
docker pull ghcr.io/fresvel/deasy-backend:qa
docker pull ghcr.io/fresvel/deasy-frontend:qa
```

## 8. Variables runtime del ambiente

El modo `server-pull` no depende de `GitHub Environments`, pero igual necesita
variables reales del ambiente.

Debes crear en el servidor:

Para `qa`:

```text
docker/.env.qa.runtime
```

Para `prod`:

```text
docker/.env.prod.runtime
```

El script `apply-env.sh` detecta esos archivos automaticamente.

### Ejemplo de ubicacion

Si tu checkout es:

```text
/opt/deasy-qa
```

Entonces el archivo seria:

```text
/opt/deasy-qa/docker/.env.qa.runtime
```

### Que debe contener

Variables reales del ambiente, por ejemplo:

- passwords reales de base de datos
- credenciales de MinIO
- endpoints reales
- URLs internas o externas
- cualquier override sensible

No pongas esos valores en archivos versionados del repo.

## 9. Como funciona el script principal

El flujo principal del modo `server-pull` es:

```bash
bash scripts/server-pull-deploy.sh <qa|prod> <git|skip-git> [image-tag]
```

### Modo `git`

Hace esto:

1. verifica la rama actual
2. verifica que no haya cambios locales
3. hace `git fetch origin --prune`
4. hace `git pull --ff-only`
5. ejecuta el despliegue

### Modo `skip-git`

No toca git.

Sirve cuando:

- ya actualizaste el repo por otro mecanismo,
- o quieres probar un despliegue sin mover codigo.

## 10. Comandos manuales recomendados

### QA manual

Si usas un checkout dedicado en `/opt/deasy-qa`:

```bash
cd /opt/deasy-qa
bash scripts/server-pull-deploy.sh qa git
```

### PROD manual

Si usas un checkout dedicado en `/opt/deasy-prod`:

```bash
cd /opt/deasy-prod
bash scripts/server-pull-deploy.sh prod git
```

### Desplegar un tag especifico

```bash
cd /opt/deasy-qa
bash scripts/server-pull-deploy.sh qa skip-git sha-abc123
```

## 11. Validacion segura sin tocar nada

Puedes validar el flujo con:

```bash
cd /opt/deasy-qa
DEASY_DRY_RUN=1 bash scripts/server-pull-deploy.sh qa skip-git qa
```

Y para `prod`:

```bash
cd /opt/deasy-prod
DEASY_DRY_RUN=1 bash scripts/server-pull-deploy.sh prod skip-git prod
```

Esto muestra que comandos correria, pero sin ejecutar cambios reales.

## 12. Configuracion con systemd

El repo ya incluye estos templates:

- [`deploy/systemd/deasy-server-pull@.service`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/deploy/systemd/deasy-server-pull@.service)
- [`deploy/systemd/deasy-server-pull@.timer`](/home/fresvel/Sharepoint/DIR/Deploy/deasy/deploy/systemd/deasy-server-pull@.timer)

### Importante sobre la ruta

El template incluido asume:

```text
/opt/deasy
```

Si vas a usar:

```text
/opt/deasy-qa
/opt/deasy-prod
```

entonces debes ajustar el archivo `.service` o crear una variante para cada
checkout.

## 13. Opcion recomendada de systemd: una unidad por checkout

Si vas a separar `qa` y `prod` en carpetas distintas, lo mas claro es crear dos
unidades finales en `/etc/systemd/system/`.

### Ejemplo para QA

Archivo:

```text
/etc/systemd/system/deasy-qa-pull.service
```

Contenido:

```ini
[Unit]
Description=Deasy QA server-pull deploy
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/deasy-qa
ExecStart=/bin/bash /opt/deasy-qa/scripts/server-pull-deploy.sh qa git
TimeoutStartSec=1800
```

Timer:

```text
/etc/systemd/system/deasy-qa-pull.timer
```

```ini
[Unit]
Description=Periodic Deasy QA server-pull deploy

[Timer]
OnBootSec=5m
OnUnitActiveSec=15m
Unit=deasy-qa-pull.service
Persistent=true

[Install]
WantedBy=timers.target
```

### Ejemplo para PROD

Archivo:

```text
/etc/systemd/system/deasy-prod-pull.service
```

Contenido:

```ini
[Unit]
Description=Deasy PROD server-pull deploy
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/deasy-prod
ExecStart=/bin/bash /opt/deasy-prod/scripts/server-pull-deploy.sh prod git
TimeoutStartSec=1800
```

Timer:

```text
/etc/systemd/system/deasy-prod-pull.timer
```

```ini
[Unit]
Description=Periodic Deasy PROD server-pull deploy

[Timer]
OnBootSec=5m
OnUnitActiveSec=15m
Unit=deasy-prod-pull.service
Persistent=true

[Install]
WantedBy=timers.target
```

## 14. Como habilitar systemd

Despues de crear las unidades:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now deasy-qa-pull.timer
sudo systemctl enable --now deasy-prod-pull.timer
```

### Ejecutar manualmente una vez

```bash
sudo systemctl start deasy-qa-pull.service
sudo systemctl status deasy-qa-pull.service
```

## 15. Que debo configurar en GitHub para server-pull

### Obligatorio para server-pull

En estricto sentido, para `server-pull` no necesitas que GitHub entre al
servidor.

Por eso no es obligatorio configurar:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `RUNTIME_ENV_FILE`

### Recomendado en GitHub

Si quieres seguir usando GitHub como sistema de build y publicacion de imagenes,
si conviene que el workflow siga activo para:

- CI
- build
- publicacion en GHCR

Entonces:

1. mantén el workflow activo
2. no definas `DEPLOY_DELIVERY_MODE=gh-actions`
3. deja que el servidor haga el pull de codigo o de imagenes por su cuenta

### Si mas adelante quieres reactivar deploy por GitHub Actions

Entonces si tendras que configurar:

- `DEPLOY_DELIVERY_MODE=gh-actions`
- `GitHub Environments`
- `secrets` de SSH
- `RUNTIME_ENV_FILE`

## 16. Flujo recomendado en tu caso

Dado que ahora no tienes IP publica estatica, el flujo recomendado es:

1. GitHub Actions:
   - valida
   - construye
   - publica imagenes en GHCR
2. servidor:
   - hace `git pull` o usa `systemd`
   - ejecuta `server-pull-deploy.sh`
   - descarga imagenes desde GHCR
   - actualiza contenedores

## 17. Checklist de configuracion real

### En el servidor

- instalar `git`
- instalar `docker`
- instalar `docker compose`
- clonar el repo
- decidir si usaras un checkout por ambiente
- configurar acceso SSH o HTTPS al repo
- configurar login a `ghcr.io`
- crear `docker/.env.qa.runtime`
- crear `docker/.env.prod.runtime`
- probar `DEASY_DRY_RUN=1`
- probar despliegue manual real
- opcionalmente habilitar `systemd`

### En GitHub

- mantener el workflow activo
- no definir `DEPLOY_DELIVERY_MODE=gh-actions` por ahora
- opcionalmente revisar visibilidad y permisos de paquetes GHCR

## 18. Resumen corto

`server-pull` no es algo que se “active” solo con cambiar el repo.

El repo ya quedó listo para soportarlo, pero debes preparar el servidor:

- acceso al repo,
- acceso a GHCR,
- variables runtime,
- y opcionalmente `systemd`.

GitHub, en este modo, puede limitarse a:

- validar,
- construir,
- y publicar imagenes.
