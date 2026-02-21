#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8081}"
NODE_MAJOR="${NODE_MAJOR:-18}"
INSTALL_DEPS="${INSTALL_DEPS:-auto}"

if [[ ! -f "$HOME/.nvm/nvm.sh" ]]; then
  echo "No se encontro nvm en $HOME/.nvm/nvm.sh" >&2
  echo "Instala nvm o usa Node ${NODE_MAJOR} manualmente." >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$HOME/.nvm/nvm.sh"

if ! nvm ls "$NODE_MAJOR" >/dev/null 2>&1; then
  echo "Instalando Node ${NODE_MAJOR}..."
  nvm install "$NODE_MAJOR"
fi
nvm use "$NODE_MAJOR" >/dev/null

if [[ "$INSTALL_DEPS" == "always" ]] || [[ ! -x "node_modules/.bin/vue-cli-service" ]]; then
  echo "Instalando dependencias (legacy peer deps)..."
  npm install --legacy-peer-deps
fi

echo "Levantando servicio en http://localhost:${PORT}"
exec npm run serve -- --host "$HOST" --port "$PORT"
