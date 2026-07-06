#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./_backend_db_exec.sh
. "$ROOT_DIR/scripts/_backend_db_exec.sh"

usage() {
  cat <<'EOF'
Uso:
  bash scripts/migrate-db.sh <dev|qa|prod> <migracion>
  bash scripts/migrate-db.sh <dev|qa|prod> --list

Ejemplos:
  bash scripts/migrate-db.sh dev --list
  bash scripts/migrate-db.sh qa process-definition-series
  bash scripts/migrate-db.sh qa drop-legacy-tables

Notas:
  - prod exige DEASY_PROD_DB_APPROVAL_FILE apuntando a un archivo dentro del repo e ignorado por git.
EOF
}

# El mecanismo de migraciones incrementales de MariaDB fue retirado en la migración a
# PostgreSQL. Todas las migraciones one-time históricas quedaron encapsuladas en
# backend/database/postgres_schema.sql, que es ahora la ÚNICA fuente de verdad del esquema
# (aplicada por backend/database/postgres_initializer.js -> ensurePostgresSchema). Por eso ya
# no hay migraciones legacy que listar ni resolver; estas funciones se conservan como stubs
# para no romper las llamadas existentes al script.
list_migrations() {
  cat <<'EOF'
No hay migraciones legacy disponibles.

El mecanismo de migraciones incrementales de MariaDB fue retirado en la migración a
PostgreSQL. El esquema completo vive en backend/database/postgres_schema.sql y se aplica
automáticamente al arrancar el backend (ensurePostgresSchema). Para recrear el esquema
desde cero usa el reset de base de datos, no este comando.
EOF
}

resolve_script_path() {
  # Ninguna migración legacy soportada tras la migración a PostgreSQL.
  return 1
}

if [ "$#" -ne 2 ]; then
  usage
  exit 1
fi

ENVIRONMENT="$1"
MIGRATION_NAME="$2"

if [ "$MIGRATION_NAME" = "--list" ]; then
  list_migrations
  exit 0
fi

SCRIPT_PATH="$(resolve_script_path "$MIGRATION_NAME")" || {
  echo "Migracion no soportada: $MIGRATION_NAME"
  echo
  list_migrations
  exit 1
}

ensure_environment "$ENVIRONMENT"
ensure_docker_ready
ensure_backend_running "$ENVIRONMENT"

run_in_backend "$ENVIRONMENT" node "$SCRIPT_PATH"
