#!/usr/bin/env bash
# Genera el informe de cobertura del signer que consume SonarQube.
#
#   bash scripts/signer-coverage.sh [pila]      # a|b|c|d, o un entorno (dev/qa/prod). Por defecto: a
#
# POR QUE EXISTE ESTE SCRIPT. Las 266 pruebas de `signer/tests/` cubren el 89 % de `app.py`, pero
# Sonar lo publicaba como 0,0 % porque nunca se le dio un informe de Python. Este script lo produce.
# Es el equivalente de `npm run test:unit:coverage` del backend y del frontend, y como ellos hay que
# REGENERARLO ANTES DE CADA ESCANEO o Sonar leerá el de la corrida anterior sin quejarse.
#
# DOS TRAMPAS QUE RESOLVIA DESDE EL PRINCIPIO, y que no son evidentes:
#
#  1. El fichero de datos de coverage NO puede caer en /app: en dev es un bind mount del host y el
#     contenedor corre como `appuser` (uid 10001), que no puede escribir ahí. Por eso COVERAGE_FILE
#     apunta a /tmp y el XML sale por stdout.
#  2. coverage.py escribe `<source>/app</source>`, que es la ruta DENTRO del contenedor. El escáner
#     monta el repo en otro sitio y no resolvería ni un fichero: la cobertura volvería a 0 en
#     silencio, igual que pasa con las rutas `SF:` del lcov. Por eso se reescribe a `signer`,
#     relativo a la raíz del repo, que es como Sonar espera resolverlo.
#
# Y TRES QUE SE ARREGLARON EL 2026-10-09, cuando no pudo correr ni una vez:
#
#  3. ⚠️ IBA A LA PILA A PASE LO QUE PASE. Llamaba a `docker-env.sh <entorno>`, que es la pila A, así
#     que lanzado desde otro worktree medía el código de OTRO. Es exactamente el fallo que el
#     `CLAUDE.md` de la raíz documenta para las pilas paralelas, y aquí estaba cableado. Ahora acepta
#     la LETRA de la pila y llama a `stack.sh`, que además se niega si la pila monta otro worktree.
#  4. ⚠️ EL `mkdir -p signer/coverage` SE TAPABA SU PROPIO MODULO. El directorio aparece montado en
#     `/app/coverage`, y como el CWD del contenedor es `/app`, Python lo toma por un paquete de
#     espacio de nombres llamado `coverage`. El error que salía era
#     «'coverage' is a package and cannot be directly executed» en vez de «no existe el módulo»:
#     el script se sabotea el diagnóstico. Ahora el XML se genera FUERA del repo y solo se mueve a
#     su sitio cuando pasa la comprobación, así que `/app/coverage` no existe mientras corre.
#  5. ⚠️ DEJABA UN XML DE 0 BYTES AL FALLAR. El `>` crea el fichero antes de que el comando escriba,
#     así que un fallo dejaba `signer/coverage/coverage.xml` vacío — y Sonar lo habría leído como
#     cobertura CERO, que es el fallo silencioso que este script existe para evitar.
#
# La causa de fondo del 2026-10-09 no era ninguna de las tres: la imagen del signer era ANTERIOR a la
# línea del Dockerfile que instala `requirements-dev.txt`, así que `coverage` no estaba dentro. Se
# arregla con `stack.sh <letra> up -d --build signer`, y el aviso de abajo lo dice cuando toca.
set -euo pipefail

DESTINO="${1:-a}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/signer/coverage"
OUT_FILE="$OUT_DIR/coverage.xml"
TMP_FILE="$(mktemp -t signer-coverage.XXXXXX.xml)"
trap 'rm -f "$TMP_FILE"' EXIT

# Una letra de pila va por `stack.sh` (que comprueba el worktree); cualquier otra cosa se toma por
# un entorno y va por `docker-env.sh`, como antes.
if [[ "$DESTINO" =~ ^[a-dA-D]$ ]]; then
  EJECUTA=(bash "$ROOT_DIR/scripts/stack.sh" "${DESTINO,,}")
else
  EJECUTA=(bash "$ROOT_DIR/scripts/docker-env.sh" "$DESTINO")
fi

# Se comprueba el modulo ANTES de nada, y desde /tmp para que ningun directorio del repo lo tape.
if ! "${EJECUTA[@]}" exec -T signer sh -c 'cd /tmp && python -c "import coverage" 2>/dev/null'; then
  echo "ERROR: el contenedor del signer no tiene el modulo \`coverage\`." >&2
  echo "       Esta declarado en signer/requirements-dev.txt y el Dockerfile lo instala, asi que lo" >&2
  echo "       que hay es una IMAGEN VIEJA. Reconstruyela:" >&2
  echo "           bash scripts/stack.sh ${DESTINO,,} up -d --build signer" >&2
  exit 1
fi

"${EJECUTA[@]}" exec -T \
  -e COVERAGE_FILE=/tmp/.coverage signer \
  sh -c 'python -m coverage run --source=. --omit="tests/*,sigmaker/*" -m unittest discover -s tests >&2 \
         && python -m coverage xml -o -' \
  | sed 's#<source>/app</source>#<source>signer</source>#' \
  > "$TMP_FILE"

if ! grep -q '<source>signer</source>' "$TMP_FILE"; then
  echo "ERROR: el XML no quedo con <source>signer</source>; Sonar lo descartaria en silencio." >&2
  echo "       No se ha tocado $OUT_FILE: se conserva el anterior en vez de dejar uno vacio." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
mv "$TMP_FILE" "$OUT_FILE"
trap - EXIT

RATE="$(sed -n 's/.*line-rate="\([0-9.]*\)".*/\1/p' "$OUT_FILE" | head -1)"
echo "Informe escrito en signer/coverage/coverage.xml (line-rate $RATE)."
