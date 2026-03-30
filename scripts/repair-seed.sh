#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"
DOCKER_ENV_FILE="$DOCKER_DIR/.env"
DOCKER_ENV_EXAMPLE_FILE="$DOCKER_DIR/.env.example"
SCHEMA_FILE="$ROOT_DIR/backend/database/mariadb_schema.sql"

usage() {
  cat <<'EOF'
Uso:
  scripts/repair-seed.sh [opciones de scripts/run-seeds.sh]

Descripcion:
  Repara el esquema MariaDB aplicando backend/database/mariadb_schema.sql
  y luego ejecuta scripts/run-seeds.sh.

Comportamiento por defecto:
  Si no se pasan argumentos, ejecuta solo la semilla SQL:
    scripts/run-seeds.sh --skip-storage

Ejemplos:
  scripts/repair-seed.sh
  scripts/repair-seed.sh --seed-file scripts/seeds/pucese.seed.backup.json --skip-storage
  scripts/repair-seed.sh --skip-db
EOF
}

ensure_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Falta el comando requerido: $name"
    exit 1
  fi
}

ensure_compose_env() {
  if [ -f "$DOCKER_ENV_FILE" ]; then
    return 0
  fi

  if [ -f "$DOCKER_ENV_EXAMPLE_FILE" ]; then
    cp "$DOCKER_ENV_EXAMPLE_FILE" "$DOCKER_ENV_FILE"
    echo "Se creo $DOCKER_ENV_FILE a partir de .env.example"
    return 0
  fi

  echo "Falta $DOCKER_ENV_FILE y no existe una plantilla .env.example"
  exit 1
}

load_compose_env() {
  set -a
  # shellcheck disable=SC1090
  . "$DOCKER_ENV_FILE"
  set +a
}

ensure_service_running() {
  local service_name="$1"
  cd "$DOCKER_DIR"

  if docker compose ps --status running --services | grep -Fx "$service_name" >/dev/null 2>&1; then
    return 0
  fi

  echo "El servicio '$service_name' no esta en ejecucion. Inicialo antes de correr repair-seed."
  exit 1
}

ensure_required_env() {
  local required=(MARIADB_USER MARIADB_PASSWORD MARIADB_DATABASE)
  local key
  for key in "${required[@]}"; do
    if [ -z "${!key:-}" ]; then
      echo "Variable requerida no definida en docker/.env: $key"
      exit 1
    fi
  done
}

apply_schema() {
  if [ ! -f "$SCHEMA_FILE" ]; then
    echo "No existe el schema SQL: $SCHEMA_FILE"
    exit 1
  fi

  echo "Aplicando esquema MariaDB desde $SCHEMA_FILE..."
  cd "$ROOT_DIR"
  cat "$SCHEMA_FILE" | docker compose -f docker/docker-compose.yml exec -T mariadb \
    mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

ensure_command docker
ensure_compose_env
load_compose_env
ensure_required_env
ensure_service_running mariadb

apply_schema

if [ "$#" -eq 0 ]; then
  echo "Ejecutando run-seeds en modo SQL solamente (--skip-storage)..."
  "$ROOT_DIR/scripts/run-seeds.sh" --skip-storage
else
  echo "Ejecutando run-seeds con argumentos personalizados: $*"
  "$ROOT_DIR/scripts/run-seeds.sh" "$@"
fi

echo "repair-seed finalizado correctamente."
