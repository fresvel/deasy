# Contexto de Despliegue `ingress`, `qa` y `prod`

## 1. Objetivo del cambio

Se buscó dejar `qa` y `prod` usando los mismos puertos públicos de entrada
(`80` y `443`) pero enroutados por subdominio:

- `fresvel.com` -> `prod`
- `www.fresvel.com` -> `prod`
- `qa.fresvel.com` -> `qa`

La conclusión técnica fue:

- eso sí es correcto,
- pero no puede resolverse dejando dos `nginx-proxy` distintos publicados al
  mismo tiempo sobre `80/443` en el mismo host,
- por lo tanto se separó un `ingress` público único.

## 2. Problema original

Antes del cambio:

- `qa` publicaba `9088/9443`
- `prod` publicaba `80/443`
- ambos stacks tenían su propio `nginx`

Eso evitaba conflictos de puertos, pero no resolvía el requerimiento de
subdominios compartiendo `80/443`.

## 3. Decisión arquitectónica final

Se adoptó este modelo:

- `qa` y `prod` siguen siendo stacks separados
- `ingress` es un tercer ambiente independiente
- `ingress` es el único autorizado a publicar `80/443`
- `qa` y `prod` solo exponen sus servicios internos y se conectan a una red
  Docker compartida
- el enrutamiento público se hace por `Host` en Nginx

### Ambientes

- `qa`
- `prod`
- `ingress`

### Checkouts esperados en servidor

- `/srv/deasy-qa`
- `/srv/deasy-prod`
- `/srv/deasy-ingress`

### Red pública compartida

- `deasy_public_ingress`

## 4. Cambios hechos en código

### Compose

Se introdujeron o ajustaron estos archivos:

- `docker/compose.ingress.yml`
- `docker/compose.ingress.bootstrap.yml`
- `docker/compose.proxy.yml`
- `docker/.env.ingress`

Se dejó:

- `qa` conectado a la red `deasy_public_ingress` con aliases
- `prod` conectado a la red `deasy_public_ingress` con aliases
- `ingress` como stack separado

### Nginx

Se separaron plantillas:

- `nginx/app-conf.d/default.conf.template`
- `nginx/ingress-conf.d/default.conf.template`
- `nginx/ingress-bootstrap-conf.d/default.conf.template`

Roles:

- `app-conf.d`: proxy local de `dev`
- `ingress-conf.d`: ingress final con TLS y routing por subdominio
- `ingress-bootstrap-conf.d`: ingress temporal solo HTTP para ACME

### Scripts

Se modificaron:

- `scripts/docker-env.sh`
- `scripts/apply-env.sh`
- `scripts/deploy-env.sh`

Se agregó:

- `scripts/bootstrap-ingress-cert.sh`

### Workflow

Se modificó:

- `.github/workflows/cd-multienv.yml`

Quedó así:

- deploy por `push` para `qa` y `prod`
- deploy manual `workflow_dispatch` para `qa`, `prod` e `ingress`
- `ingress` ya no depende del deploy de `qa` ni de `prod`

## 5. Problemas encontrados durante la implementación

### 5.1. `qa` llegaba al backend de `prod`

Se detectó porque en logs de `prod` aparecía:

- `Origin: https://qa.fresvel.com`

Eso probó que:

- `qa.fresvel.com` estaba entrando a `prod`
- el proxy público correcto no estaba levantado
- o seguía vivo un proxy viejo ocupando `80/443`

### 5.2. El `ingress` no arrancaba por certificados faltantes

Se identificó el problema clásico:

- Nginx final con `443` no puede arrancar sin certificados reales
- Certbot con `HTTP-01` necesita un servicio HTTP arriba para validar

Por eso se creó:

- `ingress-bootstrap` en `80`
- `bootstrap-ingress-cert.sh`

Flujo:

1. subir `ingress-bootstrap`
2. emitir certificado con Certbot
3. copiar certificados a `nginx/certs/public`
4. bajar bootstrap
5. subir `ingress` final

### 5.3. Error al leer `docker/.env.ingress`

Ocurrió porque el script hacía `source` a un `.env` con este tipo de línea:

- `PROD_SERVER_NAMES=fresvel.com www.fresvel.com`

Eso hacía que Bash intentara ejecutar `www.fresvel.com` como comando.

Se corrigió reemplazando `source` por lectura explícita de variables.

### 5.4. Certbot pidió interacción al existir certificado previo

El script inicialmente no era completamente no interactivo.

Se corrigió agregando:

- `--non-interactive`
- `--keep-until-expiring`

### 5.5. `ingress` final no podía arrancar porque el bootstrap seguía ocupando `80`

Se detectó por este error:

- `Bind for 0.0.0.0:80 failed: port is already allocated`

Causa:

- `deasy-public-ingress-bootstrap` seguía corriendo

Se corrigió en `scripts/apply-env.sh` agregando limpieza explícita de:

- `deasy-public-ingress-bootstrap`
- `deasy-public-ingress`
- proxies viejos heredados

## 6. Estado operativo que debe quedar

Después del bootstrap y del deploy correcto:

- `deasy-public-ingress` debe estar corriendo en `80/443`
- `deasy-public-ingress-bootstrap` debe estar apagado o eliminado
- `qa` y `prod` deben estar conectados a `deasy_public_ingress`

Validación esperada:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker network inspect deasy_public_ingress
```

## 7. Qué debe existir en GitHub

### Environments

Se deben crear:

- `ingress`
- `qa`
- `prod`

### Secrets de `ingress`

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`

Valor esperado de `DEPLOY_PATH`:

- `/srv/deasy-ingress`

### Secrets de `qa`

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_USERNAME`
- `GHCR_TOKEN`
- `RUNTIME_ENV_FILE`

Valor esperado de `DEPLOY_PATH`:

- `/srv/deasy-qa`

### Secrets de `prod`

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `GHCR_USERNAME`
- `GHCR_TOKEN`
- `RUNTIME_ENV_FILE`

Valor esperado de `DEPLOY_PATH`:

- `/srv/deasy-prod`

### Variables de environment

En los 3:

- `DEPLOY_DELIVERY_MODE=gh-actions`

## 8. Qué debe existir en el servidor

### Directorios

- `/srv/deasy-qa`
- `/srv/deasy-prod`
- `/srv/deasy-ingress`

### Certificados públicos

En:

- `/srv/deasy-ingress/nginx/certs/public/fullchain.pem`
- `/srv/deasy-ingress/nginx/certs/public/privkey.pem`

O, si el host está limpio, deben generarse con:

```bash
cd /srv/deasy-ingress
CERTBOT_EMAIL=fresvel@outlook.com bash scripts/bootstrap-ingress-cert.sh
```

## 9. Orden correcto de despliegue desde cero

1. Deploy manual de `ingress` desde GitHub
2. Bootstrap de certificados en el servidor
3. Deploy de `qa`
4. Deploy de `prod`

## 10. Comandos operativos clave

### Bootstrap de certificados

```bash
cd /srv/deasy-ingress
CERTBOT_EMAIL=fresvel@outlook.com bash scripts/bootstrap-ingress-cert.sh
```

### Levantar `ingress` final manualmente

```bash
cd /srv/deasy-ingress
bash scripts/docker-env.sh ingress up -d
```

### Verificación de contenedores

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### Verificación de la red compartida

```bash
docker network inspect deasy_public_ingress
```

## 11. Lección operativa importante

No conviene que `ingress` viva como parte del ciclo de `qa` o `prod`, porque:

- comparten recurso global (`80/443`)
- un redeploy de aplicación puede desarmar entrada pública
- los certificados tienen ciclo propio
- la red y el proxy son infraestructura compartida, no lógica de una app

Por eso se dejó `ingress` como ambiente separado.

## 12. Estado de este documento

Este archivo resume el contexto de la conversación y de la refactorización
realizada para:

- unificar puertos públicos
- enrutar por subdominio
- separar `ingress`
- permitir bootstrap limpio de TLS con Certbot
- dejar `qa` y `prod` aislados entre sí pero servidos por un proxy común
