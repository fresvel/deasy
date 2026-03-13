FROM oven/bun:1.2 AS build

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true

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

COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.2

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=development

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  tini \
  ca-certificates \
  libcairo2 \
  libpango-1.0-0 \
  libjpeg62-turbo \
  libgif7 \
  librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY --from=build /app/backend/node_modules ./node_modules
COPY backend/package.json backend/bun.lock ./
COPY backend ./

RUN chown -R bun:bun /app/backend

USER bun

EXPOSE 3030

ENTRYPOINT ["tini", "--"]
CMD ["bun", "run", "dev"]
