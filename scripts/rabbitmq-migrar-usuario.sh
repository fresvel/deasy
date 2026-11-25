#!/usr/bin/env bash
# Crea el usuario propio de RabbitMQ y retira `guest`, en un broker QUE YA EXISTE.
#
# POR QUE HACE FALTA
# RabbitMQ solo honra RABBITMQ_DEFAULT_USER / RABBITMQ_DEFAULT_PASS en el PRIMER arranque, con el
# volumen de datos vacio. En cualquier entorno ya desplegado esas variables no hacen nada: el
# usuario no se crea, y al retirar `guest` el backend y el signer se quedan sin poder conectar.
# Este script cubre ese hueco y es idempotente.
#
#   bash scripts/rabbitmq-migrar-usuario.sh dev
#   bash scripts/rabbitmq-migrar-usuario.sh prod
#
# Lee RABBITMQ_USER / RABBITMQ_PASSWORD del .env del entorno (en qa y prod, del `.runtime`).
set -euo pipefail

ENVIRONMENT="${1:-dev}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$ROOT_DIR/docker"

case "$ENVIRONMENT" in
  dev)       ENV_FILE="$DOCKER_DIR/.env.dev" ;;
  qa|prod)   ENV_FILE="$DOCKER_DIR/.env.$ENVIRONMENT.runtime" ;;
  *) echo "Entorno no soportado: $ENVIRONMENT (usa dev, qa o prod)" >&2; exit 1 ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe $ENV_FILE" >&2
  exit 1
fi

RABBITMQ_USER="$(grep -E '^RABBITMQ_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
RABBITMQ_PASSWORD="$(grep -E '^RABBITMQ_PASSWORD=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"

if [ -z "${RABBITMQ_USER:-}" ] || [ -z "${RABBITMQ_PASSWORD:-}" ]; then
  echo "Faltan RABBITMQ_USER o RABBITMQ_PASSWORD en $ENV_FILE" >&2
  exit 1
fi
case "$RABBITMQ_PASSWORD" in
  CAMBIAR__*)
    echo "RABBITMQ_PASSWORD sigue con el valor de ejemplo. Define uno real en $ENV_FILE" >&2
    exit 1
    ;;
esac

CONTAINER="$(docker ps --filter "name=deasy-${ENVIRONMENT}-rabbitmq" --format '{{.Names}}' | head -1)"
if [ -z "$CONTAINER" ]; then
  echo "No encuentro el contenedor de RabbitMQ del entorno $ENVIRONMENT. ¿Esta levantado?" >&2
  exit 1
fi

echo "==> Broker: $CONTAINER"

# add_user falla si ya existe; en ese caso solo se actualiza la contrasena. Idempotente.
if docker exec "$CONTAINER" rabbitmqctl list_users 2>/dev/null | awk '{print $1}' | grep -qx "$RABBITMQ_USER"; then
  echo "==> El usuario '$RABBITMQ_USER' ya existe; actualizo su contrasena"
  docker exec "$CONTAINER" rabbitmqctl change_password "$RABBITMQ_USER" "$RABBITMQ_PASSWORD"
else
  echo "==> Creo el usuario '$RABBITMQ_USER'"
  docker exec "$CONTAINER" rabbitmqctl add_user "$RABBITMQ_USER" "$RABBITMQ_PASSWORD"
fi

docker exec "$CONTAINER" rabbitmqctl set_user_tags "$RABBITMQ_USER" administrator
docker exec "$CONTAINER" rabbitmqctl set_permissions -p / "$RABBITMQ_USER" ".*" ".*" ".*"

# `guest` se retira SOLO despues de que el usuario propio funcione, para no dejar el broker
# sin ninguna credencial valida si algo de lo anterior fallara.
if docker exec "$CONTAINER" rabbitmqctl list_users 2>/dev/null | awk '{print $1}' | grep -qx guest; then
  echo "==> Retiro el usuario 'guest'"
  docker exec "$CONTAINER" rabbitmqctl delete_user guest
else
  echo "==> 'guest' ya no existe"
fi

echo
echo "==> Usuarios resultantes:"
docker exec "$CONTAINER" rabbitmqctl list_users

echo
echo "Hecho. RECREA backend y signer para que tomen la nueva URL con credenciales:"
echo "  bash scripts/docker-env.sh $ENVIRONMENT up -d backend signer"
echo
echo "Ojo: 'restart' NO vale aqui. docker compose restart reutiliza el contenedor con el entorno"
echo "que ya tenia, asi que seguiria intentando conectar con las credenciales viejas (403)."
