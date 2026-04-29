#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

if [ "$#" -lt 2 ]; then
  cat <<'EOF'
Uso: bash scripts/docker-env.sh <dev|qa|prod|ingress|ingress-bootstrap> [compose args...]

Ejemplos:
  bash scripts/docker-env.sh dev config
  bash scripts/docker-env.sh qa pull
  bash scripts/docker-env.sh qa up -d
  bash scripts/docker-env.sh prod down
  bash scripts/docker-env.sh ingress up -d
  bash scripts/docker-env.sh ingress-bootstrap up -d
EOF
  exit 1
fi

ENVIRONMENT="$1"
shift

case "$ENVIRONMENT" in
  dev|qa|prod|ingress|ingress-bootstrap)
    ;;
  *)
    echo "Ambiente no soportado: $ENVIRONMENT"
    exit 1
    ;;
esac

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

  if [ "$environment" = "ingress" ] || [ "$environment" = "ingress-bootstrap" ]; then
    printf '%s/.env.ingress\n' "$DOCKER_DIR"
    return 0
  fi

  printf '%s/.env.%s\n' "$DOCKER_DIR" "$environment"
}

resolve_compose_files() {
  local environment="$1"

  case "$environment" in
    ingress)
      printf '%s/compose.ingress.yml\n' "$DOCKER_DIR"
      ;;
    ingress-bootstrap)
      printf '%s/compose.ingress.bootstrap.yml\n' "$DOCKER_DIR"
      ;;
    dev)
      printf '%s/compose.base.yml\n' "$DOCKER_DIR"
      printf '%s/compose.proxy.yml\n' "$DOCKER_DIR"
      printf '%s/compose.dev.yml\n' "$DOCKER_DIR"
      ;;
    qa|prod)
      printf '%s/compose.base.yml\n' "$DOCKER_DIR"
      printf '%s/compose.%s.yml\n' "$DOCKER_DIR" "$environment"
      ;;
  esac
}

ENV_FILE="$(resolve_env_file "$ENVIRONMENT")"
CONTAINER_ENV_FILE="${DEASY_CONTAINER_ENV_FILE:-$(basename "$ENV_FILE")}"
mapfile -t COMPOSE_FILES < <(resolve_compose_files "$ENVIRONMENT")

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe el archivo de entorno: $ENV_FILE"
  exit 1
fi

for compose_file in "${COMPOSE_FILES[@]}"; do
  if [ ! -f "$compose_file" ]; then
    echo "Falta el archivo compose requerido para $ENVIRONMENT: $compose_file"
    exit 1
  fi
done

if [[ "$ENVIRONMENT" =~ ^(qa|prod)$ ]] && [ ! -f "$DOCKER_DIR/$CONTAINER_ENV_FILE" ]; then
  echo "No existe el archivo de runtime para contenedores: $DOCKER_DIR/$CONTAINER_ENV_FILE"
  exit 1
fi

cd "$DOCKER_DIR"
export DEASY_CONTAINER_ENV_FILE="$CONTAINER_ENV_FILE"
COMPOSE_ARGS=()
for compose_file in "${COMPOSE_FILES[@]}"; do
  COMPOSE_ARGS+=(-f "$compose_file")
done
docker compose --env-file "$ENV_FILE" "${COMPOSE_ARGS[@]}" "$@"
