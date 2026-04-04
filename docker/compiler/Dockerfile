FROM texlive/texlive:latest

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV npm_config_fund=false

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  nodejs \
  npm \
  python3 \
  python3-pip \
  ghostscript \
  tini \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10002 appuser

WORKDIR /app/compiler

COPY compiler/package*.json ./
RUN npm install --omit=dev \
  && npm cache clean --force

COPY compiler/requirements.txt ./requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt

COPY compiler ./

RUN mkdir -p /tmp/deasy-compiler-workspace \
  && chown -R appuser:appuser /app/compiler /tmp/deasy-compiler-workspace

USER appuser

EXPOSE 4100

ENTRYPOINT ["tini", "--"]
CMD ["npm", "run", "start"]
