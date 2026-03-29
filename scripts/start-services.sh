#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"
DOCKER_ENV_FILE="$DOCKER_DIR/.env"
DOCKER_ENV_EXAMPLE_FILE="$DOCKER_DIR/.env.example"
BUILD_MODE="none"
DEPENDENCY_VOLUMES=(
  docker_backend_node_modules_v2
  docker_frontend_node_modules
  docker_frontend_pnpm_store
  docker_docs_node_modules
  docker_docs_pnpm_store
  docker_signer_node_modules
  docker_signer_sigmaker_node_modules
)

print_usage() {
  cat <<'EOF'
Uso: bash scripts/start-services.sh [opcion]

Opciones:
  --up        Solo levantar servicios (comportamiento por defecto)
  --build     Construir imagenes antes de levantar servicios
  --no-cache  Construir imagenes sin cache antes de levantar servicios
  --help      Mostrar esta ayuda
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --up)
        BUILD_MODE="none"
        ;;
      --build)
        BUILD_MODE="build"
        ;;
      --no-cache)
        BUILD_MODE="no-cache"
        ;;
      --help|-h)
        print_usage
        exit 0
        ;;
      *)
        echo "Opcion no soportada: $1"
        print_usage
        exit 1
        ;;
    esac
    shift
  done
}

ensure_docker_ready() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  case "$(uname -s)" in
    Linux)
      if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl start docker >/dev/null 2>&1 || true
      elif command -v service >/dev/null 2>&1; then
        sudo service docker start >/dev/null 2>&1 || true
      fi
      ;;
    Darwin)
      if command -v open >/dev/null 2>&1; then
        open -a Docker >/dev/null 2>&1 || true
      fi
      ;;
  esac

  for _ in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "Docker no esta disponible. Inicia Docker Desktop o el daemon de Docker y vuelve a intentar."
  exit 1
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

reset_dependency_volumes() {
  docker compose down

  for volume in "${DEPENDENCY_VOLUMES[@]}"; do
    docker volume rm -f "$volume" >/dev/null 2>&1 || true
  done
}

compose_build() {
  local cache_args=("$@")
  DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker compose build "${cache_args[@]}"
}

start_worker_services() {
  if docker image inspect docker-analytics >/dev/null 2>&1; then
    docker compose --profile workers up -d --no-build
    return 0
  fi

  echo "Se omite el perfil workers: la imagen docker-analytics no esta disponible localmente."
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no esta instalado o no esta en PATH."
  exit 1
fi

parse_args "$@"

ensure_docker_ready
ensure_compose_env

if [ ! -f "$DOCKER_DIR/docker-compose.yml" ]; then
  echo "No se encontro docker-compose.yml en $DOCKER_DIR"
  exit 1
fi

cd "$DOCKER_DIR"

case "$BUILD_MODE" in
  build)
    reset_dependency_volumes
    compose_build
    ;;
  no-cache)
    reset_dependency_volumes
    compose_build --no-cache
    ;;
esac

docker compose up -d
start_worker_services

echo "Servicios iniciados. Usa 'docker compose ps' para verificar estado."
