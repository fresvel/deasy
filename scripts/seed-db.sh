#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./_backend_db_exec.sh
. "$ROOT_DIR/scripts/_backend_db_exec.sh"

DEFAULT_SEED_FILE="/app/backend/scripts/seeds/pucese.seed.json"

usage() {
  cat <<'EOF'
Uso:
  bash scripts/seed-db.sh <dev|qa-local|qa|prod> <capture|apply|rbac> [--file <ruta-en-contenedor>] [--full]

apply siembra por defecto el baseline estructural (organizacion, RBAC y catalogo de
procesos); las plantillas se crean desde la UI. Usa --full para el snapshot completo (demo).

Ejemplos:
  bash scripts/seed-db.sh dev capture
  bash scripts/seed-db.sh qa-local apply            # baseline estructural
  bash scripts/seed-db.sh qa-local apply --full     # snapshot completo (demo)
  bash scripts/seed-db.sh qa-local rbac
  bash scripts/seed-db.sh qa apply --file /app/backend/scripts/seeds/pucese.seed.json

Notas:
  - prod exige DEASY_PROD_DB_APPROVAL_FILE apuntando a un archivo dentro del repo e ignorado por git.
  - La ruta de --file debe existir dentro del contenedor backend.
EOF
}

if [ "$#" -lt 2 ]; then
  usage
  exit 1
fi

ENVIRONMENT="$1"
MODE="$2"
shift 2

ensure_environment "$ENVIRONMENT"
ensure_docker_ready
ensure_backend_running "$ENVIRONMENT"

case "$MODE" in
  capture)
    if [ "$#" -gt 0 ]; then
      case "$1" in
        --file)
          if [ "$#" -ne 2 ]; then
            echo "Falta el valor para --file."
            exit 1
          fi
          run_in_backend "$ENVIRONMENT" node /app/backend/scripts/seed_pucese.mjs capture --file "$2"
          exit 0
          ;;
        *)
          echo "Parametro no soportado para capture: $1"
          usage
          exit 1
          ;;
      esac
    fi
    run_in_backend "$ENVIRONMENT" node /app/backend/scripts/seed_pucese.mjs capture
    ;;
  apply)
    APPLY_FILE="$DEFAULT_SEED_FILE"
    APPLY_MODE_FLAG="--baseline"
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --file)
          if [ "$#" -lt 2 ]; then
            echo "Falta el valor para --file."
            exit 1
          fi
          APPLY_FILE="$2"
          shift 2
          ;;
        --full)
          APPLY_MODE_FLAG="--full"
          shift
          ;;
        --baseline)
          APPLY_MODE_FLAG="--baseline"
          shift
          ;;
        *)
          echo "Parametro no soportado para apply: $1"
          usage
          exit 1
          ;;
      esac
    done
    run_in_backend "$ENVIRONMENT" node /app/backend/scripts/seed_pucese.mjs apply --file "$APPLY_FILE" "$APPLY_MODE_FLAG"
    ;;
  rbac)
    if [ "$#" -gt 0 ]; then
      echo "El modo rbac no recibe parametros."
      usage
      exit 1
    fi
    run_in_backend "$ENVIRONMENT" node /app/backend/scripts/apply_rbac_patch.mjs
    ;;
  *)
    echo "Modo no soportado: $MODE"
    usage
    exit 1
    ;;
esac
