#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"
NGINX_DIR="$ROOT_DIR/nginx"
ENV_FILE="${DEASY_INGRESS_ENV_FILE:-$DOCKER_DIR/.env.ingress}"
EMAIL="${CERTBOT_EMAIL:-}"
STAGING="${CERTBOT_STAGING:-0}"

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe el archivo de entorno de ingress: $ENV_FILE"
  exit 1
fi

if [ -z "$EMAIL" ]; then
  echo "Debes definir CERTBOT_EMAIL para emitir el certificado."
  exit 1
fi

read_env_value() {
  local key="$1"
  awk -F= -v search_key="$key" '
    $0 ~ "^[[:space:]]*" search_key "=" {
      sub(/^[^=]*=/, "", $0)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
      print $0
      exit
    }
  ' "$ENV_FILE"
}

PROD_SERVER_NAMES="$(read_env_value "PROD_SERVER_NAMES")"
QA_SERVER_NAME="$(read_env_value "QA_SERVER_NAME")"

DOMAINS=()
for domain in ${PROD_SERVER_NAMES:-}; do
  DOMAINS+=("-d" "$domain")
done
if [ -n "${QA_SERVER_NAME:-}" ]; then
  DOMAINS+=("-d" "$QA_SERVER_NAME")
fi

if [ "${#DOMAINS[@]}" -eq 0 ]; then
  echo "No se definieron dominios en $ENV_FILE"
  exit 1
fi

mkdir -p "$NGINX_DIR/acme" "$NGINX_DIR/certs/public"

echo "Levantando ingress bootstrap en HTTP..."
bash "$ROOT_DIR/scripts/docker-env.sh" ingress-bootstrap up -d --remove-orphans

CERTBOT_ARGS=(
  certonly
  --webroot
  -w /var/www/certbot
  --email "$EMAIL"
  --agree-tos
  --no-eff-email
  --non-interactive
  --keep-until-expiring
  "${DOMAINS[@]}"
)

if [ "$STAGING" = "1" ]; then
  CERTBOT_ARGS+=(--staging)
fi

echo "Solicitando certificado con certbot..."
docker run --rm \
  -v "$NGINX_DIR/acme:/var/www/certbot" \
  -v "$NGINX_DIR/certs:/etc/letsencrypt" \
  certbot/certbot "${CERTBOT_ARGS[@]}"

PRIMARY_DOMAIN=""
for domain in ${PROD_SERVER_NAMES:-}; do
  PRIMARY_DOMAIN="$domain"
  break
done
if [ -z "$PRIMARY_DOMAIN" ]; then
  PRIMARY_DOMAIN="${QA_SERVER_NAME:-}"
fi

LIVE_DIR="$NGINX_DIR/certs/live/$PRIMARY_DOMAIN"
if [ ! -f "$LIVE_DIR/fullchain.pem" ] || [ ! -f "$LIVE_DIR/privkey.pem" ]; then
  ALT_LIVE_DIR="$(find "$NGINX_DIR/certs/live" -maxdepth 1 -mindepth 1 -type d -name "${PRIMARY_DOMAIN}*" | head -n 1)"
  if [ -n "$ALT_LIVE_DIR" ] && [ -f "$ALT_LIVE_DIR/fullchain.pem" ] && [ -f "$ALT_LIVE_DIR/privkey.pem" ]; then
    LIVE_DIR="$ALT_LIVE_DIR"
  else
    echo "Certbot no dejó certificados utilizables en $NGINX_DIR/certs/live"
    exit 1
  fi
fi

cp "$LIVE_DIR/fullchain.pem" "$NGINX_DIR/certs/public/fullchain.pem"
cp "$LIVE_DIR/privkey.pem" "$NGINX_DIR/certs/public/privkey.pem"

echo "Apagando bootstrap y levantando ingress final..."
bash "$ROOT_DIR/scripts/docker-env.sh" ingress-bootstrap down
bash "$ROOT_DIR/scripts/docker-env.sh" ingress up -d --remove-orphans

echo "Bootstrap completado."
