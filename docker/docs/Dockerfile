FROM node:25.8.1

ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=${PNPM_HOME}:${PATH}
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV npm_config_fund=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@10.17.1 \
  && npm cache clean --force

WORKDIR /app/docs

COPY docs/package.json docs/pnpm-lock.yaml ./
RUN pnpm config set store-dir ${PNPM_STORE_DIR} \
  && pnpm install --frozen-lockfile

COPY docs ./

RUN chown -R node:node /app/docs /pnpm

USER node

EXPOSE 4321

ENTRYPOINT ["tini", "--"]
CMD ["pnpm", "run", "dev"]
