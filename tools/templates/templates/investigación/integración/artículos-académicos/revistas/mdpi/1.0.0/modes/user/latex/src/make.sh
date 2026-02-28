#! /bin/bash
set -euo pipefail

WORKDIR="$(pwd)"
OUTDIR="$WORKDIR/output"
BUILD_DIR="$OUTDIR/build"
PDF_DIR="$OUTDIR/pdf"
LOG_DIR="$OUTDIR/logs"

mkdir -p "$BUILD_DIR" "$PDF_DIR" "$LOG_DIR"
rm -rf "$BUILD_DIR"/*

DOCKER_RUN=(docker run --rm -u "$(id -u):$(id -g)" -v "$WORKDIR":/workdir -w /workdir texlive/texlive:latest)

run_pdflatex() {
  "${DOCKER_RUN[@]}" pdflatex -interaction=nonstopmode -halt-on-error -output-directory=output/build main.tex
}

run_bibtex() {
  "${DOCKER_RUN[@]}" bibtex output/build/main
}

run_pdflatex

if [ -f output/build/main.aux ] && grep -q '\\bibdata' output/build/main.aux; then
  if grep -q '\\citation' output/build/main.aux; then
    if ! run_bibtex; then
      echo "BibTeX failed; continuing." >&2
    fi
  else
    echo "No citations; skipping BibTeX." >&2
  fi
else
  echo "No bibdata; skipping BibTeX." >&2
fi

run_pdflatex
run_pdflatex

mv -f output/build/main.pdf output/pdf/main.pdf

shopt -s nullglob
for f in output/build/*; do
  if [ "$(basename "$f")" != "main.pdf" ]; then
    mv -f "$f" "$LOG_DIR/"
  fi
done
shopt -u nullglob

gs -o output/pdf/report.pdf -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 output/pdf/main.pdf
