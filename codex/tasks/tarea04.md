# Listado de actividades

Avance del checklist: `18/20`

Buenas prácticas base validadas con Context7:
- `MongoDB` (`/mongodb/docs`): para colecciones con crecimiento no acotado, usar referencias entre documentos y evitar arrays crecientes; esto aplica a `conversations` y `messages`.
- `EMQX` (`/emqx/emqx-docs`): EMQX puede autenticarse/autorizase contra un servicio HTTP externo y aceptar ACL por cliente; por eso conviene diseñar el módulo de chat como frontera extraíble aunque se implemente primero dentro del backend.
- `Express` (`/expressjs/express`): organizar routers y middleware por módulo permite incorporar `chat` en el backend actual sin bloquear una extracción futura a microservicio.

0. [x] Revisar el archivo `Requisitos04.md` para tener el contexto completo de la implementación.
1. [x] Confirmar el caso de uso prioritario del MVP: thread de proceso abierto desde el dashboard antes que chat global, grupos o bandeja universal.
2. [x] Definir la política de autorización para thread de proceso usando el dominio SQL actual, dejando explícito quién crea, quién participa y quién administra participantes.
3. [x] Diseñar el módulo `chat` dentro de `backend/` con estructura extraíble: rutas, controladores, servicios y modelos separados del resto del dominio.
4. [x] Implementar los modelos Mongo iniciales de `conversations`, `messages` y `notifications`, con índices compatibles con lectura por conversación y orden temporal.
5. [x] Implementar el servicio de conversaciones para crear o recuperar el thread canónico por `process_id`.
6. [x] Implementar el servicio de mensajes para persistir mensajes, actualizar metadata de conversación y validar membresía/autorización.
7. [x] Implementar el servicio de notificaciones internas asociado a eventos de mensaje y acciones relevantes del thread.
8. [x] Implementar el publicador realtime a EMQX desde backend, manteniendo la regla de que el frontend solo se suscribe.
9. [x] Exponer la API mínima `/chat` y `/notifications`, incluyendo endpoints de conveniencia por `process_id` para el panel del dashboard.
10. [x] Implementar el launcher flotante del chat en la esquina inferior derecha y definir el patrón overlay del panel sin comprimir el contenido principal del dashboard.
11. [x] Implementar el panel superpuesto de chat con estructura vertical `header + body + footer`, incluyendo tabs de modo, búsqueda, listado por recientes y composer adaptable.
12. [x] Integrar el panel de usuario o dashboard para que el botón `Chat del proceso` abra el flujo real dentro de ese overlay y deje de mostrar el placeholder actual.
13. [x] Implementar en frontend la carga paginada de mensajes, composición/envío y refresco realtime o fallback seguro si la conexión al broker falla.
14. [x] Implementar el estado mínimo de lectura/no lectura para notificaciones y decidir si `read_by` vive inicialmente en `messages` o se separa luego.
15. [ ] Evaluar e implementar adjuntos en MinIO solo si el MVP llega a tiempo; si no, dejar contrato y estructura listos sin forzar la carga de archivos en esta primera fase.
16. [x] Ajustar el contrato de API y eventos para que sea reutilizable por una futura app móvil, sin acoplarlo a payloads o estructuras del dashboard web.
17. [x] Dejar definida la estrategia de sincronización cliente para móvil: bootstrap HTTP, paginación/cursor, unread state y fallback sin realtime.
18. [ ] Agregar observabilidad técnica del módulo: logs estructurados, correlación por conversación/mensaje/proceso y manejo de errores de publicación a EMQX.
19. [x] Documentar explícitamente la decisión de no crear aún un microservicio dedicado de chat, pero dejar el backlog de extracción futura a `chat-service` con hitos y disparadores operativos.

## Comentarios para el usuario, ignora esta sección.

Para tener control del desarrollo, se debe seguir la hoja de ruta. Si durante la implementación del chat aparecen decisiones grandes, conviene abrir subtareas por fase:

- `4.1` contratos y modelos,
- `4.2` autorización por proceso,
- `4.3` realtime/EMQX,
- `4.4` panel frontend,
- `4.5` extracción futura a microservicio.
