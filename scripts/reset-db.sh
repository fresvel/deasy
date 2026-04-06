#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./_backend_db_exec.sh
. "$ROOT_DIR/scripts/_backend_db_exec.sh"

usage() {
  cat <<'EOF'
Uso:
  bash scripts/reset-db.sh <dev|qa|prod>

Ejemplos:
  bash scripts/reset-db.sh dev
  bash scripts/reset-db.sh qa

Notas:
  - prod exige DEASY_PROD_DB_APPROVAL_FILE apuntando a un archivo dentro del repo e ignorado por git.
EOF
}

if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

ENVIRONMENT="$1"

ensure_environment "$ENVIRONMENT"
ensure_docker_ready
ensure_backend_running "$ENVIRONMENT"

run_in_backend "$ENVIRONMENT" node /app/backend/scripts/reset_mariadb.mjs
