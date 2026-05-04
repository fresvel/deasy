#!/bin/bash
set -e

# Ensure native modules are compiled for the Linux container.
# This matters when mounted volumes bring node_modules from another platform.
echo "Verificando modulos nativos..."

if [ -d "/app/backend/node_modules" ]; then
  echo "Reconstruyendo modulos nativos (bcrypt, etc.)..."
  cd /app/backend
  npm rebuild bcrypt --silent 2>/dev/null || npm rebuild --silent 2>/dev/null || true
  echo "Modulos nativos verificados"
fi

exec "$@"
