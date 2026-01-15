#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no esta instalado o no esta en PATH."
  exit 1
fi

if [ ! -f "$DOCKER_DIR/docker-compose.yml" ]; then
  echo "No se encontro docker-compose.yml en $DOCKER_DIR"
  exit 1
fi

cd "$DOCKER_DIR"

docker compose up -d
docker compose --profile workers up -d

echo "Servicios iniciados. Usa 'docker compose ps' para verificar estado."
