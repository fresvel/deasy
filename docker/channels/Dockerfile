# El microservicio de canales de mensajería.
#
# Imagen mínima a propósito: `channels` NO tiene dependencias —ni una— porque todo lo que hace es
# hablar HTTP con Telegram y con el backend, y `fetch` viene en Node. Nada de compiladores ni de
# librerías de sistema: no hay nada que compilar.
FROM node:25.8.1-slim

ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# `tini` como PID 1 para que SIGTERM llegue al proceso y `detener()` cierre los canales. Sin él,
# Node como PID 1 ignora la señal y el contenedor muere a los diez segundos de un SIGKILL — con el
# sondeo de Telegram a medias.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY channels/package*.json ./
# Sin dependencias hoy, pero se deja el paso: cuando `C5` traiga `whatsapp-web.js` esto ya está.
RUN npm install --omit=dev && npm cache clean --force

COPY channels ./

USER node

ENTRYPOINT ["tini", "--"]
CMD ["node", "src/index.js"]
