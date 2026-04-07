# Nginx reverse proxy

This folder contains the reverse proxy configuration for Deasy.

## What is included

- `nginx.conf`: base Nginx config and upstream definitions.
- `conf.d/default.conf`: HTTPS reverse proxy rules.
- `certs/`: TLS certificate location (`tls.crt`, `tls.key`).
- `scripts/generate-self-signed.sh`: utility to generate local self-signed certificates.

## Local certificate generation

From repository root:

```sh
sh nginx/scripts/generate-self-signed.sh
```

Expected files:

- `nginx/certs/tls.crt`
- `nginx/certs/tls.key`

These certificates are intended for local/non-production use only.
