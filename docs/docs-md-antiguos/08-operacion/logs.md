> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Operacion - Logs

## Docker

- Ver logs por servicio:
  - docker compose logs -f <servicio>

Servicios comunes:
- backend
- frontend
- mariadb
- mongodb
- rabbitmq
- emqx

## Backend

- Logs via stdout del proceso Node.
- Errores de auth y validaciones salen por consola.

## LaTeX

- Logs en backend/services/latex/ (archivos .log generados en compilacion).

## Firmas

- Logs del servicio de firma en `signer/` y en su contenedor Docker.

## Rotacion

- Definir politica de rotacion segun entorno (logrotate o logs centralizados).
