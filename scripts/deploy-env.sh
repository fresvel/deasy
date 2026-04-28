#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  cat <<'EOF'
Uso: bash scripts/deploy-env.sh <qa|prod|ingress> [image-tag]

Ejemplos:
  bash scripts/deploy-env.sh qa qa
  bash scripts/deploy-env.sh prod sha-<commit>
  bash scripts/deploy-env.sh ingress
EOF
  exit 1
fi

ENVIRONMENT="$1"
IMAGE_TAG="${2:-}"
bash "$ROOT_DIR/scripts/apply-env.sh" "$ENVIRONMENT" gh-actions "$IMAGE_TAG"
