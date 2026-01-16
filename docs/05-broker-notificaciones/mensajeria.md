# Broker y notificaciones - Mensajeria

## Tipos de conversacion (alto nivel)

- direct: 1 a 1
- group: varios participantes
- thread: ligado a un proceso (process_id)

## Flujo de mensajes (alto nivel)

1) El frontend envia mensaje por API.
2) El backend valida y persiste.
3) El backend publica evento en EMQX.
4) Frontend recibe y actualiza UI.

## Persistencia (alto nivel)

- Conversaciones y mensajes en MongoDB.
- Adjuntos en storage compartido.

## Referencias

- docs/01-arquitectura/chat-notificaciones.md
- docs/05-broker-notificaciones/topics.md

