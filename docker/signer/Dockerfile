FROM python:3.14-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  ghostscript \
  nodejs \
  npm \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY signer/requirements.txt signer/requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

COPY signer ./

WORKDIR /opt/sigmaker
COPY signer/sigmaker/package.json ./package.json
COPY signer/sigmaker/index.js ./index.js
COPY signer/sigmaker/cli.mjs ./cli.mjs
COPY signer/sigmaker/puce_logo.png ./puce_logo.png
RUN npm install

WORKDIR /app

# El workspace del firmante NO va bajo /tmp (escritura publica): ahi se desempaqueta el PKCS#12 y
# se escriben los PDF. Directorio propio del servicio, dueno appuser y 0700, para que la raiz no sea
# accesible a nadie mas. Se crea en la imagen -no hace falta volumen- porque su contenido es scratch:
# cada job vive en un `TemporaryDirectory` que se borra al salir y nada debe sobrevivir al reinicio.
RUN mkdir -p /var/lib/deasy-signer/workspace /app/trust/roots /app/trust/extra \
  && chown -R appuser:appuser /app /opt/sigmaker /var/lib/deasy-signer \
  && chmod 0700 /var/lib/deasy-signer/workspace

USER appuser

EXPOSE 4000

CMD ["python", "app.py"]
