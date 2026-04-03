#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  cat <<'EOF'
Uso: bash scripts/apply-env.sh <qa|prod> <source-mode> [image-tag]

Source modes:
  gh-actions     Despliegue iniciado por GitHub Actions sobre un host remoto.
  server-pull    Despliegue iniciado por el propio servidor tras actualizar codigo o artefactos.

Ejemplos:
  bash scripts/apply-env.sh qa gh-actions qa
  bash scripts/apply-env.sh prod gh-actions sha-<commit>
  bash scripts/apply-env.sh qa server-pull qa

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
  qa|prod)
    ;;
  *)
    echo "Este script solo despliega qa o prod."
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

RUNTIME_ENV_FILE="$DOCKER_DIR/.env.$ENVIRONMENT.runtime"
if [ -f "$RUNTIME_ENV_FILE" ]; then
  export DEASY_ENV_FILE="$RUNTIME_ENV_FILE"
fi

if [ -n "$IMAGE_TAG" ]; then
  export BACKEND_IMAGE_TAG="$IMAGE_TAG"
  export FRONTEND_IMAGE_TAG="$IMAGE_TAG"
  export SIGNER_IMAGE_TAG="$IMAGE_TAG"
  export ANALYTICS_IMAGE_TAG="$IMAGE_TAG"
fi

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

echo "Aplicando ambiente '$ENVIRONMENT' via '$SOURCE_MODE'"
run_step bash "$ROOT_DIR/scripts/docker-env.sh" "$ENVIRONMENT" pull
run_step bash "$ROOT_DIR/scripts/docker-env.sh" "$ENVIRONMENT" --profile workers up -d --remove-orphans
