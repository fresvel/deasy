# Broker y notificaciones - EMQX

## Rol del broker (alto nivel)

- Canal de mensajeria en tiempo real para chat y notificaciones internas.
- Se integra con el backend para publicar eventos y con el frontend para recibirlos.

## Componentes involucrados

- EMQX (broker MQTT/WebSocket).
- Backend (publica eventos).
- Frontend (suscribe y consume eventos).
- MongoDB (persistencia de mensajes).

## Flujo general

1) El usuario envia un mensaje desde el frontend.
2) El backend valida y guarda en MongoDB.
3) El backend publica el evento en EMQX.
4) Los clientes suscritos reciben el evento en tiempo real.

## Configuracion actual (stack docker)

- Servicio: docker/docker-compose.yml
- Config: docker/emqx/emqx.conf
- Puertos: 1883 (MQTT), 18083 (UI)
- En compose se permite anonymous (ajustar para prod).

## Referencias

- docs/05-broker-notificaciones/topics.md
- docs/05-broker-notificaciones/mensajeria.md
- docs/01-arquitectura/chat-notificaciones.md

