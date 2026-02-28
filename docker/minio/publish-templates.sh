#!/bin/sh
set -eu

MINIO_ALIAS="local"
MINIO_URL="http://minio:9000"
BUCKET="${MINIO_TEMPLATES_BUCKET:-deasy-templates}"
TEMPLATES_PREFIX="${MINIO_TEMPLATES_PREFIX:-Plantillas}"

echo "Esperando MinIO en ${MINIO_URL}..."
until mc alias set "$MINIO_ALIAS" "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  sleep 2
done

echo "MinIO disponible. Validando bucket ${BUCKET}..."
mc mb --ignore-existing "${MINIO_ALIAS}/${BUCKET}" >/dev/null

HAS_CONTENT=0
for entry in /publish/* /publish/.[!.]* /publish/..?*; do
  [ -e "$entry" ] || continue
  HAS_CONTENT=1
  break
done

if [ "$HAS_CONTENT" -eq 0 ]; then
  echo "No hay contenido en /publish. Ejecuta primero el empaquetado."
  exit 1
fi

echo "Publicando /publish hacia ${MINIO_ALIAS}/${BUCKET}/${TEMPLATES_PREFIX}..."
mc mirror \
  --overwrite \
  --exclude '.*' \
  --exclude '*/output/*' \
  /publish "${MINIO_ALIAS}/${BUCKET}/${TEMPLATES_PREFIX}"

echo "Publicacion completada."
