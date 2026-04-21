# Nginx reverse proxy

Esta carpeta contiene la configuración del proxy reverso de Deasy.

## Estructura

- `nginx.conf`: configuración base y utilidades globales.
- `conf.d/default.conf.template`: plantilla renderizada por la imagen oficial de Nginx usando variables de entorno del contenedor.
- `certs/dev` y `certs/qa`: certificados autofirmados versionados para ambientes no productivos.
- `certs/prod`: ubicación reservada para certificados reales en despliegue.
- `acme/`: webroot preparado para futuros desafíos HTTP-01 con Certbot.
- `scripts/generate-self-signed.sh`: utilidad para regenerar certificados por ambiente.

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

El proxy expone `/.well-known/acme-challenge/` desde `nginx/acme`.

Cuando se incorpore Certbot, `prod` puede reemplazar sus certificados en
`nginx/certs/prod/` sin cambiar la estructura de Compose ni la convención de
rutas del proxy.
