#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./_backend_db_exec.sh
. "$ROOT_DIR/scripts/_backend_db_exec.sh"

# Servicios de aplicacion que mantienen conexiones/estado contra PostgreSQL/MinIO/RabbitMQ y
# que deben reciclarse tras el wipe para reconectar limpio (el backend ademas re-corre la
# inicializacion de esquema y queda en modo bootstrap). Solo se tocan los que existan en el entorno.
APP_SERVICES=("backend" "signer")

# Proxy reverso de dev: usa `proxy_pass http://backend:3030/` con resolución estática, es
# decir resuelve la IP del backend UNA vez al arrancar y la cachea. Al reciclar el backend su IP puede
# cambiar y el proxy queda apuntando a la IP vieja → 502 (connection refused). Tras reciclar hay que
# recargarlo para que vuelva a resolver. Solo aplica si el servicio existe en el entorno.
PROXY_SERVICE="nginx-proxy"

usage() {
  cat <<'EOF'
Uso:
  bash scripts/reset-system.sh <dev|qa|prod> [flags]

Regresa el sistema al estado base (instalación virgen) para arrancar el bootstrap:
  - PostgreSQL: dropea todas las tablas y recrea el schema vacío (incluye dossier, chat, etc.)
  - MinIO:   vacía todos los buckets gestionados por la app

Tras el wipe reinicia los servicios de app (backend, signer) para que
reconecten en limpio; el backend detecta la instalación virgen y la UI pide crear el primer
administrador.

Flags de wipe (se pasan a reset_system.mjs):
  --keep-db        conserva PostgreSQL
  --keep-minio     conserva los buckets de MinIO

Flags de servicios:
  --rebuild        reconstruye las imágenes y recrea los servicios (en vez de solo reiniciar);
                   úsalo en qa/prod o cuando cambien dependencias/imagen.
  --no-restart     no toca los servicios (tendrás que reiniciar el backend a mano).

Ejemplos:
  bash scripts/reset-system.sh dev
  bash scripts/reset-system.sh dev --keep-minio
  bash scripts/reset-system.sh qa --rebuild
  bash scripts/reset-system.sh dev --no-restart

Notas:
  - prod exige DEASY_PROD_DB_APPROVAL_FILE apuntando a un archivo dentro del repo e ignorado por git.
EOF
}

if [ "$#" -lt 1 ]; then
  usage
  exit 1
fi

ENVIRONMENT="$1"
shift

RESTART_MODE="restart"   # restart | rebuild | none
NODE_ARGS=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --rebuild)
      RESTART_MODE="rebuild"
      ;;
    --no-restart)
      RESTART_MODE="none"
      ;;
    --keep-db|--keep-minio)
      NODE_ARGS+=("$1")
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Parametro no soportado: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

# Reinicia (o reconstruye) los servicios de app que realmente existen en este entorno.
recycle_app_services() {
  local mode="$1"
  local available
  available="$(bash "$DOCKER_ENV_SCRIPT" "$ENVIRONMENT" config --services 2>/dev/null || true)"

  local selected=()
  local svc
  for svc in "${APP_SERVICES[@]}"; do
    if printf '%s\n' "$available" | grep -Fxq "$svc"; then
      selected+=("$svc")
    fi
  done

  if [ "${#selected[@]}" -eq 0 ]; then
    echo "• No hay servicios de app definidos en '$ENVIRONMENT' para reciclar."
    return 0
  fi

  if [ "$mode" = "rebuild" ]; then
    echo "→ Reconstruyendo y recreando: ${selected[*]}"
    bash "$DOCKER_ENV_SCRIPT" "$ENVIRONMENT" up -d --build --force-recreate --no-deps "${selected[@]}"
  else
    echo "→ Reiniciando: ${selected[*]}"
    bash "$DOCKER_ENV_SCRIPT" "$ENVIRONMENT" restart "${selected[@]}"
  fi
}

# Recarga el proxy para que re-resuelva la IP del backend recién reciclado (evita el 502 por upstream
# obsoleto). Reload graceful (sin downtime); si no se puede, cae a restart del servicio.
reload_proxy() {
  local available
  available="$(bash "$DOCKER_ENV_SCRIPT" "$ENVIRONMENT" config --services 2>/dev/null || true)"
  if ! printf '%s\n' "$available" | grep -Fxq "$PROXY_SERVICE"; then
    return 0
  fi

  echo "→ Recargando proxy '$PROXY_SERVICE' (re-resuelve el upstream del backend)..."
  if bash "$DOCKER_ENV_SCRIPT" "$ENVIRONMENT" exec -T "$PROXY_SERVICE" nginx -s reload >/dev/null 2>&1; then
    return 0
  fi
  echo "  reload graceful falló; reiniciando '$PROXY_SERVICE'..."
  bash "$DOCKER_ENV_SCRIPT" "$ENVIRONMENT" restart "$PROXY_SERVICE"
}

ensure_environment "$ENVIRONMENT"
ensure_docker_ready
ensure_backend_running "$ENVIRONMENT"

if [ "${#NODE_ARGS[@]}" -gt 0 ]; then
  run_in_backend "$ENVIRONMENT" node /app/backend/scripts/reset_system.mjs "${NODE_ARGS[@]}"
else
  run_in_backend "$ENVIRONMENT" node /app/backend/scripts/reset_system.mjs
fi

echo ""
if [ "$RESTART_MODE" = "none" ]; then
  echo "• Servicios sin tocar (--no-restart). Reinicia el backend para entrar en modo bootstrap:"
  echo "    bash scripts/docker-env.sh $ENVIRONMENT restart backend"
else
  recycle_app_services "$RESTART_MODE"
  reload_proxy
  echo "✅ Servicios reciclados y proxy recargado. El sistema está en estado base y en modo bootstrap."
fi
