#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

if [ "$#" -lt 2 ]; then
  cat <<'EOF'
Uso: bash scripts/docker-env.sh <dev|qa|prod> <comando> [args...]

Ejemplos:
  bash scripts/docker-env.sh dev config
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

ENV_FILE="$DOCKER_DIR/.env.$ENVIRONMENT"
COMPOSE_BASE="$DOCKER_DIR/compose.base.yml"
COMPOSE_ENV="$DOCKER_DIR/compose.$ENVIRONMENT.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe el archivo de entorno: $ENV_FILE"
  exit 1
fi

if [ ! -f "$COMPOSE_BASE" ] || [ ! -f "$COMPOSE_ENV" ]; then
  echo "Faltan archivos compose para el ambiente $ENVIRONMENT"
  exit 1
fi

cd "$DOCKER_DIR"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" "$@"
