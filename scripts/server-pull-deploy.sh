#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  cat <<'EOF'
Uso: bash scripts/server-pull-deploy.sh <qa|prod> <git|skip-git> [image-tag]

Modos:
  git       Actualiza el repositorio local desde origin antes de desplegar.
  skip-git  No toca git; solo aplica el despliegue del ambiente.

Ejemplos:
  bash scripts/server-pull-deploy.sh qa git
  bash scripts/server-pull-deploy.sh prod git prod
  bash scripts/server-pull-deploy.sh qa skip-git sha-<commit>

Variables utiles:
  DEASY_DRY_RUN=1   Muestra fetch/pull/deploy sin ejecutar cambios.
EOF
  exit 1
fi

ENVIRONMENT="$1"
UPDATE_MODE="$2"
IMAGE_TAG="${3:-}"
DRY_RUN="${DEASY_DRY_RUN:-0}"

case "$ENVIRONMENT" in
  qa)
    TARGET_BRANCH="qa"
    ;;
  prod)
    TARGET_BRANCH="main"
    ;;
  *)
    echo "Ambiente no soportado: $ENVIRONMENT"
    exit 1
    ;;
esac

case "$UPDATE_MODE" in
  git|skip-git)
    ;;
  *)
    echo "Modo no soportado: $UPDATE_MODE"
    exit 1
    ;;
esac

cd "$ROOT_DIR"

run_step() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[dry-run] %q' "$1"
    shift
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '\n'
    return 0
  fi

  "$@"
}

if [ "$UPDATE_MODE" = "git" ]; then
  CURRENT_BRANCH="$(git branch --show-current)"
  if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
    echo "La rama activa es '$CURRENT_BRANCH' y no coincide con '$TARGET_BRANCH'."
    echo "Cambia a la rama correcta antes de usar el modo git."
    exit 1
  fi

  if [ -n "$(git status --short)" ]; then
    echo "El repositorio tiene cambios locales. Limpialos o usa skip-git."
    exit 1
  fi

  run_step git fetch origin --prune
  run_step git pull --ff-only origin "$TARGET_BRANCH"
fi

run_step bash "$ROOT_DIR/scripts/apply-env.sh" "$ENVIRONMENT" server-pull "$IMAGE_TAG"
