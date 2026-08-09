#!/usr/bin/env bash
# Genera el informe de cobertura del signer que consume SonarQube.
#
#   bash scripts/signer-coverage.sh [entorno]      # por defecto: dev
#
# POR QUE EXISTE ESTE SCRIPT. Las 229 pruebas de `signer/tests/` cubren el 88 % de `app.py`, pero
# Sonar lo publicaba como 0,0 % porque nunca se le dio un informe de Python. Este script lo produce.
# Es el equivalente de `npm run test:unit:coverage` del backend y del frontend, y como ellos hay que
# REGENERARLO ANTES DE CADA ESCANEO o Sonar leerá el de la corrida anterior sin quejarse.
#
# DOS TRAMPAS QUE RESUELVE, y que no son evidentes:
#
#  1. El fichero de datos de coverage NO puede caer en /app: en dev es un bind mount del host y el
#     contenedor corre como `appuser` (uid 10001), que no puede escribir ahí. Por eso COVERAGE_FILE
#     apunta a /tmp y el XML sale por stdout.
#  2. coverage.py escribe `<source>/app</source>`, que es la ruta DENTRO del contenedor. El escáner
#     monta el repo en otro sitio y no resolvería ni un fichero: la cobertura volvería a 0 en
#     silencio, igual que pasa con las rutas `SF:` del lcov. Por eso se reescribe a `signer`,
#     relativo a la raíz del repo, que es como Sonar espera resolverlo.
set -euo pipefail

ENVIRONMENT="${1:-dev}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/signer/coverage"
OUT_FILE="$OUT_DIR/coverage.xml"

mkdir -p "$OUT_DIR"

bash "$ROOT_DIR/scripts/docker-env.sh" "$ENVIRONMENT" exec -T \
  -e COVERAGE_FILE=/tmp/.coverage signer \
  sh -c 'python -m coverage run --source=. --omit="tests/*,sigmaker/*" -m unittest discover -s tests >&2 \
         && python -m coverage xml -o -' \
  | sed 's#<source>/app</source>#<source>signer</source>#' \
  > "$OUT_FILE"

if ! grep -q '<source>signer</source>' "$OUT_FILE"; then
  echo "ERROR: el XML no quedó con <source>signer</source>; Sonar lo descartaría en silencio." >&2
  exit 1
fi

RATE="$(sed -n 's/.*line-rate="\([0-9.]*\)".*/\1/p' "$OUT_FILE" | head -1)"
echo "Informe escrito en signer/coverage/coverage.xml (line-rate $RATE)."
