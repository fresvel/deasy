# Nginx reverse proxy

This folder contains the reverse proxy configuration for Deasy.

## What is included

- `nginx.conf`: base Nginx config and upstream definitions.
- `conf.d/default.conf`: HTTPS reverse proxy rules.
- `certs/`: TLS certificate location (`tls.crt`, `tls.key`).
- `acme/`: webroot directory for future Let's Encrypt HTTP-01 challenges.
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

## Let's Encrypt readiness

The current setup is ready for HTTP-01 validation by exposing:

- `/.well-known/acme-challenge/` from `nginx/acme`

Future Certbot integration can mount the same `nginx/acme` folder as webroot
and replace `tls.crt` / `tls.key` with managed certificates.
