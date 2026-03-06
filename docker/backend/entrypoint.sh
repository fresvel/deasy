#!/bin/bash
set -e

# Asegurar que los módulos nativos estén compilados correctamente para Linux
# Esto es necesario porque el volumen montado puede traer node_modules de Windows
echo "🔧 Verificando módulos nativos..."

# Reconstruir módulos nativos si es necesario
if [ -d "/app/backend/node_modules" ]; then
    echo "📦 Reconstruyendo módulos nativos (bcrypt, etc.)..."
    cd /app/backend
    npm rebuild bcrypt --silent 2>/dev/null || npm rebuild --silent 2>/dev/null || true
    echo "✅ Módulos nativos verificados"
fi  

# Ejecutar el comando original
exec "$@"
