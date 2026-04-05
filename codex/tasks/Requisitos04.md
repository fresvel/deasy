# Implementación pendiente del sistema de chat y notificaciones

## Objetivo

  Implementar un sistema de chat y notificaciones en tiempo real para `deasy`
  que:

  1. permita conversaciones directas, grupales y threads ligados a procesos,
  2. persista mensajes y conversaciones en MongoDB,
  3. publique eventos realtime por EMQX,
  4. integre el acceso al dashboard operativo sin romper el dominio actual,
  5. deje preparada una extracción futura hacia un microservicio dedicado de
     mensajería si la carga, el alcance funcional o la operación lo justifican.
  6. sea compatible desde su diseño con una futura app móvil sin depender del
     dashboard web como único cliente.

## Decisión arquitectónica recomendada

### Decisión actual

  Implementar el chat inicialmente dentro del `backend/` principal, respetando
  la estructura actual de rutas, controladores y servicios.

### Justificación

  - el sistema todavía no tiene módulo de chat implementado; separar desde el
    inicio agregaría complejidad operativa antes de validar el flujo funcional,
  - el backend actual ya centraliza autenticación, permisos, procesos y panel
    operativo; eso reduce fricción para resolver autorización del chat,
  - a diferencia del compilador documental, el chat no nace hoy como un
    pipeline pesado, aislable por CPU o runtime distinto; su complejidad
    inmediata está más en autorización, realtime y UX que en cómputo técnico,
  - el diseño debe dejarse desacoplado para extraerlo luego si pasa a manejar:
      - notificaciones multicanal,
      - autenticación/ACL HTTP de EMQX,
      - reglas complejas de presencia,
      - workers dedicados,
      - escalado independiente,
      - SLAs propios.

### Recomendación a futuro

  Preparar un **módulo extraíble** o **bounded context de mensajería** dentro del
  backend actual. Si el sistema crece, ese módulo podrá migrarse a un
  microservicio `chat-service` sin rediseñar contratos públicos ni modelo
  conceptual.

## Validaciones técnicas apoyadas con Context7

  Buenas prácticas base validadas con Context7:

  - `MongoDB` (`/mongodb/docs`): para relaciones 1:N con crecimiento no acotado,
    conviene usar documentos referenciados y evitar arrays no acotados; por eso
    `messages` no debe embutirse dentro de `conversations`.
  - `EMQX` (`/emqx/emqx-docs`): EMQX puede delegar autenticación/autorización a
    un servicio HTTP externo y aceptar ACL por cliente en la respuesta; esto
    vuelve viable una extracción futura del módulo de mensajería como servicio
    propio de auth/ACL/publicación.
  - `Express` (`/expressjs/express`): la organización por routers y middleware
    modulares encaja con una implementación inicial en el backend monolítico sin
    perder capacidad de extracción posterior.

## Estado actual del repositorio

  Ya existe:

  - MongoDB en el stack Docker.
  - EMQX en el stack Docker.
  - bucket/prefijo de chat en MinIO:
      - `deasy-chat/Chat`
  - placeholder visual de `Chat del proceso` en el dashboard.
  - señalización backend de capacidad:
      - `can_open_process_chat`
      - `implemented.process_chat = false`

  Falta:

  - modelos Mongo de conversaciones, mensajes y notificaciones,
  - rutas `/chat` y `/notifications`,
  - servicio de publicación a EMQX,
  - resolución real de participantes y permisos del thread de proceso,
  - vista o panel de chat en frontend,
  - integración de suscripción realtime en frontend,
  - políticas operativas de ACL, retención, unread y adjuntos.

## Modelo de dominio recomendado

### 1. Fuente de verdad

  - MariaDB debe seguir siendo la fuente de verdad para:
      - usuarios/personas,
      - procesos,
      - tareas y entregables,
      - permisos y relaciones organizacionales,
      - resolución del responsable del proceso.
  - MongoDB debe ser la fuente de verdad para:
      - conversations,
      - messages,
      - notifications,
      - cursores o marcadores de lectura si se decide externalizarlos.

### 2. Colecciones iniciales

  #### conversations

  Campos mínimos:

  - `_id`
  - `type`:
      - `direct`
      - `group`
      - `thread`
  - `title`
  - `participants`
      - arreglo acotado de participantes activos
      - cada participante debe tener al menos:
          - `person_id`
          - `role`
          - `joined_at`
          - `left_at` opcional
  - `process_id` opcional para `thread`
  - `created_by`
  - `created_at`
  - `updated_at`
  - `last_message_id`
  - `last_message_at`
  - `archived_at` opcional
  - `mobile_summary` opcional si luego se requiere snapshot liviano para lista
    de conversaciones en clientes móviles

  Índices mínimos:

  - `participants.person_id`
  - `process_id`
  - `updated_at`

  #### messages

  Campos mínimos:

  - `_id`
  - `conversation_id`
  - `sender_person_id`
  - `content`
  - `content_type`
      - `text`
      - `system`
      - `attachment`
  - `attachments`
  - `reply_to_message_id` opcional
  - `created_at`
  - `edited_at` opcional
  - `deleted_at` opcional
  - `read_by` opcional en fase 1 o sustituible por colección separada
  - `delivery_state` opcional si luego se necesita distinguir entrega,
    recepción o sincronización por dispositivo

  Índices mínimos:

  - `conversation_id + created_at`
  - `sender_person_id + created_at`

  Nota técnica:

  - no guardar todos los mensajes dentro de `conversations`,
  - si `read_by` crece demasiado, moverlo a una colección `message_reads`.

  #### notifications

  Campos mínimos:

  - `_id`
  - `recipient_person_id`
  - `type`
  - `title`
  - `body`
  - `entity_type`
  - `entity_id`
  - `conversation_id` opcional
  - `message_id` opcional
  - `created_at`
  - `read_at` opcional
  - `channel` opcional para distinguir:
      - `in_app`
      - `push`
      - `email`
      - `whatsapp`

## Compatibilidad futura con app móvil

### 1. Principio de diseño

  El sistema de chat no debe diseñarse como una extensión visual exclusiva del
  dashboard web.

  Debe diseñarse como un módulo de mensajería con contratos HTTP y realtime
  reutilizables por:

  - frontend web,
  - app móvil,
  - y eventualmente otros clientes internos.

### 2. Reglas de compatibilidad móvil

  - la API debe ser neutral al cliente y no devolver estructuras acopladas a
    componentes del dashboard,
  - el flujo principal puede abrirse desde `Chat del proceso`, pero el contrato
    debe poder ser consumido por una app móvil sin conocer la UI web,
  - la carga de mensajes debe ser paginada o por cursor desde el inicio,
  - el cliente debe poder sincronizar:
      - listado de conversaciones,
      - mensajes por conversación,
      - estado de lectura,
      - notificaciones,
  - el sistema debe tolerar modo offline parcial y resincronización por HTTP,
  - realtime debe complementar la API HTTP, no sustituirla.

### 3. Estrategia recomendada para móvil

  - `HTTP` para bootstrap, paginación, historial, envío y acciones explícitas,
  - `EMQX/WebSocket` para eventos realtime cuando el cliente esté conectado,
  - `notifications` como base de futuras notificaciones push
    (`FCM`/`APNs`) sin cambiar el modelo central.

### 4. Requisitos mínimos de API para móvil

  La API debe contemplar desde el inicio:

  - paginación por `limit` + `cursor` o `before`,
  - orden temporal estable,
  - ids opacos y consistentes,
  - timestamps normalizados,
  - endpoints para marcar leído,
  - respuesta liviana para lista de conversaciones,
  - respuesta detallada para historial de mensajes.

### 5. Riesgo a evitar

  No convertir el chat en una API “del dashboard” con payloads mezclados con
  contexto visual de web. El contexto de proceso puede viajar como metadata,
  pero el contrato debe seguir siendo un contrato de mensajería reutilizable.

## Tipos de conversación

### direct

  - 1:1 entre dos personas.
  - no debe duplicarse si ya existe una conversación activa entre las mismas dos
    personas, salvo decisión explícita de versionado o archivo.

### group

  - conversación multiusuario no necesariamente ligada a proceso.
  - su uso puede quedar fuera del MVP si el foco inicial es `thread`.

### thread

  - conversación ligada al seguimiento operativo de un proceso.
  - es el objetivo prioritario para integrarse al dashboard operativo.
  - la autorización de participantes debe derivarse del dominio SQL y no desde
    reglas aisladas en Mongo.

### 5.1 Regla canónica del thread de proceso

  Para cumplir continuidad entre periodos/versiones y a la vez encapsular por
  unidad, el thread principal de proceso no debe identificarse solo por
  `process_id` ni por `process_definition_id`.

  La regla recomendada es:

  - un thread canónico por:
      - `process_id`
      - `scope_unit_id`

  Donde:

  - `process_id` representa el proceso funcional estable,
  - `scope_unit_id` representa la unidad operativa que delimita el espacio del
    chat,
  - `process_definition_id` puede viajar como metadata contextual, pero no debe
    definir la identidad persistente del thread.

  Justificación:

  - si se usa solo `process_id`, distintas unidades podrían compartir el mismo
    chat y romper encapsulamiento,
  - si se usa `process_definition_id`, el chat se fragmenta cuando la definición
    se versiona,
  - `process_id + scope_unit_id` permite continuidad histórica y aislamiento
    organizacional al mismo tiempo.

### 5.2 Identidad técnica recomendada del thread

  En MongoDB, la conversación canónica de proceso debe guardar al menos:

  - `type = "process_thread"`
  - `scope.process_id`
  - `scope.scope_unit_id`
  - `scope.stable_key = "process:{process_id}:unit:{scope_unit_id}"`
  - `scope.current_definition_id` opcional
  - `scope.origin_definition_id` opcional

  `scope.stable_key` debe ser único.

### 5.3 Momento de creación

  El thread no debe crearse al crear la definición del proceso.

  Debe crearse cuando exista el primer contexto operativo real para la
  combinación `process_id + scope_unit_id`.

  Regla inicial recomendada:

  - si un usuario autorizado intenta abrir el thread canónico del proceso y este
    no existe, el backend lo crea,
  - si ya existe, lo reutiliza.

  Justificación:

  - al crear la definición todavía no existe necesariamente contexto operativo
    real,
  - todavía no hay participantes efectivos resueltos,
  - evita crear conversaciones vacías o abstractas sin uso real.

### 5.4 Resolución inicial de `scope_unit_id`

  En esta primera implementación se recomienda resolver `scope_unit_id` usando
  la unidad responsable de la tarea activa del proceso.

  Fuente principal:

  - `tasks.responsible_position_id -> unit_positions.unit_id`

  `task_items.responsible_position_id` puede quedar como metadata secundaria,
  pero no como identificador principal del thread en la fase inicial.

### 5.5 Participantes base automáticos

  El thread canónico debe poder poblar participantes a partir del dominio SQL.

  Participantes base recomendados:

  - personas asignadas en `task_assignments.assigned_person_id`,
  - personas asignadas en `task_items.assigned_person_id`,
  - personas asignadas en `fill_requests.assigned_person_id`,
  - personas asignadas en `signature_requests.assigned_person_id`,
  - dueños documentales en `documents.owner_person_id`,
  - dueños de entregables o documentos en tareas padre cuando la relación de
    parentazgo exista y sea relevante para seguimiento.

  La membresía en Mongo debe ser tratada como snapshot operativo sincronizable,
  no como fuente de verdad independiente del dominio.

### 5.6 Administradores del thread

  La administración de participantes no debe quedar abierta a cualquier miembro.

  Regla inicial recomendada:

  Puede agregar o quitar participantes quien cumpla una de estas condiciones:

  - ocupa la `responsible_position_id` de una tarea activa del ámbito
    `process_id + scope_unit_id`,
  - ocupa la `responsible_position_id` de un `task_item` relevante del mismo
    ámbito cuando aplique una política específica,
  - es `created_by_user_id` de una tarea manual del mismo ámbito y no existe
    todavía un responsable posicional más específico.

### 5.7 Mensajería ligada a entregables

  En el MVP no conviene crear un chat separado por entregable.

  En su lugar:

  - el thread principal del proceso actúa como espacio de seguimiento,
  - cada mensaje puede referenciar opcionalmente:
      - `task_id`
      - `task_item_id`
      - `document_id`
      - `document_version_id`

  Esto mantiene el modelo simple y deja abierta la posibilidad futura de
  subthreads si realmente se necesitan.

## Reglas de negocio mínimas

### 1. Acceso

  - un usuario solo puede ver conversaciones donde participa,
  - un usuario solo puede listar mensajes de conversaciones autorizadas,
  - solo backend publica eventos a EMQX,
  - el frontend nunca publica directo al broker.

### 2. Threads de proceso

  - debe existir una regla explícita para resolver quién puede:
      - crear el thread,
      - agregar participantes,
      - retirar participantes,
      - leer historial,
      - enviar mensajes del proceso.
  - la identificación del responsable del proceso debe venir del modelo
    relacional actual o de una política claramente documentada.

### 3. Adjuntos

  - los adjuntos deben vivir en MinIO, no en Mongo,
  - Mongo solo guarda metadata del archivo,
  - el prefijo recomendado es:
      - `deasy-chat/Chat/{conversationId}/`
  - tamaño máximo inicial:
      - 100 MB si se confirma operativamente,
      - o un límite menor en MVP si el flujo de upload aún no está endurecido.

### 4. Lectura y trazabilidad

  - el sistema debe poder marcar notificaciones leídas,
  - el sistema debe poder distinguir:
      - mensaje creado,
      - mensaje editado,
      - mensaje eliminado lógicamente,
      - notificación leída.

## Requisitos de backend

### 1. Organización interna

  Crear el módulo `chat` dentro del backend respetando el patrón actual:

  - `routes/chat_router.js`
  - `controllers/chat/...`
  - `services/chat/...`
  - `models/chat/...`

  Objetivo de diseño:

  - que el módulo pueda extraerse luego a un microservicio con mínimo cambio en
    contratos HTTP y eventos.

### 2. Servicios recomendados

  - `ChatConversationService`
  - `ChatMessageService`
  - `ChatNotificationService`
  - `ChatAuthorizationService`
  - `ChatRealtimePublisherService`

### 3. Responsabilidades del backend principal

  - autenticar usuario,
  - resolver `person_id` y contexto actual,
  - validar acceso al proceso/thread,
  - persistir conversación o mensaje,
  - publicar evento a EMQX,
  - devolver payload enriquecido al frontend.

### 4. Endpoints mínimos del MVP

  - `POST /chat/conversations`
  - `GET /chat/conversations`
  - `GET /chat/conversations/:id`
  - `GET /chat/conversations/:id/messages`
  - `POST /chat/conversations/:id/messages`
  - `POST /chat/conversations/:id/participants`
  - `DELETE /chat/conversations/:id/participants/:personId`
  - `GET /notifications`
  - `POST /notifications/read`

  Requisito adicional:

  - `GET /chat/conversations` y `GET /chat/conversations/:id/messages` deben
    diseñarse con paginación compatible con móvil.
  - si se soportan adjuntos, el módulo debe exponer endpoints protegidos para:
      - cargar archivos a la conversación,
      - descargar adjuntos por mensaje e índice,
    sin exponer acceso directo no autorizado al bucket.

### 5. Endpoint recomendado de conveniencia

  Para el caso principal del dashboard:

  - `POST /chat/processes/:processId/thread`
      - crea o recupera el thread canónico del proceso
  - `GET /chat/processes/:processId/thread`
      - devuelve la conversación y metadata para abrir el panel.

  Nota de diseño:

  - estos endpoints son de conveniencia para el caso de uso web actual,
  - pero no deben reemplazar los endpoints generales de conversación y mensajes.

## Requisitos realtime / EMQX

### 1. Topics iniciales

  - `users/{userId}/notifications`
  - `conversations/{conversationId}/messages`
  - `processes/{processId}/thread`

### 2. Política de publicación

  - solo backend publica,
  - frontend solo se suscribe,
  - el evento realtime no sustituye persistencia; solo propaga cambios.

### 3. Eventos mínimos

  - `message.created`
  - `message.updated`
  - `message.deleted`
  - `conversation.updated`
  - `notification.created`
  - `notification.read`

  Para esta fase:

  - `message.created` se publica al menos en:
      - `conversations/{conversationId}/messages`
      - `processes/{processId}/thread` cuando aplique
  - cada destinatario recibe además `notification.created` en:
      - `users/{userId}/notifications`

### 4. ACL y autenticación

  MVP:

  - puede mantenerse una configuración simple en entorno local para avanzar en
    desarrollo,
  - pero debe diseñarse ya el contrato para autenticación/ACL externa.

  Implementación pragmática de esta fase:

  - el backend puede publicar hacia EMQX usando la API HTTP del broker,
  - las credenciales del publicador deben vivir solo en backend/env,
  - si la publicación realtime falla, el mensaje persiste igual y el error debe
    quedar trazado sin romper el envío principal.

  Objetivo futuro:

  - autenticar clientes EMQX contra servicio HTTP,
  - devolver ACL por usuario/cliente,
  - centralizar autorización realtime en el módulo de mensajería extraíble.

### 5. Compatibilidad con clientes móviles

  - el diseño realtime no debe asumir una sola sesión web,
  - debe tolerar múltiples clientes por usuario,
  - debe dejar abierta la posibilidad de credenciales por cliente/dispositivo si
    luego EMQX y seguridad lo requieren.

## Requisitos de frontend

### 1. Integración inicial

  El MVP debe integrarse primero al dashboard operativo existente.

  Se recomienda:

  - abrir el `Chat del proceso` desde el panel del entregable,
  - mostrar el thread ligado al `process_id`,
  - evitar crear una experiencia global de chat antes de validar el caso de uso
    principal.

### 1.1 Patrón UX/UI del contenedor de chat

  La experiencia de chat no debe reintroducir un panel que empuje o comprima el
  contenido principal del dashboard.

  Decisión recomendada:

  - usar un botón flotante en la esquina inferior derecha,
  - abrir un panel superpuesto anclado a la derecha en desktop,
  - usar una variante tipo sheet o pantalla completa en mobile,
  - no modificar el ancho del contenido principal al abrir o cerrar el chat.

  Justificación UX/UI:

  - el dashboard actual ya es denso y no conviene reducir su ancho útil,
  - evitar reflow visual y desplazamiento de targets mientras el usuario trabaja,
  - mantener consistencia con patrones overlay ya presentes en la interfaz,
  - permitir que el chat funcione como herramienta transversal sin competir con
    el panel operativo.

### 2. Componentes recomendados

  - `ProcessChatLauncher.vue`
  - `ProcessChatPanel.vue`
  - `ProcessChatMessageList.vue`
  - `ProcessChatComposer.vue`
  - `ProcessChatConversationList.vue`
  - `ProcessChatHeader.vue`
  - `ProcessChatSidebar.vue` opcional si luego se expande a layout dual

### 2.1 Estructura visual interna del panel

  El panel debe organizarse verticalmente en tres zonas:

  - `header`
  - `body`
  - `footer`

  #### header

  Debe incluir:

  - control de modo o tabs para:
      - `Procesos`
      - `Grupos`
      - `Usuarios`
  - búsqueda
  - estado contextual de la conversación actual cuando aplique

  #### body

  Debe soportar dos estados principales:

  - listado de conversaciones ordenadas por recientes,
  - conversación abierta.

  Regla recomendada para esta primera implementación:

  - dentro del panel usar flujo `lista -> conversación`,
  - no intentar en el MVP una vista simultánea de listado + conversación en una
    columna estrecha.

  #### footer

  Debe contener el composer del mensaje:

  - altura adaptable según contenido,
  - posibilidad futura de adjuntos,
  - acciones primarias claras de envío.

### 3. Capacidades mínimas

  - cargar thread del proceso,
  - listar mensajes paginados,
  - enviar mensaje,
  - mostrar estado de carga/error,
  - reflejar llegada realtime,
  - mostrar adjuntos si el backend ya los soporta,
  - mostrar notificaciones no leídas si se habilitan en la UI del dashboard.

  Decisión de esta fase:

  - mientras el cliente realtime EMQX no esté montado en frontend, el panel debe
    refrescar con fallback seguro por polling al abrir una conversación.

  Requisito adicional:

  - los servicios frontend que consuman chat deben abstraerse lo suficiente para
    que luego pueda existir un cliente móvil con los mismos contratos sin
    rediseñar la API.

### 3.1 Reglas UX/UI específicas

  - el botón flotante debe permanecer accesible y no bloquear acciones críticas
    del dashboard,
  - el panel debe poder cerrarse sin perder el contexto del dashboard,
  - el overlay debe priorizar legibilidad y foco sin oscurecer en exceso el
    resto de la interfaz,
  - la lista de conversaciones debe mostrar señales claras de recencia y no
    leídos,
  - al abrir una conversación, el cambio de estado debe sentirse continuo dentro
    del mismo panel,
  - el footer de composición no debe tapar mensajes recientes ni romper el
    scroll,
  - el flujo de adjuntar archivo debe ser discreto y no romper el envío de
    texto simple.

### 4. Reglas UX

  - no bloquear el dashboard si el chat falla,
  - el panel debe poder degradar a polling o recarga manual si realtime falla,
  - mensajes de error deben ser claros,
  - el botón actual `Chat del proceso` debe dejar de ser placeholder y abrir el
    flujo real.

## Requisitos de observabilidad

  - logs estructurados por operación de chat,
  - correlación con:
      - `conversation_id`
      - `message_id`
      - `process_id`
      - `person_id`
  - métricas mínimas:
      - conversaciones creadas,
      - mensajes enviados,
      - errores de publicación realtime,
      - errores de autorización,
      - latencia de persistencia/publicación.

  Mínimo aceptable en esta fase:

  - registrar en backend errores de publicación a EMQX con al menos:
      - `conversation_id`
      - `message_id`
      - motivo de error
  - registrar además eventos estructurados de:
      - creación de conversación/thread,
      - creación de mensaje,
      - marcado de lectura,
      - carga de adjuntos

## Requisitos de unread / read state

### Decisión inicial

  En esta primera fase el estado de lectura queda dividido así:

  - `messages.read_by` para saber si una persona ya leyó mensajes de una
    conversación,
  - `notifications.read_at` para manejar la bandeja de notificaciones in-app.

### Reglas mínimas

  - al abrir una conversación, el backend debe poder marcar como leídos los
    mensajes ajenos del thread para ese usuario,
  - al marcar una conversación como leída, también deben poder cerrarse las
    notificaciones in-app asociadas a esa conversación para ese mismo usuario,
  - si `read_by` se vuelve demasiado grande, podrá extraerse después a
    `message_reads` sin cambiar el contrato funcional del módulo.

## Requisitos de seguridad

  - validar acceso a cada conversación,
  - validar cada upload de adjunto,
  - sanitizar nombres de archivo,
  - no exponer secretos de EMQX al frontend,
  - no confiar en `conversation_id` enviado por el cliente sin revalidación de
    membresía,
  - proteger lectura de mensajes y adjuntos por autorización real.

## Requisitos de microservicio futuro

### Cuándo sí conviene extraerlo

  Extraer el módulo a un microservicio dedicado cuando aparezcan uno o más de
  estos factores:

  - alto volumen de mensajes o conexiones websocket,
  - necesidad de despliegue independiente del backend principal,
  - autenticación/ACL HTTP de EMQX como responsabilidad propia,
  - notificaciones multicanal:
      - email
      - WhatsApp
      - push
  - workers de fanout, retries o delivery tracking,
  - políticas de retención/archivo independientes,
  - necesidad de escalar mensajería sin escalar todo el backend.

### Qué contrato debe preservarse desde ya

  - endpoints HTTP del módulo,
  - forma de eventos publicados,
  - esquema conceptual de:
      - conversación
      - mensaje
      - notificación
  - separación entre autorización de negocio y persistencia de mensajería.

  Agregar explícitamente:

  - compatibilidad del contrato con clientes web y móvil,
  - capacidad de fanout futuro hacia push notifications sin romper el modelo.

### Recomendación explícita

  - **No** crear el microservicio en esta primera implementación.
  - **Sí** diseñar el módulo como frontera clara y extraíble.
  - **Sí** dejar backlog técnico para `chat-service` cuando el módulo madure.

## Backlog sugerido

  1. Definir contrato funcional del thread de proceso.
  2. Resolver en SQL la política de participantes autorizados por proceso.
  3. Crear modelos Mongo de `conversations`, `messages` y `notifications`.
  4. Implementar servicios internos de autorización, persistencia y publicación.
  5. Exponer endpoints `/chat` y `/notifications`.
  6. Implementar publicación realtime a EMQX.
  7. Integrar el botón `Chat del proceso` del dashboard.
  8. Implementar panel de chat y carga paginada de mensajes.
  9. Implementar unread/read state mínimo.
  10. Implementar adjuntos en MinIO si entran en el MVP.
  11. Agregar logs, métricas y manejo de errores.
  12. Asegurar compatibilidad del contrato con futura app móvil.
  13. Preparar estrategia futura de push notifications sobre `notifications`.
  14. Preparar documento de extracción futura a `chat-service`.

## Criterios de aceptación

  - un usuario autenticado puede abrir el thread de un proceso autorizado,
  - el sistema crea o recupera una conversación `thread` canónica por proceso,
  - un mensaje enviado queda persistido en MongoDB,
  - el evento correspondiente se publica por EMQX,
  - el frontend recibe actualización realtime o, en fallback, puede refrescar el
    estado sin romper UX,
  - el botón `Chat del proceso` deja de ser placeholder,
  - la API queda usable por una futura app móvil sin depender de payloads
    acoplados al dashboard,
  - la implementación no rompe separación entre dominio SQL y mensajería,
  - el diseño deja documentada la ruta de extracción futura a microservicio.
