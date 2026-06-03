#!/usr/bin/env bash
# Render + compilacion autocontenida del paquete descargado (Deasy).
# 1) Renderiza las plantillas jinja2 (.j2 -> .tex) usando una imagen temporal de Docker (python).
# 2) Compila el LaTeX resultante usando una imagen temporal de Docker (texlive/texlive).
# No requiere LaTeX ni Python instalados en el host: solo Docker + bash.
# Uso:  bash make.sh      (o ./make.sh si tiene permisos de ejecucion)
set -euo pipefail

WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$WORKDIR"
OUTDIR="$WORKDIR/output"
BUILD_DIR="$OUTDIR/build"
PDF_DIR="$OUTDIR/pdf"
LOG_DIR="$OUTDIR/logs"
mkdir -p "$BUILD_DIR" "$PDF_DIR" "$LOG_DIR"
rm -rf "${BUILD_DIR:?}"/*

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: se requiere Docker para renderizar/compilar este paquete." >&2
  exit 1
fi

UID_GID="$(id -u):$(id -g)"

# Limpieza de temporales (incluso si el render falla con set -e).
cleanup() { rm -f "$WORKDIR/.deasy_render.py" "$WORKDIR"/.deasy_data.* 2>/dev/null || true; }
trap cleanup EXIT

# --- Localiza el archivo de datos (defaults) para el render jinja2 ---
# El contenedor Docker solo monta WORKDIR, asi que si el archivo esta en el directorio padre
# (caso del paquete "seed": defaults.yaml en la raiz, make.sh en src/) hay que copiarlo dentro.
DATA_FILE=""
for candidate in data.yaml defaults.yaml ../data.yaml ../defaults.yaml; do
  if [ -f "$candidate" ]; then DATA_FILE="$candidate"; break; fi
done
RENDER_DATA=""
if [ -n "$DATA_FILE" ]; then
  case "$DATA_FILE" in
    ../*)
      case "$DATA_FILE" in
        *.json) RENDER_DATA=".deasy_data.json" ;;
        *) RENDER_DATA=".deasy_data.yaml" ;;
      esac
      cp "$DATA_FILE" "$WORKDIR/$RENDER_DATA"
      ;;
    *) RENDER_DATA="$DATA_FILE" ;;
  esac
fi

# --- Paso 1: render jinja2 (.j2 -> .tex) en sitio, con imagen Docker de Python ---
# Solo se ejecuta si hay plantillas .j2 (en 'render/' ya viene compilado y este paso es no-op).
if ls ./*.j2 >/dev/null 2>&1 || find . -name '*.j2' -not -path './output/*' | grep -q .; then
  echo ">> Renderizando plantillas jinja2 (Docker python:3-slim)..."
  cat > "$WORKDIR/.deasy_render.py" <<'PYEOF'
import os, sys
from jinja2 import Environment, StrictUndefined

defaults = {}
data_file = sys.argv[1] if len(sys.argv) > 1 else ""
if data_file and os.path.exists(data_file):
    if data_file.endswith((".yaml", ".yml")):
        import yaml
        with open(data_file, "r", encoding="utf-8") as f:
            defaults = yaml.safe_load(f) or {}
    else:
        import json
        with open(data_file, "r", encoding="utf-8") as f:
            defaults = json.load(f)

env = Environment(
    undefined=StrictUndefined,
    autoescape=False,
    block_start_string="[[%",
    block_end_string="%]]",
    comment_start_string="[[#",
    comment_end_string="#]]",
)

for root, dirs, files in os.walk("."):
    parts = root.split(os.sep)
    if "output" in parts:
        continue
    for name in files:
        if not name.endswith(".j2"):
            continue
        src = os.path.join(root, name)
        dst = os.path.join(root, name[:-3])
        with open(src, "r", encoding="utf-8") as f:
            content = f.read()
        try:
            rendered = env.from_string(content).render(**defaults)
        except Exception as exc:
            raise SystemExit(f"Fallo al renderizar {src}: {exc}")
        with open(dst, "w", encoding="utf-8") as f:
            f.write(rendered)
print("Render jinja2 OK")
PYEOF
  docker run --rm -e HOME=/tmp -u "$UID_GID" -v "$WORKDIR":/workdir -w /workdir python:3-slim \
    sh -c "pip install --quiet --no-warn-script-location --user jinja2 pyyaml && python .deasy_render.py '${RENDER_DATA}'"
  rm -f "$WORKDIR/.deasy_render.py" "$WORKDIR"/.deasy_data.*
fi

if [ ! -f "$WORKDIR/main.tex" ]; then
  echo "ERROR: no se encontro main.tex tras el render (¿falta main.tex.j2 o data.yaml?)." >&2
  exit 1
fi

# --- Paso 2: compilacion LaTeX con imagen Docker de texlive ---
# Detecta bibliografia y activa el flag (algunas plantillas hacen \input{Preambulo/bibflag}).
BIB_FILE="$WORKDIR/Referencias/references.bib"
BIB_FLAG="$WORKDIR/Preambulo/bibflag.tex"
if [ -f "$BIB_FILE" ] && grep -q '@' "$BIB_FILE"; then
  [ -d "$WORKDIR/Preambulo" ] && echo "\\showbibliografiatrue" > "$BIB_FLAG"
else
  [ -d "$WORKDIR/Preambulo" ] && echo "\\showbibliografiafalse" > "$BIB_FLAG"
fi

DOCKER_TL=(docker run --rm -u "$UID_GID" -v "$WORKDIR":/workdir -w /workdir texlive/texlive:latest)

run_pdflatex() {
  "${DOCKER_TL[@]}" pdflatex -interaction=nonstopmode -halt-on-error -shell-escape -output-directory=output/build main.tex
}
run_bibtex() { "${DOCKER_TL[@]}" bibtex output/build/main; }

echo ">> Compilando LaTeX (Docker texlive/texlive:latest)..."
run_pdflatex
if [ -f output/build/main.aux ] && grep -q '\\bibdata' output/build/main.aux; then
  if grep -q '\\citation' output/build/main.aux; then
    run_bibtex || echo "BibTeX fallo; se continua." >&2
  fi
fi
run_pdflatex
run_pdflatex

mv -f output/build/main.pdf "$PDF_DIR/main.pdf"

shopt -s nullglob
for f in output/build/*; do
  [ "$(basename "$f")" = "main.pdf" ] && continue
  mv -f "$f" "$LOG_DIR/" 2>/dev/null || true
done
shopt -u nullglob

# Compresion opcional con ghostscript si esta disponible (no es obligatoria).
if command -v gs >/dev/null 2>&1; then
  gs -o "$PDF_DIR/report.pdf" -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 "$PDF_DIR/main.pdf" >/dev/null 2>&1 || true
fi

echo "PDF generado en: output/pdf/main.pdf"
