#!/usr/bin/env bash
#
# Genera el modelo de datos publicable a partir del esquema.
#
#   backend/database/postgres_schema.sql
#        │  (psql aplica el esquema a una base desechable)
#        ▼
#   PostgreSQL efímero  ──db2dbml──►  DBML crudo
#        │                                │
#        │                    postprocess-dbml.mjs
#        │                                ▼
#        │              docs/02-dominio-datos/consolidado.dbml
#        │              docs/02-dominio-datos/dominios/*.dbml
#        │                                │
#        │                        dbml-renderer
#        ▼                                ▼
#   (se destruye)              docs/public/diagramas/*.svg
#
# ── Por qué una base efímera y no la pila de dev ───────────────────────────────────────────
# Tres razones, y las tres importan:
#
#   1. Esto tiene que correr en CI, donde no hay ninguna pila. Si el generador dependiera de
#      `docker-env.sh` o de `stack.sh`, la puerta no podría existir.
#   2. Documentamos lo que produce `postgres_schema.sql`, no lo que haya quedado en la base de
#      alguien. Una base de dev lleva bootstrap, semillas y lo que se probara ayer.
#   3. Aplicar el esquema con ON_ERROR_STOP=1 lo VALIDA de paso. Hasta ahora nadie lo validaba:
#      `node --check` no mira SQL y el backend arranca igual porque es una cadena de texto. Así
#      sobrevivieron meses cuatro `UPDATE ... INNER JOIN ... SET` de sintaxis MySQL.
#
# No publica puertos ni toca ninguna pila: red propia y nombre propio.
#
#   bash scripts/docs/gen-dbml.sh            # genera
#   bash scripts/docs/gen-dbml.sh --check    # genera y falla si hay deriva (lo que corre en CI)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/docs/02-dominio-datos"
# Los SVG van a `public/` del sitio Astro, que es lo unico que este sirve como estatico.
# El .dbml (la fuente legible, que dbdiagram.io abre) se queda junto al modelo.
SVG_DIR="$ROOT_DIR/docs/public/diagramas"
SCHEMA="$ROOT_DIR/backend/database/postgres_schema.sql"

NODE_IMAGE="node:25.8.1"
PG_IMAGE="postgres:17"
# Sufijo propio para no chocar nunca con las pilas A-D ni con otra corrida en paralelo.
ID="dbmlgen-$$"
NET="$ID-net"
PG="$ID-pg"

MODO_CHECK=0
[ "${1:-}" = "--check" ] && MODO_CHECK=1

limpiar() {
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP" 2>/dev/null || true
}
trap limpiar EXIT

TMP="$(mktemp -d)"

echo "▸ Levantando PostgreSQL efímero ($PG)"
docker network create "$NET" >/dev/null
docker run -d --name "$PG" --network "$NET" \
  -e POSTGRES_PASSWORD=dbmlgen -e POSTGRES_DB=deasy "$PG_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$PG" pg_isready -U postgres -d deasy >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$PG" pg_isready -U postgres -d deasy >/dev/null 2>&1 || {
  echo "✖ El PostgreSQL efímero no arrancó a tiempo." >&2; exit 1; }

echo "▸ Aplicando postgres_schema.sql (esto además valida que el SQL corre)"
docker cp "$SCHEMA" "$PG:/tmp/schema.sql"
if ! docker exec "$PG" psql -U postgres -d deasy -v ON_ERROR_STOP=1 -q -f /tmp/schema.sql > "$TMP/apply.log" 2>&1; then
  echo "✖ postgres_schema.sql NO aplica. El esquema está roto:" >&2
  grep -iE "error" "$TMP/apply.log" | head -20 >&2
  exit 1
fi

echo "▸ Introspeccionando"
docker exec "$PG" psql -U postgres -d deasy -tAc \
  "select table_name||'.'||column_name
     from information_schema.columns
    where table_schema='public' and is_generated='ALWAYS'
    order by 1" > "$TMP/generadas.txt"

docker run --rm --network "$NET" -v "$TMP:/tmp/w" "$NODE_IMAGE" sh -c \
  "npx -y -p @dbml/cli@latest db2dbml postgres \
     'postgresql://postgres:dbmlgen@$PG:5432/deasy?sslmode=disable' \
     -o /tmp/w/raw.dbml" >/dev/null 2>&1

[ -s "$TMP/raw.dbml" ] || { echo "✖ db2dbml no produjo nada." >&2; exit 1; }

echo "▸ Post-procesando (notas derivadas, anotaciones y troceo por dominio)"
docker run --rm \
  -v "$TMP:/tmp/w" \
  -v "$ROOT_DIR/scripts/docs:/scripts:ro" \
  -v "$OUT_DIR:/out" \
  "$NODE_IMAGE" node /scripts/postprocess-dbml.mjs \
    /tmp/w/raw.dbml /tmp/w/generadas.txt \
    /out/anotaciones.json /scripts/dominios.json /out

echo "▸ Renderizando los diagramas"
# `db2dbml` marca el lado nullable con `?` (`<?`, `?<?`), que dbml-renderer todavia no
# entiende: falla con 'Expected "\"" ... but "?" found'. Se normaliza SOLO en la copia que
# entra al renderizador, no en el artefacto: el .dbml publicado conserva la cardinalidad
# completa, que dbdiagram.io si lee. Lo que se simplifica es el dibujo, no el modelo.
#
# Borrar todos los `?` de una linea `Ref` es seguro: ni los nombres de tabla y columna ni
# `[delete: cascade]` pueden contenerlo.
rm -rf "$TMP/render" && mkdir -p "$TMP/render"
for f in "$OUT_DIR"/dominios/*.dbml; do
  sed '/^Ref /s/?//g' "$f" > "$TMP/render/$(basename "$f")"
done

# Sin silenciar la salida: la primera version de este script mandaba stderr a /dev/null y el
# fallo del renderizador paso desapercibido -- se generaban los .dbml y ningun .svg.
rm -rf "$SVG_DIR" && mkdir -p "$SVG_DIR"
docker run --rm -v "$TMP/render:/in" -v "$SVG_DIR:/out" "$NODE_IMAGE" sh -c '
  set -e
  apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends graphviz >/dev/null
  for f in /in/*.dbml; do
    b=$(basename "$f" .dbml)
    npx -y @softwaretechnik/dbml-renderer -i "$f" -o "/out/$b.svg"
  done
' 2>&1 | grep -viE "^npm (notice|warn)|^debconf:" || true

# Los contenedores escriben como root en un volumen del host, asi que lo generado sale de
# root y el dueño del repo no puede ni borrarlo. Se devuelve la propiedad al usuario que
# lanzo el script.
docker run --rm -v "$ROOT_DIR:/repo" "$PG_IMAGE" \
  chown -R "$(id -u):$(id -g)" /repo/docs/02-dominio-datos /repo/docs/public/diagramas

n_svg=$(find "$SVG_DIR" -name "*.svg" | wc -l)
n_dbml=$(find "$OUT_DIR/dominios" -name "*.dbml" | wc -l)
[ "$n_svg" = "$n_dbml" ] || {
  echo "✖ Se esperaban $n_dbml diagramas y se renderizaron $n_svg." >&2; exit 1; }
echo "  diagramas renderizados: $n_svg"

if [ "$MODO_CHECK" = "1" ]; then
  if ! git -C "$ROOT_DIR" diff --quiet -- "$OUT_DIR" "$SVG_DIR"; then
    cat >&2 <<EOF

✖ El modelo de datos publicado NO coincide con el esquema.

  Alguien cambió backend/database/postgres_schema.sql sin regenerar los diagramas,
  o editó a mano un fichero que es un artefacto.

  Se arregla con UN comando:

      bash scripts/docs/gen-dbml.sh

  ...y se commitea lo que cambie en docs/02-dominio-datos/.

  Diferencias:
EOF
    git -C "$ROOT_DIR" diff --stat -- "$OUT_DIR" "$SVG_DIR" >&2
    exit 1
  fi
  echo "✓ El modelo publicado coincide con el esquema."
fi

echo "✓ Listo."
