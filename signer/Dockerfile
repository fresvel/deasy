FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    ghostscript \
    poppler-utils \
    ca-certificates \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir -r requirements.txt

WORKDIR /opt/sigmaker
COPY sigmaker/package.json ./package.json
COPY sigmaker/index.js ./index.js
COPY sigmaker/cli.mjs ./cli.mjs
COPY sigmaker/puce_logo.png ./puce_logo.png
RUN npm install

WORKDIR /app
COPY . .

RUN mkdir -p /tmp/deasy-signer-workspace && chown -R appuser:appuser /app /tmp/deasy-signer-workspace

USER appuser

EXPOSE 4000

CMD ["python3", "app.py"]
