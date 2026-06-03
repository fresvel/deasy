# Broker y notificaciones - EMQX

> ⚠️ **OBSOLETO.** EMQX fue retirado. El chat y las notificaciones en tiempo real
> ahora usan **WebSockets (Socket.IO)** integrados en el backend, reutilizando el
> JWT de la aplicación. Los topics MQTT se mapean a rooms de Socket.IO
> (`users/{id}` → `user:{id}`, `conversations/{id}` → `conversation:{id}`,
> `processes/{id}` → `process:{id}`). Ver `backend/services/realtime/RealtimeGateway.js`,
> `backend/services/chat/ChatRealtimePublisherService.js` y
> `frontend/src/core/services/realtimeClient.js`. Este documento se conserva solo
> como referencia histórica.

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

