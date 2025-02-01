#!/bin/bash

mkdir -p log  # Crea el directorio si no existe

set -e  # Hace que el script se detenga si algún comando falla

# Paso 1: Ejecuta pdflatex para generar los archivos auxiliares
docker run --rm -v "$(pwd)":/workdir texlive/texlive:latest pdflatex main.tex &> log/pdflatex.log || { echo "--Compile.sh-- Error en la primera ejecución de pdflatex" >&2; exit 1; }

# Paso 2: Ejecuta bibtex para generar las bibliografías
docker run --rm -v "$(pwd)":/workdir texlive/texlive:latest bibtex main &> log/bibtex.log || { echo "--Compile.sh-- Error en la ejecución de bibtex" >&2; exit 1; }

# Paso 3: Ejecuta pdflatex nuevamente
docker run --rm -v "$(pwd)":/workdir texlive/texlive:latest pdflatex main.tex &>> log/pdflatex.log || { echo "--Compile.sh-- Error en la segunda ejecución de pdflatex" >&2; exit 1; }

# Paso 4: Ejecuta pdflatex una vez más para asegurarse de que el documento esté completamente compilado
docker run --rm -v "$(pwd)":/workdir texlive/texlive:latest pdflatex main.tex &>> log/pdflatex.log || { echo "--Compile.sh-- Error en la tercera ejecución de pdflatex" >&2; exit 1; }

# Comprobación final para validar que el archivo PDF está creado
MAX_ATTEMPTS=5
SLEEP_INTERVAL=2  # segundos

for (( attempt=1; attempt<=MAX_ATTEMPTS; attempt++ )); do
    if [ -f "main.pdf" ]; then
        echo "$(pwd)/main.pdf"
        exit 0
    fi
    echo "Intento $attempt: esperando que el archivo main.pdf esté disponible..."
    sleep $SLEEP_INTERVAL
done

echo "Error: el archivo main.pdf no se ha creado después de $MAX_ATTEMPTS intentos." >&2
exit 1

