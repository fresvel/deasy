# Nginx reverse proxy

Esta carpeta contiene la configuración del proxy reverso de Deasy.

## Estructura

- `nginx.conf`: configuración base y utilidades globales.
- `app-conf.d/default.conf.template`: plantilla del proxy de aplicación usada
  por `dev`.
- `ingress-bootstrap-conf.d/default.conf.template`: plantilla HTTP-only para
  bootstrap de certificados ACME.
- `ingress-conf.d/default.conf.template`: plantilla del proxy público
  compartido que enruta por subdominio hacia `qa` y `prod`.
- `certs/dev` y `certs/qa`: certificados autofirmados versionados para
  ambientes no productivos.
- `certs/prod`: ubicación reservada para certificados reales del proxy de
  aplicación local de `prod` si se llegara a usar.
- `certs/public`: ubicación esperada para el certificado SAN o wildcard que
  cubra `fresvel.com`, `www.fresvel.com` y `qa.fresvel.com`.
- `acme/`: webroot preparado para futuros desafíos HTTP-01 con Certbot.
- `scripts/generate-self-signed.sh`: utilidad para regenerar certificados por
  ambiente.

## Bootstrap con Certbot

Para un host limpio, no arranques primero el ingress TLS final.

Usa:

```bash
CERTBOT_EMAIL=admin@fresvel.com bash scripts/bootstrap-ingress-cert.sh
```

Ese script levanta temporalmente un ingress HTTP-only para responder desafíos
`HTTP-01`, obtiene el certificado y luego cambia al ingress final con TLS.

## Generar certificados

Desde la raíz del repositorio:

```sh
sh nginx/scripts/generate-self-signed.sh dev
sh nginx/scripts/generate-self-signed.sh qa
```

Los archivos generados siguen la convención:

- `nginx/certs/<ambiente>/fullchain.pem`
- `nginx/certs/<ambiente>/privkey.pem`

## Preparado para Let's Encrypt

El proxy de aplicación y el ingress público exponen
`/.well-known/acme-challenge/` desde `nginx/acme`.

Cuando se incorpore Certbot, el certificado público puede mantenerse en
`nginx/certs/public/` sin cambiar la estructura de Compose ni la convención de
rutas del ingress.
