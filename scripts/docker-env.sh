#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

if [ "$#" -lt 2 ]; then
  cat <<'EOF'
Uso: bash scripts/docker-env.sh <dev|qa|prod> [compose args...]

Ejemplos:
  bash scripts/docker-env.sh dev config
  bash scripts/docker-env.sh qa pull
  bash scripts/docker-env.sh qa up -d
  bash scripts/docker-env.sh prod down
EOF
  exit 1
fi

ENVIRONMENT="$1"
shift

case "$ENVIRONMENT" in
  dev|qa|prod)
    ;;
  *)
    echo "Ambiente no soportado: $ENVIRONMENT"
    exit 1
    ;;
esac

COMPOSE_BASE="$DOCKER_DIR/compose.base.yml"
COMPOSE_ENV="$DOCKER_DIR/compose.$ENVIRONMENT.yml"

resolve_env_file() {
  local environment="$1"
  local explicit_file="${DEASY_ENV_FILE:-}"

  if [ -n "$explicit_file" ]; then
    printf '%s\n' "$explicit_file"
    return 0
  fi

  if [ "$environment" = "dev" ]; then
    printf '%s/.env.dev\n' "$DOCKER_DIR"
    return 0
  fi

  printf '%s/.env.%s\n' "$DOCKER_DIR" "$environment"
}

ENV_FILE="$(resolve_env_file "$ENVIRONMENT")"
CONTAINER_ENV_FILE="${DEASY_CONTAINER_ENV_FILE:-$(basename "$ENV_FILE")}"

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe el archivo de entorno: $ENV_FILE"
  exit 1
fi

if [ ! -f "$COMPOSE_BASE" ] || [ ! -f "$COMPOSE_ENV" ]; then
  echo "Faltan archivos compose para el ambiente $ENVIRONMENT"
  exit 1
fi

if [ "$ENVIRONMENT" != "dev" ] && [ ! -f "$DOCKER_DIR/$CONTAINER_ENV_FILE" ]; then
  echo "No existe el archivo de runtime para contenedores: $DOCKER_DIR/$CONTAINER_ENV_FILE"
  exit 1
fi

cd "$DOCKER_DIR"
export DEASY_CONTAINER_ENV_FILE="$CONTAINER_ENV_FILE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" "$@"
