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

