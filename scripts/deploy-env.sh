#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  cat <<'EOF'
Uso: bash scripts/deploy-env.sh <qa|prod> [image-tag]

Ejemplos:
  bash scripts/deploy-env.sh qa qa
  bash scripts/deploy-env.sh prod sha-<commit>
EOF
  exit 1
fi

ENVIRONMENT="$1"
IMAGE_TAG="${2:-}"

case "$ENVIRONMENT" in
  qa|prod)
    ;;
  *)
    echo "Este script solo despliega qa o prod."
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

bash "$ROOT_DIR/scripts/docker-env.sh" "$ENVIRONMENT" pull
bash "$ROOT_DIR/scripts/docker-env.sh" "$ENVIRONMENT" --profile workers up -d --remove-orphans
