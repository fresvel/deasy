#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"
DOCKER_ENV_FILE="$DOCKER_DIR/.env"
DOCKER_ENV_EXAMPLE_FILE="$DOCKER_DIR/.env.example"

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

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no esta instalado o no esta en PATH."
  exit 1
fi

ensure_docker_ready
ensure_compose_env

if [ ! -f "$DOCKER_DIR/docker-compose.yml" ]; then
  echo "No se encontro docker-compose.yml en $DOCKER_DIR"
  exit 1
fi

cd "$DOCKER_DIR"

docker compose up -d
docker compose --profile workers up -d

echo "Servicios iniciados. Usa 'docker compose ps' para verificar estado."
