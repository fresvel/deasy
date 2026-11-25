#!/usr/bin/env bash
# RENUEVA EL CERTIFICADO PÚBLICO (Let's Encrypt) Y RECARGA EL INGRESS. Pensado para una tarea
# programada: se puede correr las veces que haga falta.
#
# POR QUÉ EXISTE. `bootstrap-ingress-cert.sh` EMITE el certificado y nada lo renovaba. Dura 90
# días: el emitido el 2026-04-28 caducó el 2026-07-27 y estuvo cuatro meses caducado sin que nadie
# lo viera, porque las comprobaciones se hacían ignorando el certificado. Se renovó a mano el
# 2026-11-25 con los mismos pasos que hay aquí.
#
# QUÉ HACE:
#   1. `certbot renew`, que sólo renueva cuando faltan menos de 30 días. El reto lo sirve el
#      ingress que ya está corriendo (puerto 80, `nginx/acme`): NO hace falta el bootstrap, que
#      además chocaría con él por el puerto.
#   2. Si renovó, certbot copia el certificado a `certs/public/`, de donde lo lee nginx. Lo hace
#      su propio `--deploy-hook`, que conoce el nombre del linaje (`$RENEWED_LINEAGE`): por eso
#      nginx puede seguir leyendo de una ruta fija.
#   3. Recarga nginx SÓLO si el certificado que sirve cambió, y antes comprueba la configuración.
#
# La carpeta de certificados se le pregunta AL CONTENEDOR del ingress, no se deduce de dónde está
# este script: en el servidor hay una carpeta de despliegue por entorno y cada una tiene su
# `nginx/certs`, pero el ingress monta una sola.
#
#   bash scripts/renew-ingress-cert.sh             # renueva si toca
#   bash scripts/renew-ingress-cert.sh --dry-run   # ensaya contra Let's Encrypt sin cambiar nada
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INGRESS_CONTAINER="${DEASY_INGRESS_CONTAINER:-deasy-public-ingress}"
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot}"

ahora() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

montaje() {
  docker inspect "$INGRESS_CONTAINER" \
    --format "{{range .Mounts}}{{if eq .Destination \"$1\"}}{{.Source}}{{end}}{{end}}" 2>/dev/null || true
}

CERTS_DIR="$(montaje /etc/nginx/certs)"
ACME_DIR="$(montaje /var/www/certbot)"
if [ -z "$CERTS_DIR" ] || [ -z "$ACME_DIR" ]; then
  echo "[$(ahora)] El contenedor '$INGRESS_CONTAINER' no está o no monta certs/acme; uso $ROOT_DIR/nginx."
  CERTS_DIR="$ROOT_DIR/nginx/certs"
  ACME_DIR="$ROOT_DIR/nginx/acme"
fi

if [ ! -d "$CERTS_DIR" ] || [ ! -d "$ACME_DIR" ]; then
  echo "[$(ahora)] No existen $CERTS_DIR o $ACME_DIR. Para la PRIMERA emisión es bootstrap-ingress-cert.sh."
  exit 1
fi

# Qué certificado sirve nginx ahora mismo. Se lee DENTRO del contenedor, que corre como root: los
# ficheros que deja certbot no los puede leer el usuario que lanza esto.
huella_servida() {
  docker exec "$INGRESS_CONTAINER" md5sum /etc/nginx/certs/public/fullchain.pem 2>/dev/null | cut -d' ' -f1 || true
}

antes="$(huella_servida)"

echo "[$(ahora)] certbot renew (certificados en $CERTS_DIR)"
docker run --rm \
  -v "$ACME_DIR:/var/www/certbot" \
  -v "$CERTS_DIR:/etc/letsencrypt" \
  "$CERTBOT_IMAGE" renew \
  --deploy-hook 'mkdir -p /etc/letsencrypt/public && cp -L "$RENEWED_LINEAGE/fullchain.pem" "$RENEWED_LINEAGE/privkey.pem" /etc/letsencrypt/public/' \
  "$@"

despues="$(huella_servida)"

if [ -z "$despues" ]; then
  echo "[$(ahora)] No se pudo leer el certificado dentro de '$INGRESS_CONTAINER': no se recarga nada."
  exit 1
fi

if [ "$antes" = "$despues" ]; then
  echo "[$(ahora)] Sin cambios: no tocaba renovar."
  exit 0
fi

echo "[$(ahora)] Certificado renovado; comprobando la configuración y recargando nginx."
docker exec "$INGRESS_CONTAINER" nginx -t
docker exec "$INGRESS_CONTAINER" nginx -s reload
echo "[$(ahora)] Listo."
