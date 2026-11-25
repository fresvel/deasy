> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Operacion - Monitoring

## Metrica sugerida

- Salud de contenedores (docker ps / healthchecks).
- Uso de CPU/RAM por servicio.
- Latencia de API y tasa de errores 4xx/5xx.
- Latencia y throughput en EMQX/RabbitMQ.

## Alertas sugeridas

- Caida de servicios criticos: backend, mariadb, mongodb, emqx.
- Espacio en disco bajo en volumenes persistentes.
- Errores reiterados en firma o compilacion LaTeX.

