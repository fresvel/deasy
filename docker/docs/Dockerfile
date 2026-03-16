FROM node:22.12.0-bookworm-slim

ENV PNPM_HOME=/pnpm
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
RUN pnpm install --frozen-lockfile

COPY docs ./

RUN chown -R node:node /app/docs /pnpm

USER node

EXPOSE 4321

ENTRYPOINT ["tini", "--"]
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4321"]
