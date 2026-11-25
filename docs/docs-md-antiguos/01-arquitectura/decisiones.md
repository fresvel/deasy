> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Arquitectura - Decisiones

## Decisiones vigentes

- Chat y notificaciones en tiempo real con EMQX (WebSocket/MQTT).
- Mensajes de chat persistidos en MongoDB.
- Publicacion en EMQX solo desde backend; frontend solo se suscribe.
- Adjuntos y paquetes publicados en MinIO por buckets funcionales.
- Conversaciones: direct, group y thread (thread ligado a process_id).
- Responsable del proceso puede agregar/remover participantes en threads.

## Alternativas evaluadas

- Servicio dedicado de mensajeria para publicar a EMQX (plan futuro).
- RabbitMQ como orquestador de tareas asincronas (pendiente evaluar uso real).

## Pendientes

- Completar la politica de retencion y limpieza por bucket en MinIO.
- Confirmar donde vive el "responsable del proceso" en BD (tabla/campo).
- Detallar reglas ACL de EMQX segun topics y usuarios.
