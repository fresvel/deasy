#!/bin/sh
# NGINX SE RECARGA SOLO CUANDO CAMBIA SU CERTIFICADO. La imagen oficial ejecuta lo que haya en
# /docker-entrypoint.d/ antes de arrancar nginx; esto deja un vigilante en segundo plano que mira
# el certificado cada CERT_WATCH_SECONDS y, si cambió, comprueba la configuración y recarga.
#
# POR QUÉ LO HACE NGINX Y NO QUIEN RENUEVA. El contenedor de certbot escribe el certificado y nada
# más: no tiene el socket de Docker ni ve los procesos de nginx. Se ensayó que certbot mandara la
# señal de recarga compartiendo el espacio de procesos (2026-11-25) y funcionaba, pero recrear sólo
# nginx dejaba muerto a certbot sin que nada lo dijera. Así cada contenedor depende sólo de una
# carpeta, y da igual quién escriba el certificado: certbot, el script manual o una persona.
#
# Si el par nuevo no es válido —por ejemplo, lo pilla a medio copiar—, `nginx -t` falla, NO se
# recarga y se vuelve a intentar en la siguiente pasada. nginx sigue sirviendo el anterior.
set -u

if [ -z "${TLS_CERT_PATH:-}" ] || [ -z "${TLS_KEY_PATH:-}" ]; then
  exit 0
fi

INTERVALO="${CERT_WATCH_SECONDS:-300}"

huella() {
  cat "$TLS_CERT_PATH" "$TLS_KEY_PATH" 2>/dev/null | md5sum | cut -d' ' -f1
}

(
  servida="$(huella)"
  while :; do
    sleep "$INTERVALO"
    actual="$(huella)"
    [ "$actual" = "$servida" ] && continue
    if nginx -t >/dev/null 2>&1; then
      nginx -s reload >/dev/null 2>&1 && servida="$actual" \
        && echo "[certificado] cambió en disco: nginx recargado."
    else
      echo "[certificado] cambió en disco pero la configuración no pasa nginx -t: NO se recarga; se reintenta."
    fi
  done
) &
