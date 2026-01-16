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

## Signflow

- Logs en backend/services/signflow/ y subcarpetas.

## Rotacion

- Definir politica de rotacion segun entorno (logrotate o logs centralizados).

