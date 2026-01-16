# Arquitectura - Decisiones

## Decisiones vigentes

- Chat y notificaciones en tiempo real con EMQX (WebSocket/MQTT).
- Mensajes de chat persistidos en MongoDB.
- Publicacion en EMQX solo desde backend; frontend solo se suscribe.
- Adjuntos hasta 100 MB en storage compartido (NFS u otro).
- Conversaciones: direct, group y thread (thread ligado a process_id).
- Responsable del proceso puede agregar/remover participantes en threads.

## Alternativas evaluadas

- Servicio dedicado de mensajeria para publicar a EMQX (plan futuro).
- RabbitMQ como orquestador de tareas asincronas (pendiente evaluar uso real).

## Pendientes

- Definir ruta exacta de SHARED_STORAGE_ROOT en entorno docker/NFS.
- Confirmar donde vive el "responsable del proceso" en BD (tabla/campo).
- Detallar reglas ACL de EMQX segun topics y usuarios.

