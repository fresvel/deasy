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

COPY signer/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY signer ./

RUN mkdir -p /tmp/deasy-signer-workspace /app/trust/roots /app/trust/extra \
  && chown -R appuser:appuser /app /tmp/deasy-signer-workspace

USER appuser

EXPOSE 4000

CMD ["python", "app.py"]
