#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_ENV_SCRIPT="$ROOT_DIR/scripts/docker-env.sh"
PROD_APPROVAL_FILE="${DEASY_PROD_DB_APPROVAL_FILE:-}"

print_prod_block_message() {
  cat <<'EOF'
Operaciones DB sobre prod estan bloqueadas por defecto.
Si realmente necesitas ejecutarlas:
  1. crea un archivo de aprobacion dentro del repo
  2. asegurate de que ese archivo este ignorado por git
  3. exporta DEASY_PROD_DB_APPROVAL_FILE con esa ruta absoluta
EOF
}

ensure_prod_approval_file() {
  if [ -z "$PROD_APPROVAL_FILE" ]; then
    print_prod_block_message
    exit 1
  fi

  case "$PROD_APPROVAL_FILE" in
    "$ROOT_DIR"/*)
      ;;
    *)
      echo "DEASY_PROD_DB_APPROVAL_FILE debe apuntar a un archivo dentro del repo."
      exit 1
      ;;
  esac

  if [ ! -f "$PROD_APPROVAL_FILE" ]; then
    echo "No existe el archivo de aprobacion para prod: $PROD_APPROVAL_FILE"
    exit 1
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "Git no esta disponible para validar la politica de aprobacion en prod."
    exit 1
  fi

  if ! git -C "$ROOT_DIR" check-ignore -q "$PROD_APPROVAL_FILE"; then
    echo "El archivo de aprobacion para prod debe estar ignorado por git: $PROD_APPROVAL_FILE"
    exit 1
  fi
}

ensure_environment() {
  local environment="$1"
  case "$environment" in
    dev|qa|prod)
      ;;
    *)
      echo "Ambiente no soportado: $environment"
      exit 1
      ;;
  esac

  if [ "$environment" = "prod" ]; then
    ensure_prod_approval_file
  fi
}

ensure_docker_ready() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker no esta instalado o no esta en PATH."
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Docker no esta disponible."
    exit 1
  fi
}

ensure_backend_running() {
  local environment="$1"
  if ! bash "$DOCKER_ENV_SCRIPT" "$environment" ps --status running --services | grep -Fx "backend" >/dev/null 2>&1; then
    echo "El servicio 'backend' no esta en ejecucion para el ambiente '$environment'."
    exit 1
  fi
}

run_in_backend() {
  local environment="$1"
  shift
  bash "$DOCKER_ENV_SCRIPT" "$environment" exec backend "$@"
}
