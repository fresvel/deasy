#!/bin/sh
set -eu

MINIO_ALIAS="local"
MINIO_URL="http://minio:9000"
TEMPLATES_BUCKET="${MINIO_TEMPLATES_BUCKET:-deasy-templates}"
TEMPLATES_PREFIX="${MINIO_TEMPLATES_PREFIX:-Plantillas}"
DOCUMENTS_BUCKET="${MINIO_DOCUMENTS_BUCKET:-deasy-documents}"
DOCUMENTS_PREFIX="${MINIO_DOCUMENTS_PREFIX:-Unidades}"
CHAT_BUCKET="${MINIO_CHAT_BUCKET:-deasy-chat}"
CHAT_PREFIX="${MINIO_CHAT_PREFIX:-Chat}"
SPOOL_BUCKET="${MINIO_SPOOL_BUCKET:-deasy-spool}"
SPOOL_PREFIX="${MINIO_SIGNATURES_PREFIX:-Firmas}"
DOSSIER_BUCKET="${MINIO_DOSSIER_BUCKET:-deasy-dossier}"
DOSSIER_PREFIX="${MINIO_DOSSIER_PREFIX:-Dosier}"

echo "Esperando MinIO en ${MINIO_URL}..."
until mc alias set "$MINIO_ALIAS" "$MINIO_URL" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  sleep 2
done

ensure_bucket() {
  bucket_name="$1"
  echo "Validando bucket ${bucket_name}..."
  mc mb --ignore-existing "${MINIO_ALIAS}/${bucket_name}" >/dev/null
}

sync_path() {
  local_path="$1"
  bucket_name="$2"
  target_prefix="$3"
  if [ -d "$local_path" ]; then
    echo "Sincronizando ${local_path} hacia ${MINIO_ALIAS}/${bucket_name}/${target_prefix}..."
    mc mirror --overwrite --exclude '.*' "$local_path" "${MINIO_ALIAS}/${bucket_name}/${target_prefix}"
    SYNC_COUNT=$((SYNC_COUNT + 1))
  fi
}

ensure_bucket "$TEMPLATES_BUCKET"
ensure_bucket "$DOCUMENTS_BUCKET"
ensure_bucket "$CHAT_BUCKET"
ensure_bucket "$SPOOL_BUCKET"
ensure_bucket "$DOSSIER_BUCKET"

SYNC_COUNT=0

sync_path "/import/Plantillas" "$TEMPLATES_BUCKET" "$TEMPLATES_PREFIX"
sync_path "/import/Unidades" "$DOCUMENTS_BUCKET" "$DOCUMENTS_PREFIX"
sync_path "/import/Chat" "$CHAT_BUCKET" "$CHAT_PREFIX"
sync_path "/import/Firmas" "$SPOOL_BUCKET" "$SPOOL_PREFIX"
sync_path "/import/Dosier" "$DOSSIER_BUCKET" "$DOSSIER_PREFIX"

if [ "$SYNC_COUNT" -eq 0 ]; then
  echo "No se detectaron carpetas importables. Usa /import/{Plantillas,Unidades,Chat,Firmas,Dosier}."
else
  echo "Sincronizacion completada."
fi
