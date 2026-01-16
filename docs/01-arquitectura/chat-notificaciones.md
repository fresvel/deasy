# Arquitectura: Chat y Notificaciones

## Objetivo

Definir la arquitectura base para chat y notificaciones en Deasy usando EMQX (WebSocket) y MongoDB, con adjuntos en storage compartido.

## Alcance

- Conversaciones 1:1, grupos y threads ligados a procesos.
- Notificaciones internas en tiempo real.
- Adjuntos (videos/documentos) hasta 100 MB.
- Persistencia en MongoDB.

## Decisiones clave

- Realtime: EMQX por WebSocket.
- Publicacion: solo backend publica en EMQX.
- Suscripcion: frontend se suscribe a sus topics.
- Persistencia: MongoDB para conversaciones y mensajes.
- Adjuntos: filesystem compartido montado en el backend.
- Credenciales EMQX: usuario por persona, derivado de la contrasena del sistema.
- ACL: usuario solo puede suscribirse a conversaciones propias; publicar reservado al backend.

## Modelos (MongoDB)

1) conversations
- _id
- type: "direct" | "group" | "thread"
- title (opcional)
- participants: [user_id]
- process_id (solo para type="thread")
- created_at, updated_at
- last_message_id

2) messages
- _id
- conversation_id
- sender_id
- content
- attachments: [{ path, filename, mime, size }]
- created_at
- read_by: [user_id]

## Reglas de acceso

- Threads por proceso: el responsable del proceso puede agregar o retirar participantes.
- Participantes solo pueden ver conversaciones donde esten incluidos.

## Topics EMQX

- Notificaciones por usuario:
  - users/{userId}/notifications
- Mensajes por conversacion:
  - conversations/{conversationId}/messages
- Threads por proceso:
  - processes/{processId}/thread

## Flujo de mensajes (opcion A)

1) Frontend envia mensaje por API REST.
2) Backend valida, guarda en Mongo.
3) Backend publica en EMQX el evento del mensaje.
4) Frontend recibe en tiempo real via WebSocket y actualiza UI.

## Adjuntos (storage compartido)

- Variable de entorno en backend:
  - SHARED_STORAGE_ROOT=/data/shared
- Ruta sugerida:
  - ${SHARED_STORAGE_ROOT}/chat/{conversationId}/
- Metadatos en Mongo (messages.attachments).

## Autenticacion EMQX

- Usuario MQTT por persona.
- Credenciales derivadas de la contrasena del sistema.
- ACL restringe suscripcion a topics de conversaciones propias.
- Publicacion reservada al backend.

## Endpoints base (referencia)

- POST /chat/conversations (crear conversacion)
- GET /chat/conversations (listar conversaciones del usuario)
- GET /chat/conversations/:id/messages
- POST /chat/conversations/:id/messages
- POST /chat/conversations/:id/participants (solo responsable si type="thread")
- DELETE /chat/conversations/:id/participants/:userId (solo responsable si type="thread")
- POST /notifications/read (marcar leido)

## Evolucion (futuro)

- Servicio dedicado de mensajeria para publicar a EMQX (desacoplar backend).
- Emision de notificaciones externas (WhatsApp/email) segun reglas.
- Politicas de retencion y archivado de mensajes.

## Referencias

- docs/05-broker-notificaciones/emqx.md
- docs/05-broker-notificaciones/topics.md
- docs/05-broker-notificaciones/auth-acl.md
- docs/05-broker-notificaciones/mensajeria.md

