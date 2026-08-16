#!/usr/bin/env bash
#
# Pilas de desarrollo paralelas: A, B, C y D.
#
# Existe porque la pila de dev es una sola y los montajes de codigo son RELATIVOS
# (`../backend:/app/backend`). Levantarla desde otro worktree no crea una pila nueva:
# RECREA los mismos contenedores apuntando al codigo nuevo. Paso tres veces, y las dos
# primeras se midieron pruebas contra codigo ajeno sin que nadie se enterara.
#
# Cada pila tiene su propio proyecto de compose, sus volumenes, su red y sus puertos.
# La letra es solo un ESPACIO DE NOMBRES: nada la ata a un worktree, asi que la
# comprobacion automatica de abajo es la que impide volver al mismo problema.
#
#   bash scripts/stack.sh b up -d --build
#   bash scripts/stack.sh b exec -T backend npm run test:char:run
#   bash scripts/stack.sh b stop      <- te vas por hoy, el worktree sigue
#   bash scripts/stack.sh b down      <- SOLO al retirar el worktree que monta
#   bash scripts/stack.sh status
#
# La pila vive con su WORKTREE, no con la sesion (regla cambiada el 2026-08-14).
# Antes se bajaba al terminar cada tanda; salia caro, porque el primer `up --build`
# de una pila es un `npm install` completo. Y lo que aquella regla protegia -medir
# contra codigo ajeno- ya lo impide el guard de abajo.
#
# La pila A ES la `dev` de siempre: mismo proyecto, mismos volumenes, mismos puertos.
# `docker-env.sh dev` y `stack.sh a` son la misma pila; no hay una quinta.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Letra -> (espacio de nombres, desplazamiento de puertos). La A no desplaza nada
# a proposito: asi la pila que ya esta levantada sigue siendo valida sin reconstruirla.
stack_key() {
  case "$1" in
    a|A|dev) echo "dev" ;;
    b|B)     echo "b"   ;;
    c|C)     echo "c"   ;;
    d|D)     echo "d"   ;;
    *)       return 1   ;;
  esac
}

stack_offset() {
  case "$1" in
    dev) echo 0   ;;
    b)   echo 100 ;;
    c)   echo 200 ;;
    d)   echo 300 ;;
  esac
}

usage() {
  cat <<'EOF'
Uso:
  bash scripts/stack.sh <a|b|c|d> <argumentos de docker compose...>
  bash scripts/stack.sh status

La pila A es la `dev` de siempre. B, C y D son paralelas: base, MinIO, RabbitMQ,
node_modules, red y puertos propios. Cada una monta el codigo del worktree DESDE EL
QUE la levantas.

  bash scripts/stack.sh b up -d --build
  bash scripts/stack.sh b exec -T backend npm run test:unit
  bash scripts/stack.sh b logs -f backend
  bash scripts/stack.sh b stop            <- te vas por hoy y tu worktree sigue vivo
  bash scripts/stack.sh b down            <- al RETIRAR el worktree que monta (salvo la A)

La pila vive con su worktree, no con la sesion: no se baja al terminar una tanda.
`stop` libera la RAM y conserva base, volumenes y node_modules; `start` la devuelve.

Puertos (A no desplaza; B, C y D suman 100, 200 y 300):
        proxy  https  postgres  minio  consola  signer  rabbit  rabbit-ui  docs  azimutt
  A      8088   8443      5432   9000     9001    4000    5672      15672   4321   4700
  B      8188   8543      5532   9100     9101    4100    5772      15772   4421   4800
  C      8288   8643      5632   9200     9201    4200    5872      15872   4521   4900
  D      8388   8743      5732   9300     9301    4300    5972      15972   4621   5000
EOF
}

# ── El guard ────────────────────────────────────────────────────────────────────
# Si la pila esta levantada montando OTRO worktree, cualquier cosa que hagamos aqui
# mide o modifica codigo ajeno. Antes esto dependia de que cada quien se acordara de
# comprobarlo con `docker inspect`; ahora falla solo.
guard_worktree() {
  local project="$1" verb="$2"
  local mounted
  mounted="$(docker inspect "${project}-backend-1" \
    --format '{{range .Mounts}}{{if eq .Destination "/app/backend"}}{{.Source}}{{end}}{{end}}' \
    2>/dev/null || true)"

  [ -z "$mounted" ] && return 0                 # no esta levantada: nada que comprobar
  [ "$mounted" = "$ROOT_DIR/backend" ] && return 0

  cat >&2 <<EOF

  ⛔ La pila '${project}' esta levantada montando OTRO worktree.

     monta:   ${mounted}
     y estas: ${ROOT_DIR}/backend

     '${verb}' aqui mediria o tocaria codigo que no es el tuyo. Y si es un
     'test:char:run', ademas resetearia la base que esa sesion esta usando.

     Opciones:
       - usa otra letra libre:      bash scripts/stack.sh <c|d> up -d
       - o reclama esta pila:       bash scripts/stack.sh <letra> down && ... up -d
         (avisa antes: le tiras la pila a quien la tenga)

     Para saltarte esto a sabiendas: DEASY_STACK_FORCE=1

EOF
  exit 1
}

# ── status ──────────────────────────────────────────────────────────────────────
if [ "${1:-}" = "status" ]; then
  printf '%-6s %-10s %-9s %s\n' PILA PROYECTO ESTADO "WORKTREE MONTADO"
  for letter in a b c d; do
    key="$(stack_key "$letter")"
    project="deasy-${key}"
    mounted="$(docker inspect "${project}-backend-1" \
      --format '{{range .Mounts}}{{if eq .Destination "/app/backend"}}{{.Source}}{{end}}{{end}}' \
      2>/dev/null || true)"
    running="$(docker ps -q --filter "name=^${project}-backend-1$" 2>/dev/null || true)"
    if [ -z "$mounted" ]; then
      estado="—"; donde="(sin levantar)"
    else
      [ -n "$running" ] && estado="arriba" || estado="parada"
      donde="$(dirname "$mounted")"
      [ "$donde" = "$ROOT_DIR" ] && donde="$donde   <- este worktree"
    fi
    printf '%-6s %-10s %-9s %s\n' "${letter^^}" "$project" "$estado" "$donde"
  done
  exit 0
fi

if [ "$#" -lt 2 ]; then usage; exit 1; fi

LETTER="$1"; shift
if ! KEY="$(stack_key "$LETTER")"; then
  echo "Pila no soportada: '$LETTER'. Usa a, b, c o d." >&2
  exit 1
fi

OFFSET="$(stack_offset "$KEY")"
PROJECT="deasy-${KEY}"

# El guard no aplica a lo que no lee ni escribe codigo, ni a `down`, que es justo
# como se libera una pila ocupada.
case "${1:-}" in
  down|status|ps|config|version) ;;
  *) [ "${DEASY_STACK_FORCE:-0}" = "1" ] || guard_worktree "$PROJECT" "${1:-ese comando}" ;;
esac

HTTPS_PORT=$((8443 + OFFSET))

export DEASY_STACK="$KEY"
export COMPOSE_PROJECT_NAME="$PROJECT"
export PROXY_HTTP_PORT=$((8088 + OFFSET))
export PROXY_HTTPS_PORT="$HTTPS_PORT"
export HTTPS_REDIRECT_PORT=":${HTTPS_PORT}"
export POSTGRES_PORT=$((5432 + OFFSET))
export MINIO_API_PORT=$((9000 + OFFSET))
export MINIO_CONSOLE_PORT=$((9001 + OFFSET))
export SIGNER_PORT=$((4000 + OFFSET))
export DOCS_PORT=$((4321 + OFFSET))
export AZIMUTT_PORT=$((4700 + OFFSET))
export RABBITMQ_PORT=$((5672 + OFFSET))
export RABBITMQ_MGMT_PORT=$((15672 + OFFSET))
export ORIGIN1="https://localhost:${HTTPS_PORT}"
export ORIGIN2="https://127.0.0.1:${HTTPS_PORT}"

exec bash "$ROOT_DIR/scripts/docker-env.sh" dev -p "$PROJECT" "$@"
