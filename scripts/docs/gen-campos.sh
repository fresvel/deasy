#!/usr/bin/env bash
# Regenera `docs/src/content/docs/referencia/campos-proceso-documento.md` desde el catalogo de
# PostgreSQL de la pila que se le indique. El generador corre DENTRO del contenedor (necesita el
# pool) y emite a stdout; quien escribe el fichero es este envoltorio, porque `docs/` solo existe
# en el anfitrion.
#
#   bash scripts/docs/gen-campos.sh b            regenera
#   bash scripts/docs/gen-campos.sh b --check    falla si la pagina no coincide con la base
#
# ⚠️ Hazlo contra una base RECIEN CREADA. Desde `TD7-s` el esquema describe la forma y no converge
# bases anteriores: una pila levantada hace tiempo puede tener forma vieja y la pagina saldria
# mintiendo. `npm run test:char:run` la recrea.
set -euo pipefail
PILA="${1:?Uso: gen-campos.sh <pila a|b|c|d> [--check]}"
MODO="${2:-write}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESTINO="$RAIZ/docs/src/content/docs/referencia/campos-proceso-documento.md"

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
bash "$RAIZ/scripts/stack.sh" "$PILA" exec -T backend node scripts/docs/gen-campos-md.mjs > "$TMP"

if [ "$MODO" = "--check" ]; then
  if ! diff -q "$DESTINO" "$TMP" >/dev/null 2>&1; then
    echo "✖ La referencia de campos NO coincide con la base. Regenerala:" >&2
    echo "    bash scripts/docs/gen-campos.sh $PILA" >&2
    diff -u "$DESTINO" "$TMP" | head -40 >&2 || true
    exit 1
  fi
  echo "✓ La referencia de campos coincide con la base."
  exit 0
fi
cp "$TMP" "$DESTINO"
echo "✓ escrito: docs/src/content/docs/referencia/campos-proceso-documento.md"
