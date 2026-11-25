#!/usr/bin/env bash
# INSTALA EL TEMPORIZADOR DE SYSTEMD QUE RENUEVA EL CERTIFICADO PÚBLICO. Se corre UNA vez por
# servidor, con sudo, desde la carpeta de despliegue:
#
#   sudo bash scripts/install-renew-timer.sh            # instala y activa
#   bash scripts/install-renew-timer.sh --print         # sólo enseña las dos unidades
#   sudo bash scripts/install-renew-timer.sh --remove   # lo quita
#
# POR QUÉ SYSTEMD Y NO CRON. El defecto que esto cierra fue un certificado caducado cuatro meses
# sin que nadie lo viera, así que pesan dos cosas: `Persistent=true` recupera al encender la
# ejecución que el servidor se perdió por estar apagado, y una renovación fallida queda marcada
# como fallo (`systemctl status deasy-renew-cert.service`) en vez de enterrada en un fichero.
#
# Las unidades se GENERAN aquí porque llevan la ruta de esta carpeta de despliegue, que cambia de
# un servidor a otro. Volver a correrlo las reescribe: es la forma de moverlas de carpeta.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOMBRE="deasy-renew-cert"
DESTINO="${DEASY_SYSTEMD_DIR:-/etc/systemd/system}"
MODO="${1:-install}"

servicio() {
  cat <<UNIDAD
[Unit]
Description=Deasy: renueva el certificado publico del ingress (Let's Encrypt)
Documentation=file://$ROOT_DIR/scripts/renew-ingress-cert.sh
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$ROOT_DIR
ExecStart=/usr/bin/env bash $ROOT_DIR/scripts/renew-ingress-cert.sh
UNIDAD
}

temporizador() {
  cat <<UNIDAD
[Unit]
Description=Deasy: renovacion semanal del certificado publico

[Timer]
OnCalendar=Mon *-*-* 04:17:00
RandomizedDelaySec=30min
Persistent=true

[Install]
WantedBy=timers.target
UNIDAD
}

case "$MODO" in
  --print)
    echo "# $DESTINO/$NOMBRE.service"; servicio; echo; echo "# $DESTINO/$NOMBRE.timer"; temporizador
    exit 0
    ;;
  --remove)
    systemctl disable --now "$NOMBRE.timer" 2>/dev/null || true
    rm -f "$DESTINO/$NOMBRE.service" "$DESTINO/$NOMBRE.timer"
    systemctl daemon-reload
    echo "Temporizador $NOMBRE retirado."
    exit 0
    ;;
  install) ;;
  *)
    echo "Uso: sudo bash scripts/install-renew-timer.sh [--print|--remove]"
    exit 1
    ;;
esac

if [ ! -f "$ROOT_DIR/scripts/renew-ingress-cert.sh" ]; then
  echo "No encuentro $ROOT_DIR/scripts/renew-ingress-cert.sh: corre esto desde la carpeta de despliegue."
  exit 1
fi
if [ ! -w "$DESTINO" ]; then
  echo "No puedo escribir en $DESTINO: hace falta sudo."
  exit 1
fi

servicio > "$DESTINO/$NOMBRE.service"
temporizador > "$DESTINO/$NOMBRE.timer"
systemctl daemon-reload
systemctl enable --now "$NOMBRE.timer"
echo "Instalado. Proxima ejecucion:"
systemctl list-timers "$NOMBRE.timer" --no-pager
echo
echo "Para correrlo ahora:      sudo systemctl start $NOMBRE.service"
echo "Para ver la ultima vez:   systemctl status $NOMBRE.service"
echo "Para leer su registro:    journalctl -u $NOMBRE.service"
