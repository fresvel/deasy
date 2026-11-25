> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Broker y notificaciones - Topics

## Topics confirmados

- users/{userId}/notifications
- conversations/{conversationId}/messages
- processes/{processId}/thread

## Convenciones de nombres

- Segmentos separados por "/".
- Identificadores por entidad (userId, conversationId, processId).

