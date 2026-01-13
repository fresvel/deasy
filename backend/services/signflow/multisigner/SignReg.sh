#!/bin/bash

# --------------------------------------------------------------------
# CONFIGURACIÓN
# --------------------------------------------------------------------
ORIG="Informes"
DEST="Informes_firmados"

CERT="my_cert.p12"
PASS="passfile"

MARKER_SCRIPT="./find_marker.py"

# Gestión de la contraseña
read -s -p "Ingrese la contraseña del certificado: " CERT_PASS
echo

echo "$CERT_PASS" > "$PASS"


# Tamaño del campo ELA
FIELD_WIDTH=110
FIELD_HEIGHT=80

# --------------------------------------------------------------------
# PREPROCESO (QR u otros)
# --------------------------------------------------------------------
cd sigmaker/ && node index.js && cd - >/dev/null

mkdir -p "$DEST"

# --------------------------------------------------------------------
# 1) LISTAR PDFs
# --------------------------------------------------------------------
mapfile -t pdf_list < <(find "$ORIG" -type f -iname "*.pdf")
total=${#pdf_list[@]}

echo "Total de PDFs a procesar: $total"
echo

count=0

# --------------------------------------------------------------------
# BARRA DE PROGRESO
# --------------------------------------------------------------------
progress_bar() {
    local current=$1
    local total=$2
    local width=50

    local percent=$(( 100 * current / total ))
    local filled=$(( width * current / total ))

    local bar=$(printf "%${filled}s" | tr ' ' '#')
    local empty=$(printf "%$((width-filled))s")

    printf "\r[%s%s] %d%% (%d/%d)" "$bar" "$empty" "$percent" "$current" "$total"
}

# --------------------------------------------------------------------
# 2) PROCESAMIENTO
# --------------------------------------------------------------------
for input in "${pdf_list[@]}"; do
    count=$((count + 1))
    progress_bar "$count" "$total"

    rel_path="${input#$ORIG/}"
    dest_dir="$DEST/$(dirname "$rel_path")"
    mkdir -p "$dest_dir"

    output="$dest_dir/$(basename "$input" .pdf)-tmp.pdf"
    signed="$dest_dir/$(basename "$input" .pdf)-signed.pdf"

    # ---------------------------------------------------------------
    # BUSCAR MARCADOR
    # ---------------------------------------------------------------
    marker=$(python3 "$MARKER_SCRIPT" "$input")

    if [[ "$marker" == "NOT_FOUND" ]]; then
        echo
        echo "⚠️  Patrón no encontrado en: $input"
        continue
    fi

    IFS=',' read -r page x y <<< "$marker"

    x2=$((x + FIELD_WIDTH))
    y2=$((y - FIELD_HEIGHT))

    # ---------------------------------------------------------------
    # 1) INSERTAR CAMPOS
    # ---------------------------------------------------------------
    pyhanko sign addfields \
        --field ${page}/${x},${y},${x2},${y2}/ela \
        "$input" "$output"

    # ---------------------------------------------------------------
    # 2) FIRMAR (APR)
    # ---------------------------------------------------------------
    pyhanko sign addsig \
        --style-name noto-qr \
        --field ela \
        pkcs12 \
        --passfile "$PASS" \
        "$output" "$signed" "$CERT" 

    rm "$output"
done

echo "********" > $PASS

echo
echo "--------------------------------------"
echo "Proceso completado: archivos firmados en '$DEST'."
