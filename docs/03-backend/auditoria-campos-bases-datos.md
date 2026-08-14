# Auditoria de campos en las bases de datos

> ⚠️ **Documento histórico (pre-migración PostgreSQL).** Refleja el estado del **6 de junio de 2026**, cuando el sistema todavía usaba **MariaDB + MongoDB**. Ambos motores fueron **retirados**: hoy el único datastore es **PostgreSQL** (`backend/database/postgres_schema.sql`). Se conserva como registro de la auditoría previa a la migración; no describe el esquema actual.

## Objetivo

Identificar tablas, colecciones y campos que:

- no tienen lectores ni escritores efectivos;
- duplican una fuente de verdad existente;
- pertenecen a una migracion incompleta;
- representan capacidades futuras que hoy no participan en el negocio;
- son tecnicos y necesarios, pero generan ruido si se muestran como campos editables.

La auditoria no elimina datos ni modifica esquemas. Define candidatos y el orden seguro de intervencion.

## Alcance revisado

Fecha de revision: 6 de junio de 2026.

- MariaDB activo: 61 tablas base y 1 vista.
- MongoDB activo: 8 colecciones.
- Esquema canonico: `backend/database/mariadb_schema.sql`.
- Migraciones de arranque: `backend/database/mariadb_initializer.js`.
- Modelos Mongoose de `backend/models/`.
- Rutas, controladores y servicios de backend.
- Configuracion del CRUD SQL en `backend/config/sqlTables.js`.
- Consumidores del frontend.
- Datos del entorno local mediante consultas de solo lectura.

El entorno local tiene pocos datos y las ocho colecciones MongoDB estan vacias. Por tanto, la ausencia de valores locales se uso solo como evidencia secundaria. La evidencia principal es la trazabilidad estatica de lecturas, escrituras, rutas y reglas de negocio.

## Resumen ejecutivo

La mayor fuente de ruido no son campos aislados, sino cuatro migraciones incompletas:

1. `persons` reemplazo a `users`, pero `users` y sus tablas de codigos siguen presentes.
2. El modelo documental conserva campos de payload heredados que no se escriben.
3. MariaDB conserva referencias a perfiles y conversaciones Mongo que el flujo actual ya no utiliza.
4. MongoDB mantiene colecciones y referencias de identidad, estructura y perfiles que duplican MariaDB.

### Retirada prioritaria

Los siguientes elementos tienen evidencia suficiente para preparar su eliminacion:

| Tabla o coleccion | Campo | Evidencia | Accion propuesta |
| --- | --- | --- | --- |
| `documents` | `comments_thread_ref` | No tiene lectores ni escritores runtime. El chat usa `ChatConversation.scope.stable_key` y autorizacion relacional. | Eliminar tras comprobar valores en produccion. |
| `tasks` | `comments_thread_ref` | Mismo caso que `documents.comments_thread_ref`. | Eliminar tras comprobar valores en produccion. |
| `document_versions` | `payload_mongo_id` | Solo se copia al reiniciar un flujo; no existe escritor actual. El CRUD lo identifica como legacy. | Eliminar y retirar la copia en `DocumentWorkflowResetService`. |
| `document_versions` | `payload_hash` | Se copia, pero no se calcula ni valida. | Implementar integridad real o eliminar. |
| `document_versions` | `payload_object_path` | Se selecciona y copia, pero no se escribe ni consume para construir el payload actual. | Eliminar si no existe integracion externa. |
| `document_versions` | `format`, `render_engine` | No tienen escritor; solo se devuelven como metadatos nulos. | Derivar desde el artifact o implementar persistencia; no conservar ambos modelos. |
| `unit_positions` | `profile_ref` | Referencia Mongo sin uso en asignacion, autorizacion o generacion. | Eliminar tras retirar seeds y metadatos de admin. |
| `vacancies` | `profile_ref` | Se devuelve en una consulta, pero no participa en filtros ni reglas. | Eliminar o reemplazar por una FK MariaDB concreta. |
| `signature_requests` | `notified_at` | No se escribe ni se lee en el flujo de firma. | Eliminar o implementar el evento de notificacion. |
| `task_assignments` | `unassigned_at` | Nunca se escribe; la reasignacion elimina filas. | Eliminar o cambiar el flujo a baja logica. |
| `dossiers` | `usuario` | Referencia al `Usuario` Mongo legado; `cedula` y `persons` ya resuelven identidad. | Migrar dossiers y eliminar la referencia. |

### Problemas estructurales de mayor riesgo

#### Identidad duplicada

`persons` es la fuente de verdad usada por autenticacion, RBAC, tareas, documentos, firmas y dossier. Sin embargo, el inicializador crea tambien `users` con identidad, credenciales y contacto duplicados.

La base local confirma:

- `persons`: 1 registro;
- `users`: 0 registros.

El conjunto completo de `users` es candidato a retirada:

`mongo_id`, `cedula`, `email`, `password_hash`, `nombre`, `apellido`, `whatsapp`, `direccion`, `pais`, `status`, `verify_email`, `verify_whatsapp`, `photo_url`, `created_at`, `updated_at`.

No se debe eliminar la tabla de forma aislada. Primero hay que corregir las tablas de codigos:

- `email_verification_codes.user_id` referencia `users`.
- `password_reset_codes.user_id` referencia `users` y es `NOT NULL`.
- `password_reset_codes.person_id` se agrego despues como enlace a `persons`.

El servicio de recuperacion inserta solo `person_id`, por lo que un esquema limpio puede rechazar la operacion al faltar `user_id`. Ademas, la verificacion de correo actualiza `users`, no `persons`.

Las rutas de correo y recuperacion existen, pero no estan montadas en `backend/index.js`, mientras el frontend si intenta consumirlas. La migracion esta funcionalmente incompleta.

Accion:

1. Convertir `email_verification_codes.user_id` en `person_id` con FK a `persons`.
2. Eliminar `password_reset_codes.user_id`.
3. Hacer `password_reset_codes.person_id` obligatorio.
4. Actualizar la verificacion para modificar `persons.verify_email`.
5. Montar las rutas si la funcionalidad sigue vigente.
6. Eliminar `users` cuando no existan referencias ni datos.

#### Tablas fuera del esquema canonico

Las siguientes tablas existen en MariaDB, pero no aparecen en `mariadb_schema.sql` y no tienen referencias en backend ni frontend:

- `person_health`
- `person_bank_accounts`
- `person_emergency_contacts`

Todas estan vacias en el entorno local.

Son candidatas fuertes a eliminacion por deriva de esquema. Antes de retirarlas se debe confirmar que no sean consumidas por reportes, integraciones o cargas externas en produccion.

## Hallazgos por dominio

### Personas

#### Conservar

En `persons` se usan activamente:

- identidad: `id`, `cedula`, `first_name`, `last_name`, `email`;
- autenticacion: `password_hash`, `status`, `is_active`, `token`;
- verificacion y contacto: `whatsapp`, `verify_email`, `verify_whatsapp`, `photo_url`;
- residencia: `pais_residencia`, `provincia_residencia`, `ciudad_residencia`, `calle_primaria`, `calle_secundaria`, `codigo_postal`;
- auditoria: `created_at`, `updated_at`.

`token` no es relleno: participa en el flujo de firma PDF.

#### Normalizar

- `direccion` almacena coordenadas `latitud,longitud`, no una direccion postal. Debe renombrarse a un nombre como `geo_coordinates` o dividirse en `latitude` y `longitude`.
- `pais` se llena desde `pais_residencia` durante el registro. Debe elegirse una sola fuente de verdad y migrar los consumidores antes de eliminar una de las dos columnas.

Estos campos no son eliminables de inmediato porque el registro y la edicion de perfil aun los usan.

#### Nombres heredados de identidad

Varias FKs apuntan a `persons`, pero conservan el sufijo `user_id`:

- `process_runs.created_by_user_id`;
- `tasks.created_by_user_id`;
- `document_signatures.signer_user_id`;
- `signature_batch_jobs.user_id`.

No son campos inutiles. Conviene renombrarlos gradualmente a `created_by_person_id`, `signer_person_id` y `person_id` para dejar claro que ya no referencian `users`.

#### Certificados

`person_certificates` y todos sus campos tienen uso efectivo en carga, descarga, seleccion del certificado predeterminado y firma. Debe conservarse.

### Organizacion y seguridad

#### Conservar

Las siguientes estructuras participan en jerarquia, asignaciones o autorizacion:

- `unit_types`, `units`, `unit_relations`, `unit_positions`;
- `position_assignments`;
- `cargos`, `cargo_role_map`;
- `roles`, `resources`, `actions`, `permissions`;
- `role_permissions`, `role_assignments`;
- vista `unit_org_levels`.

`cargo_role_map`, `role_assignments.source` y `role_assignments.derived_from_assignment_id` son usados por triggers para crear y cerrar roles derivados de ocupaciones. No deben eliminarse.

#### Capacidad de herencia dormida

Los siguientes elementos existen para propagacion jerarquica de roles, pero no intervienen en `RbacService`:

- `relation_unit_types.is_inheritance_allowed`;
- `role_assignments.max_depth`;
- tabla `role_assignment_relation_types`;
- todos los campos de esa tabla: `id`, `relation_type_id`, `role_assignment_id`.

Solo aparecen en scripts de validacion o administracion. El RBAC actual evalua asignaciones ya materializadas y no recorre estas reglas.

Decision requerida:

- si la herencia de roles forma parte del roadmap, implementar el resolver y ocultar estos campos del CRUD normal;
- si no forma parte del roadmap, eliminar la tabla y los dos campos asociados.

### Procesos y plantillas

#### Conservar

Los campos de las siguientes tablas tienen uso efectivo en configuracion, vigencia, generacion o resolucion:

- `processes`;
- `process_definition_series`;
- `process_definition_versions`;
- `process_definition_triggers`;
- `process_target_rules`;
- `process_definition_templates`;
- `template_seeds`;
- `template_artifacts`;
- `terms`, `term_types`.

No son ruido:

- `include_descendants`, `recipient_policy` y `priority` alteran la seleccion de destinatarios.
- `effective_from` y `effective_to` controlan vigencia.
- `creates_task`, `instance_mode`, `is_required` y `sort_order` afectan la generacion y presentacion.
- `normalized_term_type_id` y `active_series_flag` soportan restricciones de unicidad condicional.
- `available_formats`, `schema_object_key`, `base_object_prefix` y `content_hash` soportan almacenamiento, compilacion e integridad de artifacts.
  *(La lista incluía `meta_object_key`. **Esa columna ya no existe**: apuntaba al `meta.yaml` del artifact, y el sub-paso 8 del §0.8 la dropeó junto con el propio `meta.yaml` — `postgres_schema.sql:548-562`.)*

#### Redundancias activas

`process_definition_versions.variation_key` duplica conceptualmente la serie enlazada por `series_id`, pero se usa en consultas, restricciones y activacion. No debe eliminarse directamente.

Mejora propuesta:

1. Usar `process_definition_series.code` como fuente canonica.
2. Migrar consultas e indices.
3. Eliminar `variation_key` solo cuando deje de participar en contratos.

`template_artifacts.owner_ref` se superpone con `owner_person_id`, pero aun decide si una plantilla es oficial o editable y se escribe en manifiestos. Es una redundancia transitoria, no un campo muerto.

Mejora propuesta:

1. Determinar propiedad exclusivamente con `owner_person_id`.
2. Derivar la cedula o slug de almacenamiento desde la persona.
3. Migrar manifiestos y rutas.
4. Eliminar `owner_ref`.

### Ejecucion de procesos y tareas

#### Conservar

`process_runs`, `tasks` y `task_items` contienen snapshots necesarios para conservar el contexto con el que se genero una ejecucion.

Aunque parezcan duplicados, deben conservarse:

- `task_items.template_artifact_id`: fija el artifact usado por el entregable.
- `task_items.responsible_position_id` y `assigned_person_id`: fijan el responsable del item.
- `tasks.responsible_position_id`: fija la unidad/puesto que origino la tarea.
- `tasks.parent_task_id`: soporta tareas manuales derivadas.
- `task_items.user_started_at`: registra inicio operativo real.

Las columnas `automatic_flag` y `manual_user_flag` son generadas y soportan unicidad condicional. No deben mostrarse como campos de negocio ni editarse.

#### Ciclo de vida incompleto en asignaciones

`task_assignments.status` se consulta y filtra, pero no existe un escritor runtime que lo cambie. En la practica permanece en `pendiente`.

`task_assignments.unassigned_at` tampoco se escribe. Al sincronizar asignaciones se eliminan filas con `DELETE`.

Debe elegirse un unico modelo:

- modelo historico: actualizar `status` y `unassigned_at`, sin borrar filas;
- modelo snapshot: eliminar ambos campos y tratar la existencia de la fila como asignacion activa.

Mantener ambos enfoques simultaneamente solo agrega estados ficticios y ruido.

#### Corridas reservadas pero no implementadas

`process_runs.source_run_id` y `reason` estan soportados por el helper, pero ningun consumidor actual envia valores. Los modos `reinstanced` y `repair` aparecen en el CRUD, pero no tienen flujo de negocio.

No deben eliminarse sin una decision de producto. Si no se implementaran reintentos, reparaciones o re-instanciacion, se pueden retirar junto con esos valores de `run_mode`.

### Documentos

#### Conservar

Se usan activamente:

- `documents.task_item_id`, `owner_person_id`, `origin_unit_id`, `title`, `status`;
  *(La lista incluía también `instance_no` y `origin_type`. **Ninguna de las dos existe hoy**: `documents` tiene nueve columnas y no están entre ellas. `origin_type` —el discriminador `task_item | standalone | imported | generated`— se retiró el 2026-08-10 al resolverse el «documento suelto» por el Proceso por defecto; ver `docs/arquitecturas/modelo-templates-entregables-limpio.md` §4.)*
- `document_versions.document_id`, `version`, `template_artifact_id`, `working_file_path`, `final_file_path`, `status`;
- todos los campos de `document_attachments`;
- todos los campos de `document_signatures`.

`documents.status` y `document_versions.status` son una desnormalizacion controlada por `DocumentStateService`. Puede revisarse a futuro, pero hoy participa en consultas y transiciones.

#### Payload documental inerte

El runtime actual construye el payload desde `meta.yaml`, `schema.json`, datos base del artifact y firmas resueltas. No usa un payload Mongo por version.

Por ello, este grupo debe simplificarse:

- retirar `payload_mongo_id`;
- retirar `payload_hash` si no se implementa calculo y validacion;
- retirar `payload_object_path` si no se persistira un payload por version;
- derivar `format` y `render_engine` desde el artifact o persistirlos realmente.

### Entrega y firmas

#### Conservar

Los campos de flujos, pasos, instancias, solicitudes y evidencias se usan para:

- resolver responsables;
- controlar el paso actual;
- permitir rechazo;
- registrar respuestas y observaciones;
- calcular quorum;
- enlazar anchors de firma;
- conservar evidencia y archivo firmado.

Esto incluye `can_reject`, `approval_mode`, `required_signers_min`, `required_signers_max`, `anchor_refs`, `response_note`, `responded_at` e `is_manual`.

#### Retirar o implementar

`signature_requests.notified_at` no participa en ningun servicio. Si se requiere trazabilidad de entrega de notificaciones, debe escribirse desde el servicio que publica correo, WhatsApp o notificacion interna. Si no, debe eliminarse.

### Contratacion

Las tablas de vacantes, postulaciones, ofertas y contratos estan casi vacias localmente y gran parte de su mantenimiento ocurre mediante CRUD generico. Eso no convierte sus campos en inutiles.

Los campos de fechas, estados, origen contractual, visibilidad, dedicacion y snapshots tienen significado de negocio. Deben conservarse hasta validar el flujo completo con Talento Humano.

Las columnas generadas:

- `vacancies.open_flag`;
- `aplications.selected_flag`;
- `offers.active_flag`;

implementan unicidad condicional y deben conservarse ocultas como detalle tecnico.

## MongoDB

### Colecciones activas y resultado

| Coleccion | Estado | Recomendacion |
| --- | --- | --- |
| `chatconversations` | Activa en rutas y servicios. | Conservar el nucleo y resolver campos dormidos. |
| `chatmessages` | Activa en rutas y servicios. | Conservar el nucleo y resolver campos dormidos. |
| `chatnotifications` | Activa en rutas y servicios. | Conservar; simplificar si solo existiran notificaciones de chat. |
| `dossiers` | Activa y visible para usuarios. | Conservar contenido; retirar referencia a `Usuario`. |
| `usuarios` | Compatibilidad heredada para dossier. | Migrar y eliminar. |
| `areas` | Ruta activa, pero duplica `units`. | Deprecar endpoint y eliminar coleccion. |
| `facultads` | Escritura admin activa, pero duplica `units`. | Migrar a `units` y eliminar. |
| `perfils` | Escritura admin activa, pero duplica roles/cargos. | Migrar a MariaDB y eliminar. |

Las ocho colecciones estan vacias en el entorno local. Esto facilita la limpieza local, pero no sustituye una verificacion en produccion.

### Chat

Campos con uso efectivo:

- identidad y participacion;
- `scope.stable_key`;
- referencias de proceso y definicion;
- ultimo mensaje;
- resumen movil;
- adjuntos, respuestas y lectura;
- referencias de notificacion y `read_at`.

Campos dormidos o constantes:

| Coleccion | Campo | Situacion |
| --- | --- | --- |
| `chatconversations` | `archived_at` | Se crea y devuelve, pero no existe accion para archivar. |
| `chatmessages` | `edited_at`, `deleted_at` | Se devuelven, pero no existen rutas de edicion o borrado. |
| `chatmessages` | `delivery_state` | Siempre se crea como `stored`; no hay otras transiciones. |
| `chatnotifications` | `channel` | Siempre vale `in_app`. |
| `chatnotifications` | `entity_type`, `entity_id` | Siempre representan la misma conversacion ya enlazada por `conversation_id`. |
| `chatconversations` | `process_id` y `scope.process_id` | Se escriben duplicados para threads de proceso. |

Para cada caso se debe implementar la capacidad anunciada o retirar el campo. En particular, debe quedar una sola referencia canonica al proceso.

### Dossier

La mayoria de campos de titulos, experiencia, referencias, formacion, certificaciones e investigacion alimentan formularios y vistas, por lo que no son relleno.

Campos a corregir:

- `usuario`: referencia heredada a la coleccion `usuarios`; eliminar tras migrar a identidad MariaDB.
- `libros.isnn`: nombre incorrecto y ambiguo. Migrar a `issn` si realmente se requiere para publicaciones seriadas o eliminarlo si `isbn` cubre el caso.
- `sera`: se repite en casi todos los subdocumentos y se muestra como estado, pero el usuario puede enviarlo en el payload y no existe un flujo backend de revision. Debe convertirse en un estado controlado por servidor, por ejemplo `validation_status`, o eliminarse si no habra revision institucional.

### Modelos Mongoose sin coleccion operativa

Existen definiciones antiguas sin importadores runtime o sin rutas montadas:

- usuarios: `roles`, `permisos`, `estudiantes`, `empleados`, `autoridades`, `certificate_model`;
- empresa: `tareas_model`, `programa_model`, `materias`;
- informes: `proceso_model`, `webtemplate_model`, `informe_model`, `templates`.

Los conceptos principales ya estan cubiertos por MariaDB, MinIO y los servicios documentales actuales. Estos archivos deben eliminarse despues de retirar el middleware/controlador legacy que aun importa `Template` o `Informe`.

## Campos tecnicos que no deben eliminarse

Los siguientes campos pueden parecer ruido en el CRUD, pero sostienen restricciones, snapshots o auditoria:

- claves primarias y foraneas;
- `created_at`, `updated_at`, `assigned_at`, `requested_at`, `responded_at`, `signed_at`;
- `current_flag`, `open_flag`, `selected_flag`, `active_flag`;
- `automatic_flag`, `manual_user_flag`;
- `normalized_term_type_id`, `active_series_flag`;
- hashes de artifacts que si se calculan, como `template_artifacts.content_hash`;
- rutas de almacenamiento que si se consumen;
- snapshots de responsable, artifact, unidad y version.

La mejora correcta para estos campos es ocultarlos en formularios normales y mostrarlos solo en trazabilidad, no eliminarlos.

## Matriz de decision por tabla MariaDB

### Conservar sin cambios estructurales inmediatos

`actions`, `aplications`, `cargos`, `cargo_role_map`, `contracts`, `contract_origins`, `contract_origin_recruitment`, `contract_origin_renewal`, `document_attachments`, `document_fill_flows`, `document_signatures`, `fill_flow_steps`, `fill_flow_templates`, `fill_requests`, `offers`, `permissions`, `person_certificates`, `position_assignments`, `processes`, `process_definition_series`, `process_definition_templates`, `process_definition_triggers`, `process_target_rules`, `resources`, `roles`, `role_permissions`, `signature_batch_jobs`, `signature_flow_instances`, `signature_flow_steps`, `signature_flow_templates`, `signature_request_statuses`, `signature_statuses`, `signature_types`, `task_items`, `template_seeds`, `terms`, `term_types`, `units`, `unit_relations`, `unit_types`, `vacancy_visibility`.

### Conservar con simplificacion de campos

- `persons`
- `relation_unit_types`
- `role_assignments`
- `process_definition_versions`
- `process_runs`
- `tasks`
- `task_assignments`
- `template_artifacts`
- `documents`
- `document_versions`
- `signature_requests`
- `unit_positions`
- `vacancies`

### Consolidar o retirar como unidad

- `users`
- `email_verification_codes`
- `password_reset_codes`
- `role_assignment_relation_types`, si se descarta herencia de roles
- `person_health`
- `person_bank_accounts`
- `person_emergency_contacts`

### Vista

`unit_org_levels` se usa para resolver agrupacion organizacional y debe conservarse.

## Plan de ejecucion recomendado

### Fase 0: verificacion de produccion

Antes de crear migraciones destructivas:

1. Medir registros y valores no nulos de cada candidato.
2. Buscar consumidores externos, reportes y consultas manuales.
3. Exportar respaldo de tablas o columnas con datos.
4. Definir una ventana de compatibilidad.

### Fase 1: limpieza de bajo riesgo

1. Eliminar `comments_thread_ref` de tareas y documentos.
2. Eliminar `signature_requests.notified_at` o implementar su escritura.
3. Eliminar `profile_ref` tras retirar su exposicion.
4. Resolver `task_assignments.status` y `unassigned_at`.
5. Limpiar los campos inertes de `document_versions`.

### Fase 2: consolidacion de identidad

1. Migrar codigos de correo y recuperacion a `persons`.
2. Corregir y montar las rutas correspondientes.
3. Retirar `users`.
4. Migrar `dossiers.usuario`.
5. Retirar la coleccion `usuarios`.

### Fase 3: consolidacion organizacional

1. Reemplazar `areas` y `facultads` por `units` y `unit_types`.
2. Reemplazar `perfils` por roles, cargos y posiciones.
3. Retirar endpoints y modelos Mongoose legacy.

### Fase 4: decisiones de producto

1. Decidir si se implementa herencia jerarquica de roles.
2. Decidir si existen corridas de reparacion/reinstanciacion.
3. Decidir si chat soportara archivado, edicion, borrado y multiples canales.
4. Decidir si `sera` representa un flujo institucional real.

## Criterios de aceptacion

- Existe una sola fuente de verdad para identidad: `persons`.
- Ninguna tabla de codigos referencia `users`.
- No quedan campos Mongo legacy en documentos, tareas, vacantes o posiciones.
- Las asignaciones de tareas usan un unico modelo de ciclo de vida.
- Cada campo de payload documental tiene escritor y lector, o ha sido retirado.
- Las colecciones organizacionales Mongo no duplican MariaDB.
- Los campos tecnicos necesarios no aparecen como editables para gestores.
- Las migraciones verifican datos existentes y tienen respaldo o rollback.

## Conclusion

La limpieza debe empezar por compatibilidad heredada y campos sin ciclo de vida, no por timestamps, claves o snapshots. Los candidatos mas claros son `users`, las referencias Mongo residuales, los campos de payload documental sin escritor, `notified_at` y el falso historial de `task_assignments`.

No se recomienda ejecutar eliminaciones masivas en una sola migracion. La secuencia correcta es dejar de escribir, migrar datos, dejar de leer, observar y finalmente retirar el campo o tabla.
