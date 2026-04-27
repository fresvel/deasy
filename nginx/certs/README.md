## Certificados TLS del proxy

- `dev/` y `qa/` contienen certificados autofirmados versionados para pruebas y
  validación local.
- `prod/` queda reservado para certificados reales del entorno de despliegue.

Convención esperada por Compose y Nginx:

- `nginx/certs/<ambiente>/fullchain.pem`
- `nginx/certs/<ambiente>/privkey.pem`

Para regenerar certificados de `dev` o `qa`:

```sh
sh nginx/scripts/generate-self-signed.sh dev
sh nginx/scripts/generate-self-signed.sh qa
```
