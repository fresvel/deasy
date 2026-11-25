> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Broker y notificaciones - Auth y ACL

## Autenticacion (alto nivel)

- Cada usuario tiene credenciales de acceso al broker.
- El backend controla la creacion/derivacion de credenciales.

## Reglas ACL (alto nivel)

- Suscripcion: solo a conversaciones donde el usuario participa.
- Publicacion: restringida al backend.

## Estado actual

- En docker-compose, EMQX_ALLOW_ANONYMOUS=true (temporal).
- Requiere endurecimiento en produccion.

## Referencias

- docs/05-broker-notificaciones/topics.md
- docs/01-arquitectura/chat-notificaciones.md

