#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
TARGET_ENV="${1:-dev}"

case "$TARGET_ENV" in
  dev|qa|prod)
    ;;
  *)
    echo "Ambiente no soportado: $TARGET_ENV"
    echo "Uso: sh nginx/scripts/generate-self-signed.sh <dev|qa|prod>"
    exit 1
    ;;
esac

CERT_DIR="$ROOT_DIR/nginx/certs/$TARGET_ENV"
CRT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"

mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 \
  -sha256 \
  -keyout "$KEY_FILE" \
  -out "$CRT_FILE" \
  -days 365 \
  -subj "/C=EC/ST=Esmeraldas/L=Esmeraldas/O=Deasy/OU=$TARGET_ENV/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Self-signed certificate generated in $CERT_DIR"
