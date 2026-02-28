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

run_xelatex() {
  "${DOCKER_RUN[@]}" xelatex -interaction=nonstopmode -halt-on-error -shell-escape -output-directory=output/build main.tex
}

run_bibtex() {
  "${DOCKER_RUN[@]}" bibtex output/build/main
}

run_xelatex

if [ -f output/build/main.aux ] && rg -q '\\bibdata' output/build/main.aux; then
  if rg -q '\\citation' output/build/main.aux; then
    if ! run_bibtex; then
      echo "BibTeX failed; continuing." >&2
    fi
  else
    echo "No citations; skipping BibTeX." >&2
  fi
else
  echo "No bibdata; skipping BibTeX." >&2
fi

run_xelatex
run_xelatex

mv -f output/build/main.pdf output/pdf/main.pdf

shopt -s nullglob
for f in output/build/*; do
  if [ "$(basename "$f")" != "main.pdf" ]; then
    if [ -d "$f" ]; then
      rm -rf "$LOG_DIR/$(basename "$f")"
    fi
    mv -f "$f" "$LOG_DIR/"
  fi
done
shopt -u nullglob

gs -o output/pdf/report.pdf -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 output/pdf/main.pdf