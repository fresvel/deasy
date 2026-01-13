#!/bin/bash

cd sigmaker/ && node index.js && cd -


# Carpetas
ORIG="Sílabos"
DEST="Sílabos_firmados"

cert="my_cert.p12"
PASS="passfile"

# Gestión de la contraseña
read -s -p "Ingrese la contraseña del certificado: " CERT_PASS
echo
echo "$CERT_PASS" > "$PASS"
chmod 600 "$PASS"

# --------------------------------------------------------------------
# 2) OBTENER LISTA DE PDFs Y TOTAL (BARRA DE PROGRESO)
# --------------------------------------------------------------------
mapfile -t pdf_list < <(find "$ORIG" -type f -iname "*.pdf")
TOTAL=${#pdf_list[@]}

echo "Total de PDFs a procesar: $TOTAL"
echo


# --------------------------------------------------------------------
# 3) FUNCIÓN: BARRA DE PROGRESO
# --------------------------------------------------------------------
progress_bar() {
    local current=$1
    local total=$2
    local width=50

    local percent=$(( 100 * current / total ))
    local filled=$(( width * current / total ))

    local bar
    bar=$(printf "%${filled}s" | tr ' ' '#')

    local empty
    empty=$(printf "%$((width-filled))s")

    printf "\r[%s%s] %d%% (%d/%d)" \
        "$bar" "$empty" "$percent" "$current" "$total"
}


# --------------------------------------------------------------------
# 4) PROCESAMIENTO DE CADA PDF
# --------------------------------------------------------------------
count=0

for input in "${pdf_list[@]}"; do
    count=$((count + 1))

    # Actualizar barra de progreso
    progress_bar "$count" "$TOTAL"

    # Ruta relativa y directorio destino
    rel_path="${input#$ORIG/}"
    dest_dir="$DEST/$(dirname "$rel_path")"
    mkdir -p "$dest_dir"

    # Archivos temporales
    output="$dest_dir/$(basename "$input" .pdf)-tmp.pdf"
    signed="$dest_dir/$(basename "$input" .pdf)-signed.pdf"

    # --------------------------------------------------------------
    # 4.1) Obtener número de páginas
    # --------------------------------------------------------------
    last_page=$(pdfinfo "$input" | awk '/Pages/ {print $2}')

    # --------------------------------------------------------------
    # 4.2) Insertar campos de firma
    # --------------------------------------------------------------
    pyhanko sign addfields \
        --field "${last_page}/97,586,187,636/ela" \
        --field "${last_page}/200,586,290,636/rev" \
        --field "${last_page}/325,125,415,190/apr" \
        "$input" "$output" \
        > /dev/null 

    # --------------------------------------------------------------
    # 4.3) Firmar campo APR
    # --------------------------------------------------------------
    pyhanko sign addsig \
        --style-name noto-qr \
        --field apr pkcs12 \
        --passfile "$PASS" \
        "$output" "$signed" "$cert" \
        > /dev/null 

    # Limpieza
    rm -f "$output"
done

echo "+++++++++++++" > "$PASS"

# --------------------------------------------------------------------
# 5) FINALIZACIÓN
# --------------------------------------------------------------------
echo
echo "--------------------------------------"
echo "Proceso completado: archivos firmados en '$DEST'."

