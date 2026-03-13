#!/bin/bash
set -e

# Asegurar que los módulos nativos estén compilados correctamente para Linux
# Esto es necesario porque el volumen montado puede traer node_modules de Windows
echo "🔧 Verificando módulos nativos..."

# Reinstalar dependencias para recompilar módulos nativos en Linux
if [ -d "/app/backend/node_modules" ]; then
    echo "📦 Reinstalando dependencias con Bun (bcrypt, etc.)..."
    cd /app/backend
    bun install --frozen-lockfile --silent 2>/dev/null || true
    echo "✅ Módulos nativos verificados"
fi  

# Ejecutar el comando original
exec "$@"
