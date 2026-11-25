#!/usr/bin/env bash
# Estado de los canales de mensajería (Telegram / WhatsApp) de una pila.
#
#   bash scripts/canales.sh [a|b|c|d]        estado de los dos canales
#   bash scripts/canales.sh [a|b|c|d] qr     el QR de vinculación de WhatsApp
#
# ⚠️ ESTO LEE EL REGISTRO, y por eso es un apaño y no la respuesta buena. El servicio imprime su
# estado UNA VEZ al arrancar y no lo vuelve a decir, así que ese resumen ENVEJECE: al arrancar,
# WhatsApp dice «sin iniciar» y sigue diciéndolo aunque la sesión ya esté lista. Por eso aquí se
# busca la ÚLTIMA línea de cada suceso, no la del resumen.
#
# La respuesta buena es C7 --una pantalla de administración -- o un endpoint de estado. Mientras
# tanto, esto es lo único que hay, y es mejor que no tener nada: el 2026-08-31 el contenedor estuvo
# TRECE HORAS muerto sin que nadie lo notara.
set -euo pipefail

PILA="${1:-c}"
CONTENEDOR="deasy-${PILA}-channels-1"

if ! docker inspect "$CONTENEDOR" >/dev/null 2>&1; then
  echo "  ✖ no existe el contenedor $CONTENEDOR — la pila $PILA no tiene canales levantados."
  echo "    levántalo con:  bash scripts/stack.sh $PILA up -d channels"
  exit 1
fi

ESTADO=$(docker inspect "$CONTENEDOR" --format '{{.State.Status}}')
DESDE=$(docker inspect "$CONTENEDOR" --format '{{.State.StartedAt}}')
REINICIOS=$(docker inspect "$CONTENEDOR" --format '{{.RestartCount}}')

if [ "${2:-}" = "qr" ]; then
  # El QR se dibuja en ASCII; se enseña el ÚLTIMO, porque los anteriores ya caducaron.
  docker logs --since "$DESDE" "$CONTENEDOR" 2>&1 | awk '/hay que vincular la sesión/{buf=""} {buf=buf $0 "\n"} END{print buf}'
  exit 0
fi

echo "  contenedor  $ESTADO  ·  desde $DESDE  ·  reinicios: $REINICIOS"
[ "$ESTADO" != "running" ] && { echo "  ✖ el contenedor NO está corriendo: ningún canal recibe nada."; exit 1; }

# ⚠️ SÓLO EL ARRANQUE ACTUAL. `docker logs` conserva la salida de los arranques ANTERIORES, y sin
# este recorte el script encuentra un «sesión lista» viejo y jura que el canal está listo cuando
# lleva ocho minutos atascado. Pasó el 2026-09-01, con este mismo script, media hora después de
# escribirlo advirtiendo de este mismo tipo de fallo.
REGISTRO=$(docker logs --since "$DESDE" "$CONTENEDOR" 2>&1)

# Telegram: dice su cuenta al conectar y avisa cuando el sondeo falla y cuando se recupera.
TG=$(printf '%s' "$REGISTRO" | grep -oE '\[channels\] telegram: .*' | tail -1 || true)
echo "  telegram    ${TG:-sin noticias — ¿está configurado el token?}"

# WhatsApp: la verdad es el último suceso TERMINAL --listo, hay que vincular, perdida, sin auth--.
#
# ⚠️ NO ES «la última línea que hable de whatsapp». WhatsApp Web sigue emitiendo avisos de
# sincronización DESPUÉS de estar listo, así que esa regla decía «sincronizando 99 %» de un canal que
# llevaba rato funcionando. Los avisos de progreso sólo valen MIENTRAS no haya un suceso terminal:
# entonces sí son la respuesta, y son justo la diferencia entre «va avanzando» y «se colgó».
WA=$(printf '%s' "$REGISTRO" \
  | grep -oE '\[channels\] whatsapp: (sesión lista|hay que vincular.*|sesión perdida.*|fallo de autenticación.*)' \
  | tail -1 || true)
if [ -z "$WA" ]; then
  WA=$(printf '%s' "$REGISTRO" \
    | grep -oE '\[channels\] whatsapp: (autenticado.*|sincronizando.*)' | tail -1 || true)
  [ -n "$WA" ] && WA="$WA  ← AÚN NO RECIBE; si el porcentaje no sube, está colgado"
fi
echo "  whatsapp    ${WA:-sin noticias — ¿está puesto WHATSAPP_NUMERO?}"

case "$WA" in
  *"hay que vincular"*) echo "  → hay que escanear el QR:  bash scripts/canales.sh $PILA qr" ;;
  *"sesión perdida"*|*"fallo de autenticación"*) echo "  → la sesión murió; reinicia y vuelve a vincular." ;;
esac
