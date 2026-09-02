#!/bin/sh
set -eu

MINIO_ALIAS="local"
MINIO_URL="http://minio:9000"
TEMPLATES_BUCKET="${MINIO_TEMPLATES_BUCKET:-deasy-templates}"
TEMPLATES_PREFIX="${MINIO_TEMPLATES_PREFIX:-System}"
TEMPLATE_SEEDS_PREFIX="${MINIO_TEMPLATES_SEEDS_PREFIX:-Seeds}"
DOCUMENTS_BUCKET="${MINIO_DOCUMENTS_BUCKET:-deasy-documents}"
DOCUMENTS_PREFIX="${MINIO_DOCUMENTS_PREFIX:-Unidades}"
CHAT_BUCKET="${MINIO_CHAT_BUCKET:-deasy-chat}"
CHAT_PREFIX="${MINIO_CHAT_PREFIX:-Chat}"
SPOOL_BUCKET="${MINIO_SPOOL_BUCKET:-deasy-spool}"
SPOOL_PREFIX="${MINIO_SIGNATURES_PREFIX:-Firmas}"
USERS_BUCKET="${MINIO_USERS_BUCKET:-deasy-users}"
USERS_PREFIX="${MINIO_USERS_PREFIX:-Users}"
DOSSIER_BUCKET="${MINIO_DOSSIER_BUCKET:-deasy-dossier}"
DOSSIER_PREFIX="${MINIO_DOSSIER_PREFIX:-Dosier}"

# -- Los textos legales (LOPDP) --------------------------------------------------------------
# Dos buckets, y NO son intercambiables:
#   . borradores  versionado, SIN bloqueo    -- se editan diez veces antes de aprobarse
#   . archivo     versionado + Object Lock   -- lo publicado, que ya no se toca NUNCA
#
# La retencion NO tiene valor por defecto A PROPOSITO. Es la unica decision de este fichero que
# es IRREVERSIBLE, y adivinarla se equivoca en las dos direcciones: quedarse corto deja sin
# proteger lo que la ley obliga a poder demostrar, y pasarse deja documentos indelebles
# acumulandose en una pila de desarrollo que se resetea a diario. Si falta, esto se para.
LEGAL_BUCKET="${MINIO_LEGAL_BUCKET:-deasy-legal}"
LEGAL_DRAFTS_BUCKET="${MINIO_LEGAL_DRAFTS_BUCKET:-deasy-legal-borradores}"
LEGAL_RETENTION_MODE="${MINIO_LEGAL_RETENTION_MODE:-COMPLIANCE}"
LEGAL_RETENTION_DAYS="${MINIO_LEGAL_RETENTION_DAYS:-}"

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

# -- El bucket de archivo legal --------------------------------------------------------------
#
# EL BLOQUEO DE OBJETOS SOLO SE PUEDE PEDIR AL CREAR EL BUCKET, Y ES IRREVERSIBLE. A uno creado
# sin `--with-lock` no se le puede anadir despues -- ni activando antes el versionado: MinIO
# responde «does not support locking» y no hay forma de arreglarlo.
#
# Y OJO, porque la comprobacion evidente NO SIRVE: `mc mb --with-lock --ignore-existing` sobre
# un bucket que ya existe SIN bloqueo responde «Bucket created successfully» y sale con codigo 0
# (medido el 2026-09-02 contra la pila C). Lo que si lo detecta es PEDIR LA RETENCION, que es lo
# que se hace debajo -- y si eso falla, este script se para.
#
# ⚠️ Y ESTO NO ES LA UNICA BARRERA, NI PUEDE SERLO. Este script se lanza A MANO (perfil
# `storage-init`), asi que no hay forma de garantizar que corra ANTES que el backend -- y el
# backend crea buckets al vuelo con `makeBucket(bucket, "")`, sin bloqueo. Si le gana la carrera
# al bucket legal, el dano ya no se puede deshacer. Lo que esto aporta es crearlo BIEN cuando se
# lanza, y NEGARSE si ya existe mal; impedir el camino perezoso es cosa del arranque del backend.
ensure_legal_archive_bucket() {
  if [ -z "$LEGAL_RETENTION_DAYS" ]; then
    cat >&2 <<'EOF'

  [X] Falta MINIO_LEGAL_RETENTION_DAYS, y no tiene valor por defecto a proposito.

      Es la retencion del archivo legal, y es IRREVERSIBLE: en modo COMPLIANCE no se puede
      acortar despues. Ponla en docker/.env.<entorno>:

        desarrollo y qa   MINIO_LEGAL_RETENTION_DAYS=1
        produccion        MINIO_LEGAL_RETENTION_DAYS=3650    (10 anos)

      En dev es 1 dia porque `test:char:run` resetea la base pero NO MinIO: con 3650, cada
      corrida dejaria documentos que no se pueden borrar acumulandose para siempre.

EOF
    exit 1
  fi

  case "$LEGAL_RETENTION_DAYS" in
    *[!0-9]*) echo "[X] MINIO_LEGAL_RETENTION_DAYS='${LEGAL_RETENTION_DAYS}' no es un numero de dias." >&2; exit 1 ;;
    0)        echo "[X] MINIO_LEGAL_RETENTION_DAYS=0: un archivo sin retencion no es un archivo." >&2; exit 1 ;;
  esac

  echo "Validando bucket ${LEGAL_BUCKET} (bloqueo de objetos, ${LEGAL_RETENTION_MODE} ${LEGAL_RETENTION_DAYS}d)..."
  mc mb --with-lock --ignore-existing "${MINIO_ALIAS}/${LEGAL_BUCKET}" >/dev/null

  if ! retention_error="$(mc retention set --default "$LEGAL_RETENTION_MODE" "${LEGAL_RETENTION_DAYS}d" \
                            "${MINIO_ALIAS}/${LEGAL_BUCKET}" 2>&1)"; then
    cat >&2 <<EOF

  [X] El bucket de archivo legal '${LEGAL_BUCKET}' NO ADMITE BLOQUEO DE OBJETOS.

      MinIO dijo:  ${retention_error}

      Existe, pero se creo sin \`--with-lock\`, y eso NO SE PUEDE ARREGLAR: el bloqueo es una
      propiedad de la CREACION del bucket. Activar el versionado despues tampoco vale.

      Lo mas probable es que lo creara el backend por el camino perezoso
      (\`makeBucket(bucket, "")\`, sin bloqueo) antes de que este bootstrap llegara a correr.

      Sin bloqueo, un texto legal publicado se puede borrar o reescribir, y entonces la prueba
      de consentimiento que apunta a el no demuestra nada. No se sigue adelante: seguir
      aparentaria funcionar durante anos, que es exactamente el fallo que hay que evitar.

      Como se arregla (hay que BORRAR y RECREAR, no hay otra):

        1. Comprueba que no haya nada que perder:
             mc ls --recursive <alias>/${LEGAL_BUCKET}
        2. Borra el bucket (se puede: no tiene bloqueo, por eso estamos aqui):
             mc rb --force <alias>/${LEGAL_BUCKET}
        3. Vuelve a levantar la pila. Este script lo creara ya con bloqueo.

      En una pila de desarrollo tambien vale tirar el volumen de MinIO entero.

EOF
    exit 1
  fi

  # El bucket de BORRADORES es lo contrario: versionado, para tener el historial de edicion, y
  # SIN bloqueo, porque un borrador se corrige y se tira. Meterlo en un almacen inmutable seria
  # guardar para siempre diez versiones basura de un texto que todavia no rige nada.
  ensure_bucket "$LEGAL_DRAFTS_BUCKET"
  mc version enable "${MINIO_ALIAS}/${LEGAL_DRAFTS_BUCKET}" >/dev/null
}

# La semilla del archivo legal va SIN `--overwrite`, al reves que todo lo demas de este fichero,
# y no es un descuido: lo que ya esta publicado es inmutable. `mc mirror` sin esa bandera OMITE
# lo que ya existe, que es justo la semantica que hace falta -- sembrar la primera vez y no
# volver a tocarlo nunca. Con `--overwrite`, cada arranque intentaria escribir encima y dejaria
# una version de objeto nueva, indelebles todas.
#
# Y va sin prefijo: la clave es `<clase>/v<N>.md` desde la raiz del bucket, tal cual la escribe
# el backend al publicar. Un prefijo aqui daria dos rutas distintas para lo mismo.
sync_legal_seed() {
  local_path="/import/Legal"
  if [ -d "$local_path" ]; then
    echo "Sembrando textos legales publicados en ${MINIO_ALIAS}/${LEGAL_BUCKET} (sin sobrescribir)..."
    mc mirror --exclude '.*' "$local_path" "${MINIO_ALIAS}/${LEGAL_BUCKET}"
    SYNC_COUNT=$((SYNC_COUNT + 1))
  fi
}

ensure_bucket "$TEMPLATES_BUCKET"
ensure_bucket "$DOCUMENTS_BUCKET"
ensure_bucket "$CHAT_BUCKET"
ensure_bucket "$SPOOL_BUCKET"
ensure_bucket "$USERS_BUCKET"
ensure_bucket "$DOSSIER_BUCKET"
ensure_legal_archive_bucket

SYNC_COUNT=0

sync_path "/import/Plantillas" "$TEMPLATES_BUCKET" "$TEMPLATES_PREFIX"
sync_path "/import/Seeds" "$TEMPLATES_BUCKET" "$TEMPLATE_SEEDS_PREFIX"
sync_path "/import/Unidades" "$DOCUMENTS_BUCKET" "$DOCUMENTS_PREFIX"
sync_path "/import/Chat" "$CHAT_BUCKET" "$CHAT_PREFIX"
sync_path "/import/Firmas" "$SPOOL_BUCKET" "$SPOOL_PREFIX"
sync_path "/import/Users" "$USERS_BUCKET" "$USERS_PREFIX"
sync_path "/import/Dosier" "$DOSSIER_BUCKET" "$DOSSIER_PREFIX"
sync_legal_seed

if [ "$SYNC_COUNT" -eq 0 ]; then
  echo "No se detectaron carpetas importables. Usa /import/{Plantillas,Seeds,Unidades,Chat,Firmas,Users,Dosier,Legal}."
else
  echo "Sincronizacion completada."
fi
