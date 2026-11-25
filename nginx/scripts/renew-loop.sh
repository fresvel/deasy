#!/bin/sh
# EL BUCLE DE RENOVACIÓN DEL CERTIFICADO PÚBLICO. Es el punto de entrada del servicio `certbot` de
# la pila de ingress (`docker/compose.ingress.yml`): corre junto a nginx, duerme, y cada
# RENEW_INTERVAL_SECONDS pregunta a Let's Encrypt si toca renovar.
#
# POR QUÉ ES UN CONTENEDOR Y NO UNA TAREA DEL SERVIDOR. El certificado de abril de 2026 caducó en
# julio porque renovarlo dependía de algo que había que acordarse de montar en el servidor. Aquí no
# hay nada que recordar: sube con el ingress, arranca con él y vuelve solo tras un reinicio.
#
# ESTE CONTENEDOR SÓLO ESCRIBE EL CERTIFICADO. No recarga nginx, no tiene el socket de Docker y no
# ve sus procesos: nginx vigila su propio certificado y se recarga solo cuando cambia
# (`nginx/scripts/40-recargar-si-cambia-el-certificado.sh`).
#
# Cada vuelta hace dos cosas, y la segunda no depende de que la primera haya renovado:
#   1. `certbot renew` — sólo renueva cuando faltan menos de 30 días.
#   2. Si el certificado del linaje y el que nginx sirve (`public/`) no son el mismo fichero, lo
#      copia. Así una copia que se perdiera a medias se repara en la vuelta siguiente.
set -u

INTERVALO="${RENEW_INTERVAL_SECONDS:-43200}"
LE=/etc/letsencrypt
PUBLICO="$LE/public"

ahora() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
decir() { echo "[$(ahora)] $*"; }

# El linaje: el que diga CERT_NAME, o el único que haya. Con varios y sin nombre no se adivina.
linaje() {
  if [ -n "${CERT_NAME:-}" ]; then
    echo "$LE/live/$CERT_NAME"
    return 0
  fi
  total=0
  unico=""
  for dir in "$LE"/live/*/; do
    [ -f "${dir}fullchain.pem" ] || continue
    total=$((total + 1))
    unico="${dir%/}"
  done
  if [ "$total" -eq 1 ]; then
    echo "$unico"
  elif [ "$total" -gt 1 ]; then
    decir "Hay $total linajes en $LE/live y CERT_NAME no dice cuál: no se copia ninguno." >&2
  fi
}

publicar_si_cambio() {
  origen="$(linaje)"
  if [ -z "$origen" ] || [ ! -f "$origen/fullchain.pem" ] || [ ! -f "$origen/privkey.pem" ]; then
    decir "Todavía no hay certificado emitido (la primera emisión es bootstrap-ingress-cert.sh)."
    return 0
  fi
  if cmp -s "$origen/fullchain.pem" "$PUBLICO/fullchain.pem" && cmp -s "$origen/privkey.pem" "$PUBLICO/privkey.pem"; then
    return 0
  fi
  mkdir -p "$PUBLICO"
  # La llave primero y a un nombre temporal: nginx no debe poder leer nunca un par a medias.
  cp -L "$origen/privkey.pem" "$PUBLICO/privkey.pem.nuevo" && cp -L "$origen/fullchain.pem" "$PUBLICO/fullchain.pem.nuevo" || {
    decir "No se pudo copiar el certificado a $PUBLICO."
    return 1
  }
  mv "$PUBLICO/privkey.pem.nuevo" "$PUBLICO/privkey.pem" && mv "$PUBLICO/fullchain.pem.nuevo" "$PUBLICO/fullchain.pem"
  decir "Certificado nuevo copiado a public/ ($(openssl x509 -noout -enddate -in "$PUBLICO/fullchain.pem" 2>/dev/null)). nginx lo recarga solo."
}

trap 'decir "Señal de parada: saliendo."; exit 0' TERM INT

decir "Bucle de renovación en marcha: una pasada cada ${INTERVALO}s."
while :; do
  certbot renew --quiet || decir "certbot renew terminó con error: se reintenta en la siguiente pasada."
  publicar_si_cambio || true
  sleep "$INTERVALO" &
  wait $!
done
