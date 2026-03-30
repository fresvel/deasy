FROM node:25.8.1 AS build

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV npm_config_fund=false

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  pkg-config \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg62-turbo-dev \
  libgif-dev \
  librsvg2-dev \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm install --omit=dev \
  && npm cache clean --force

FROM node:25.8.1

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=development
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV npm_config_fund=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  tini \
  zip \
  ca-certificates \
  libcairo2 \
  libpango-1.0-0 \
  libjpeg62-turbo \
  libgif7 \
  librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY --from=build /app/backend/node_modules ./node_modules
COPY backend/package*.json ./
COPY backend ./

RUN chown -R node:node /app/backend

USER node

EXPOSE 3030

ENTRYPOINT ["tini", "--"]
CMD ["node", "--watch", "index.js"]
