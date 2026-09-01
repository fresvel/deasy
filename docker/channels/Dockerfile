# El microservicio de canales de mensajería.
#
# ⚠️ ESTA IMAGEN LLEVA CHROMIUM, y no por gusto: `whatsapp-web.js` no habla con una API — abre
# WhatsApp Web en un navegador y actúa como si fuera una persona. Son ~400 MB, y es el precio de
# tener WhatsApp. Telegram no necesita nada de esto (le basta `fetch`).
#
# Se instala el Chromium DEL SISTEMA y se le dice a Puppeteer que no se descargue el suyo: uno por
# imagen y no dos.
FROM node:25.8.1-slim

ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

# `tini` como PID 1 para que SIGTERM llegue al proceso y `detener()` cierre los canales. Sin él,
# Node como PID 1 ignora la señal y el contenedor muere a los diez segundos de un SIGKILL — con el
# sondeo de Telegram a medias.
#
# El resto son las librerías que Chromium necesita para arrancar sin entorno gráfico. La lista es
# larga y aburrida, y quitar una a ojo produce un fallo que no dice qué falta.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     tini \
     chromium \
     fonts-liberation \
     libasound2 \
     libatk-bridge2.0-0 \
     libatk1.0-0 \
     libcups2 \
     libdrm2 \
     libgbm1 \
     libnspr4 \
     libnss3 \
     libxcomposite1 \
     libxdamage1 \
     libxfixes3 \
     libxkbcommon0 \
     libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY channels/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY channels ./

# La sesión de WhatsApp vive aquí y la monta un volumen: sin él, cada reinicio pide volver a escanear
# el QR desde el teléfono, que no es un incordio sino un canal caído.
RUN mkdir -p /app/.wwebjs_auth && chown -R node:node /app

USER node

ENTRYPOINT ["tini", "--"]
CMD ["node", "src/index.js"]
