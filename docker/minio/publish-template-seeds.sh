#!/bin/sh
set -eu

MINIO_ALIAS="local"
MINIO_URL="http://minio:9000"
TEMPLATES_BUCKET="${MINIO_TEMPLATES_BUCKET:-deasy-templates}"
SEEDS_PREFIX="${MINIO_TEMPLATES_SEEDS_PREFIX:-Seeds}"

echo "Esperando MinIO en ${MINIO_URL}..."
until mc alias set "$MINIO_ALIAS" "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  sleep 2
done

mc mb --ignore-existing "${MINIO_ALIAS}/${TEMPLATES_BUCKET}" >/dev/null

if [ ! -d /publish ]; then
  echo "No existe la ruta de seeds a publicar."
  exit 1
fi

echo "Publicando seeds desde /publish hacia ${MINIO_ALIAS}/${TEMPLATES_BUCKET}/${SEEDS_PREFIX}..."
mc mirror --overwrite --exclude '.*' /publish "${MINIO_ALIAS}/${TEMPLATES_BUCKET}/${SEEDS_PREFIX}"
echo "Publicacion de seeds completada."
