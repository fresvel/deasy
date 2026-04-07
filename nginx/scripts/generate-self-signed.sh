#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
CERT_DIR="$ROOT_DIR/nginx/certs"
CRT_FILE="$CERT_DIR/tls.crt"
KEY_FILE="$CERT_DIR/tls.key"

mkdir -p "$CERT_DIR"

if [ -f "$CRT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Certificates already exist in $CERT_DIR"
  exit 0
fi

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CRT_FILE" \
  -days 365 \
  -subj "/C=EC/ST=Esmeraldas/L=Esmeraldas/O=Deasy/OU=Dev/CN=localhost"

echo "Self-signed certificate generated in $CERT_DIR"
