#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"
DOCKER_ENV_FILE="$DOCKER_DIR/.env"
DOCKER_ENV_EXAMPLE_FILE="$DOCKER_DIR/.env.example"
BACKEND_DIR="$ROOT_DIR/backend"
DEFAULT_SEED_FILE="$ROOT_DIR/scripts/seeds/pucese.seed.json"

RUN_DB_SEED=1
RUN_STORAGE_SEEDS=1
SEED_FILE="$DEFAULT_SEED_FILE"

usage() {
  cat <<'EOF'
Uso:
  scripts/run-seeds.sh [--skip-db] [--skip-storage] [--seed-file <ruta>]

Opciones:
  --skip-db         Omite la semilla SQL de MariaDB.
  --skip-storage    Omite la publicacion de seeds en MinIO.
  --seed-file       Ruta alternativa al archivo JSON de la semilla SQL.
  --help            Muestra esta ayuda.
EOF
}

ensure_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Falta el comando requerido: $command_name"
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

ensure_backend_dependencies() {
  ensure_command node
  ensure_command npm

  if [ -f "$BACKEND_DIR/node_modules/mysql2/package.json" ]; then
    return 0
  fi

  echo "Instalando dependencias del backend con npm install sin modificar package-lock.json..."
  npm install --prefix "$BACKEND_DIR" --no-audit --no-fund --no-package-lock
}

wait_for_mariadb() {
  local attempt
  cd "$DOCKER_DIR"

  for attempt in $(seq 1 60); do
    if MYSQL_PWD="$MARIADB_ROOT_PASSWORD" docker compose exec -T mariadb \
      mariadb-admin ping -h 127.0.0.1 -uroot --silent >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "MariaDB no estuvo lista a tiempo para aplicar la semilla."
  exit 1
}

run_db_seed() {
  echo "Aplicando semilla SQL desde $SEED_FILE..."
  MARIADB_HOST=127.0.0.1 \
  MARIADB_PORT=3306 \
  MARIADB_USER="$MARIADB_USER" \
  MARIADB_PASSWORD="$MARIADB_PASSWORD" \
  MARIADB_DATABASE="$MARIADB_DATABASE" \
  node "$ROOT_DIR/scripts/seed_pucese.mjs" apply --file "$SEED_FILE"
}

run_storage_seeds() {
  echo "Publicando seeds de plantillas en MinIO..."
  cd "$DOCKER_DIR"
  docker compose --profile storage-publish-seeds run --rm minio-publish-seeds
}

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-db)
      RUN_DB_SEED=0
      ;;
    --skip-storage)
      RUN_STORAGE_SEEDS=0
      ;;
    --seed-file)
      if [ $# -lt 2 ]; then
        echo "Falta el valor para --seed-file"
        exit 1
      fi
      shift
      if [[ "$1" = /* ]]; then
        SEED_FILE="$1"
      else
        SEED_FILE="$ROOT_DIR/$1"
      fi
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Opcion no soportada: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [ "$RUN_DB_SEED" -eq 0 ] && [ "$RUN_STORAGE_SEEDS" -eq 0 ]; then
  echo "No hay acciones para ejecutar. Usa al menos una semilla habilitada."
  exit 1
fi

if [ ! -f "$SEED_FILE" ]; then
  echo "No existe el archivo de seed SQL: $SEED_FILE"
  exit 1
fi

ensure_command docker
ensure_compose_env
load_compose_env

"$ROOT_DIR/scripts/start-services.sh"

if [ "$RUN_DB_SEED" -eq 1 ]; then
  ensure_backend_dependencies
  wait_for_mariadb
  run_db_seed
fi

if [ "$RUN_STORAGE_SEEDS" -eq 1 ]; then
  run_storage_seeds
fi

echo "Seeds completados correctamente."