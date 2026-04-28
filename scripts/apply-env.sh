#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  cat <<'EOF'
Uso: bash scripts/apply-env.sh <qa|prod|ingress> <source-mode> [image-tag]

Source modes:
  gh-actions     Despliegue iniciado por GitHub Actions sobre un host remoto.
  server-pull    Despliegue iniciado por el propio servidor tras actualizar codigo o artefactos.

Ejemplos:
  bash scripts/apply-env.sh qa gh-actions qa
  bash scripts/apply-env.sh prod gh-actions sha-<commit>
  bash scripts/apply-env.sh qa server-pull qa
  bash scripts/apply-env.sh ingress gh-actions

Variables utiles:
  DEASY_DRY_RUN=1   Muestra lo que ejecutaria sin aplicar cambios.
EOF
  exit 1
fi

ENVIRONMENT="$1"
SOURCE_MODE="$2"
IMAGE_TAG="${3:-}"
DRY_RUN="${DEASY_DRY_RUN:-0}"

case "$ENVIRONMENT" in
  qa|prod|ingress)
    ;;
  *)
    echo "Este script solo despliega qa, prod o ingress."
    exit 1
    ;;
esac

case "$SOURCE_MODE" in
  gh-actions|server-pull)
    ;;
  *)
    echo "Modo no soportado: $SOURCE_MODE"
    exit 1
    ;;
esac

if [[ "$ENVIRONMENT" =~ ^(qa|prod)$ ]]; then
  RUNTIME_ENV_FILE="$DOCKER_DIR/.env.$ENVIRONMENT.runtime"
  if [ ! -f "$RUNTIME_ENV_FILE" ]; then
    echo "Falta el archivo runtime requerido para $ENVIRONMENT: $RUNTIME_ENV_FILE"
    exit 1
  fi
  export DEASY_ENV_FILE="$RUNTIME_ENV_FILE"
  export DEASY_CONTAINER_ENV_FILE="$(basename "$RUNTIME_ENV_FILE")"
fi

if [ -n "$IMAGE_TAG" ]; then
  export BACKEND_IMAGE_TAG="$IMAGE_TAG"
  export FRONTEND_IMAGE_TAG="$IMAGE_TAG"
  export SIGNER_IMAGE_TAG="$IMAGE_TAG"
  export ANALYTICS_IMAGE_TAG="$IMAGE_TAG"
fi

PUBLIC_INGRESS_NETWORK="${PUBLIC_INGRESS_NETWORK:-deasy_public_ingress}"

run_step() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[dry-run] %q' "$1"
    shift
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n'
    return 0
  fi

  "$@"
}

cleanup_legacy_public_proxies() {
  local legacy_names=(
    "deasy-public-ingress"
    "deasy-public-ingress-bootstrap"
    "deasy-nginx-proxy"
    "deasy-prod-nginx-proxy-1"
    "deasy-qa-nginx-proxy-1"
  )

  local name
  for name in "${legacy_names[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -Fxq "$name"; then
      run_step docker rm -f "$name"
    fi
  done
}

echo "Aplicando ambiente '$ENVIRONMENT' via '$SOURCE_MODE'"
if [ "$DRY_RUN" = "1" ]; then
  printf '[dry-run] docker network inspect %q\n' "$PUBLIC_INGRESS_NETWORK"
  printf '[dry-run] docker network create %q\n' "$PUBLIC_INGRESS_NETWORK"
elif ! docker network inspect "$PUBLIC_INGRESS_NETWORK" >/dev/null 2>&1; then
  docker network create "$PUBLIC_INGRESS_NETWORK"
fi
case "$ENVIRONMENT" in
  ingress)
    cleanup_legacy_public_proxies
    run_step bash "$ROOT_DIR/scripts/docker-env.sh" ingress up -d --remove-orphans
    ;;
  qa|prod)
    run_step bash "$ROOT_DIR/scripts/docker-env.sh" "$ENVIRONMENT" pull
    run_step bash "$ROOT_DIR/scripts/docker-env.sh" "$ENVIRONMENT" --profile workers up -d --remove-orphans
    ;;
esac
