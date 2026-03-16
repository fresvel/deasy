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

draw_menu() {
  local cursor="$1"
  clear
  echo "=============================================================="
  echo "              Deasy Docker Service Reload Menu"
  echo "=============================================================="
  echo
  echo "Usa ↑/↓ para navegar y espacio para marcar servicios."
  echo "Enter: confirmar seleccion | A: seleccionar/deseleccionar todo | Q: salir"
  echo

  local i marker pointer
  for i in "${!SERVICES[@]}"; do
    marker="[ ]"
    pointer=" "
    if [ "${SELECTED[$i]}" -eq 1 ]; then
      marker="[x]"
    fi
    if [ "$i" -eq "$cursor" ]; then
      pointer=">"
    fi
    printf "%s %s %s\n" "$pointer" "$marker" "${SERVICES[$i]}"
  done

  echo
}

toggle_all() {
  local all_selected=1
  local i
  for i in "${!SELECTED[@]}"; do
    if [ "${SELECTED[$i]}" -eq 0 ]; then
      all_selected=0
      break
    fi
  done

  local value=1
  if [ "$all_selected" -eq 1 ]; then
    value=0
  fi

  for i in "${!SELECTED[@]}"; do
    SELECTED[$i]="$value"
  done
}

collect_selected_services() {
  local result=()
  local i
  for i in "${!SERVICES[@]}"; do
    if [ "${SELECTED[$i]}" -eq 1 ]; then
      result+=("${SERVICES[$i]}")
    fi
  done
  printf "%s\n" "${result[@]}"
}

run_reload() {
  local selected_services=("$@")

  echo
  echo "--------------------------------------------------------------"
  echo "ATENCION: Se eliminaran y recrearan los contenedores seleccionados."
  echo "Esto puede interrumpir servicios y conexiones en curso."
  echo "--------------------------------------------------------------"
  echo
  echo "Servicios seleccionados:"
  printf " - %s\n" "${selected_services[@]}"
  echo
  read -r -p "Escribe RELOAD para continuar: " confirm

  if [ "$confirm" != "RELOAD" ]; then
    echo "Operacion cancelada."
    exit 0
  fi

  echo
  echo "Deteniendo servicios seleccionados..."
  docker compose stop "${selected_services[@]}" >/dev/null 2>&1 || true

  echo "Eliminando contenedores seleccionados..."
  docker compose rm -f "${selected_services[@]}" >/dev/null 2>&1 || true

  echo "Reconstruyendo y levantando solo los servicios seleccionados (sin dependencias)..."
  docker compose up -d --build --force-recreate --no-deps "${selected_services[@]}"

  echo
  echo "Reload completado."
  docker compose ps "${selected_services[@]}"
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

SERVICES=()
while IFS= read -r service; do
  if [ -n "$service" ]; then
    SERVICES+=("$service")
  fi
done < <(docker compose config --services)

if [ "${#SERVICES[@]}" -eq 0 ]; then
  echo "No se encontraron servicios en docker-compose.yml"
  exit 1
fi

SELECTED=()
for _ in "${SERVICES[@]}"; do
  SELECTED+=(0)
done

cursor=0
while true; do
  draw_menu "$cursor"
  IFS= read -rsn1 key

  if [ "$key" = $'\x1b' ]; then
    read -rsn2 key || true
    case "$key" in
      "[A")
        if [ "$cursor" -gt 0 ]; then
          cursor=$((cursor - 1))
        fi
        ;;
      "[B")
        if [ "$cursor" -lt $(( ${#SERVICES[@]} - 1 )) ]; then
          cursor=$((cursor + 1))
        fi
        ;;
    esac
  elif [ "$key" = " " ]; then
    if [ "${SELECTED[$cursor]}" -eq 1 ]; then
      SELECTED[$cursor]=0
    else
      SELECTED[$cursor]=1
    fi
  elif [ "$key" = "a" ] || [ "$key" = "A" ]; then
    toggle_all
  elif [ "$key" = "q" ] || [ "$key" = "Q" ]; then
    echo
    echo "Operacion cancelada."
    exit 0
  elif [ "$key" = "" ]; then
    selected_services=()
    while IFS= read -r service; do
      if [ -n "$service" ]; then
        selected_services+=("$service")
      fi
    done < <(collect_selected_services)
    if [ "${#selected_services[@]}" -eq 0 ]; then
      echo
      echo "Debes seleccionar al menos un servicio."
      sleep 1
      continue
    fi
    run_reload "${selected_services[@]}"
    break
  fi
done