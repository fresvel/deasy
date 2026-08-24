# Referencia — retrato del esquema PostgreSQL

> **Esto se consulta, no se ejecuta.** Las tareas están en
> [`plan-datos-2026-08.md`](./plan-datos-2026-08.md).
>
> Medido el **2026-08-09** sobre `backend/database/postgres_schema.sql` (1 398 líneas). Las
> referencias `:N` son líneas de ese fichero salvo que se diga otra cosa.

---

## 1. Lo que hay

**67 tablas · 1 vista · 134 FKs · 122 índices · 26 triggers · 9 funciones · 0 `CREATE TYPE`.**

> **Remedido el 2026-08-23** tras la reordenación del modelo del entregable. Eran **68** tablas —el
> recuento anterior decía 67 y ya iba una corta—. Salieron **tres** (`documents`, `task_assignments`,
> `task_item_handovers`) y entraron **dos** (`task_item_tenures`, `document_version_uploads`).
> Los números de línea de las tablas de abajo **cambiaron todos** con esa edición; los que quedan son
> los medidos hoy.

No hay migraciones: `backend/database/postgres_initializer.js:25` aplica el fichero entero en cada
arranque. `docs/docs-md-antiguos/02-dominio-datos/MER_SQL.sql` es DDL MySQL heredado y **no lo
referencia ningún script ni código**.

**Mongo ya no existe.** Las dos colecciones que había se migraron a tablas con `data JSONB`: chat →
`services/chat/chatStore.js` sobre las 6 tablas `chat_*`, y dossier → `services/users/dossierStore.js`
sobre `dossiers` + `dossier_items`. Los binarios viven en MinIO, no en la base.

### Familias

| Familia | n | Tablas |
|---|---:|---|
| Identidad / auth | 4 | `persons`:37, `person_certificates`:74, `email_verification_codes`:1109, `password_reset_codes`:1120 |
| Organigrama | 7 | `unit_types`:14, `units`:22, `relation_unit_types`:91, `unit_relations`:115, `cargos`:131, `unit_positions`:143, `position_assignments`:165 |
| Reclutamiento | 8 | `vacancies`:183, `vacancy_visibility`:266, `aplications`:204 *(sic, una sola «p»)*, `offers`:223, `contracts`:239, `contract_origins`:379, `contract_origin_recruitment`:387, `contract_origin_renewal`:398 |
| RBAC | 8 | `roles`:258, `resources`:281, `actions`:293, `permissions`:305, `role_permissions`:324, `role_assignments`:334, `role_assignment_relation_types`:359, `cargo_role_map`:369 |
| Procesos (definición) | 7 | `processes`:409, `process_definition_series`:420, `process_definition_versions`:435, `process_target_rules`:456, `process_definition_templates`:540, `process_definition_period_types`:581, `process_runs`:607 |
| Calendario | 2 | `term_types`:553, `terms`:595 |
| Plantillas / entregables | 3 | `template_seeds`:480, `deliverables`:497, `template_artifacts`:519 |
| Ejecución de tareas | 3 | `tasks`:728, `task_items`:765, `task_item_tenures`:873 |
| Documentos | 4 | `document_versions`:966, `document_version_uploads`:1024, `document_attachments`, `document_workflow_observations` |
| Flujo de llenado | 4 | `fill_flow_templates`:825, `fill_flow_steps`:839, `document_fill_flows`:866, `fill_requests`:881 |
| Firmas | 8 | `signature_statuses`:782, `signature_request_statuses`:792, `signature_flow_templates`:919, `signature_flow_steps`:933, `signature_flow_instances`:969, `signature_requests`:982, `document_signatures`:1031, `signature_batch_jobs`:1090 |
| Chat / notificaciones | 6 | `chat_conversations`:1139, `chat_conversation_participants`:1161, `chat_messages`:1173, `chat_message_attachments`:1190, `chat_message_reads`:1202, `chat_notifications`:1210 |
| Dossier | 2 | `dossiers`:1234, `dossier_items`:1245 |

---

## 2. Clasificación por naturaleza

Asignación primaria única; suma 67. **Esta tabla es la que sostiene el rechazo de «una clase por
tabla»** ([plan §1](./plan-datos-2026-08.md#1--la-decisión-de-fondo-por-qué-no-una-clase-por-tabla)).

**(a) Catálogo puro — 12 (18 %).** `unit_types`, `relation_unit_types`, `cargos`, `roles`,
`resources`, `actions`, `term_types`, `template_seeds`, `signature_statuses`,
`signature_request_statuses`, `processes`, `terms`. Los diez primeros son literalmente
`id + code? + name + description? + is_active + created_at`.

**(b) Join / asociativa — 10 (15 %).** `unit_relations`, `role_permissions`, `cargo_role_map`,
`role_assignment_relation_types`, `vacancy_visibility`, `permissions`,
`process_definition_period_types`, `process_definition_templates`, `chat_conversation_participants`,
`chat_message_reads`. Cuatro son solo FKs sin ningún atributo.

**(c) Entidad con comportamiento — 24 (36 %).** `persons`, `person_certificates`, `units`,
`unit_positions`, `position_assignments`, `vacancies`, `aplications`, `offers`, `contracts`,
`role_assignments`, `process_runs`, `tasks`, `task_items`,
`document_versions`, `document_fill_flows`, `fill_requests`, `signature_flow_instances`,
`signature_requests`, `signature_batch_jobs`, `dossiers`, `chat_conversations`, `chat_messages`.

**(d) Log append-only — 9 (13 %).** `email_verification_codes`, `password_reset_codes`,
`document_version_uploads` (cada subida del archivo, con su autor),
`document_workflow_observations`, `document_signatures`, `document_attachments`, `chat_notifications`,
`chat_message_attachments`, `dossier_items`. **Ninguna tiene `updated_at`**, que es la señal.

**(e) Configuración / versionado — 9 (13 %).** `process_definition_series`,
`process_definition_versions`, `process_target_rules`, `deliverables`, `template_artifacts`,
`fill_flow_templates`, `fill_flow_steps`, `signature_flow_templates`, `signature_flow_steps`.

**(f) Subtipo — 3 (4 %).** `contract_origins`:379 con discriminador `origin_type` →
`contract_origin_recruitment`:387 y `contract_origin_renewal`:398, ambas con PK = FK al padre. Es el
único caso de herencia *table-per-subtype* del esquema.

### Lo que rompe el molde uniforme

- **PK compuesta: exactamente 1** — `chat_message_reads (message_id, person_id)`:1206. Todas las
  demás tablas-join llevan `id` sintético **más** un índice único sobre el par.
- **Sin `id` sintético: 5** — las tres de `contract_origin*`, `signature_batch_jobs` (PK `job_id
  CHAR(36)`, un UUID) y `chat_message_reads`.
- **11 columnas generadas** (`GENERATED ALWAYS AS ... STORED`), en dos idiomas heredados de MySQL:
  *flag nullable para unicidad parcial* (`unit_positions.head_flag`:152,
  `position_assignments.current_flag`:172, `vacancies.open_flag`:190, `aplications.selected_flag`:209,
  `offers.active_flag`:227, `role_assignments.current_flag`:345,
  `process_definition_versions.active_series_flag`:444) y *normalización de NULL*
  (`tasks.normalized_scope_unit_id`:634, y tres en `task_items`:669-671). En PostgreSQL lo idiomático
  sería `CREATE UNIQUE INDEX ... WHERE`, que el esquema **usa una sola vez**
  (`uq_chat_conversations_stable_key`:1157).
- **No hay `BOOLEAN`**: todo es `SMALLINT NOT NULL DEFAULT 1/0`.
- **6 columnas JSONB**: `unit_positions.profile`:148, `template_artifacts.available_formats`:525,
  `signature_flow_steps.anchor_refs`:952 y `.signers`:953, `signature_batch_jobs.results`:1099,
  `dossier_items.data`:1249. **Arrays: 0.**

---

## 3. Dominios de estado — el material de la fase D2

**Cero `CREATE TYPE`.** Los **33 dominios cerrados** son `TEXT ... CHECK (col IN (...))`. Los que
importan para el dominio:

| Línea | Columna | Valores |
|---|---|---|
| 53 | `persons.status` | Inactivo, Activo, Verificado, Reportado |
| 443 | `process_definition_versions.status` | draft, active, retired |
| 504 | `deliverables.template_scope` | official, ad_hoc |
| 523 | `template_artifacts.lifecycle_state` | draft, published, retired |
| 545 | `process_definition_templates.item_mode` | single, replicated, routed |
| 615 | `process_runs.status` | pending, active, completed, cancelled |
| 725 | `documents.origin_type` | task_item, standalone, imported, generated |
| 870 | `document_fill_flows.status` | pending, in_progress, approved, rejected, cancelled |
| 886 | `fill_requests.status` | los cinco anteriores + `returned` |
| 948 | `signature_flow_steps.approval_mode` | and, or, at_least |
| 1141 | `chat_conversations.type` | direct, group, thread, process_thread, unit |

**Dos duplicados literales y una asimetría**, todos entre los gemelos de llenado y firma:
`fill_flow_steps.resolver_type`:843 ≡ `signature_flow_steps.resolver_type`:940;
`fill_flow_steps.unit_scope_type`:845 ≡ `signature_flow_steps.unit_scope_type`:942; y
`fill_flow_steps.selection_mode`:851 **tiene `CHECK`** mientras su gemelo `:947` **no**.

**Ocho columnas de estado sin `CHECK`** — su dominio solo existe en JavaScript:

| Tabla:línea | Columna | Dónde vive el dominio |
|---|---|---|
| `tasks`:641 | `status` | `config/sqlTables.js:269` |
| `task_items`:677 | `status` | `sqlTables.js:313` — **y en otros cuatro sitios que no coinciden**, ver abajo |
| `documents`:727 | `status` | `services/documents/DocumentStateService.js:1-13` — 11 estados **+ matriz de transiciones** `:30-42` |
| `document_versions`:752 | `status` | `DocumentStateService.js:15-28` — 12 estados + transiciones `:44-57` |
| `signature_batch_jobs`:1094 | `status` | ningún catálogo |
| `chat_messages`:1182 | `delivery_state` | ningún catálogo |
| `signature_flow_steps`:947 | `selection_mode` | ningún `CHECK` (su gemelo sí) |

Tres tablas más llevan el estado por FK a catálogo: `signature_flow_instances.status_id`:973 y
`signature_requests.status_id`:987 → `signature_request_statuses`;
`document_signatures.signature_status_id`:1036 → `signature_statuses`. Duplicados como constantes JS
en `services/documents/DocumentWorkflowCatalog.js:1-23`.

### La incoherencia viva de `task_items.status`

Cinco sitios, tres vocabularios, **dos grupos que no comparten ni un literal**:

```
config/sqlTables.js:313                     pendiente · en_proceso · completada · cancelada
controllers/users/user_controler.panel.js:380,415,416          completada · cancelada
services/admin/org/taskAssignment.js:216,239,265,386
postgres_schema.sql:1307,1334,1341          completed · completado · cancelled · cancelado
                                            finalizado · entregado · rechazado
```

**Efecto observable:** el panel de usuario cuenta un entregable `completada` como cerrado; el motor de
relevos lo considera **abierto** y lo reasigna al cambiar la ocupación de un puesto.

---

## 4. Los agregados que la base ya dibuja

**La frontera no hay que inventarla: está en los `ON DELETE CASCADE`.** Hay 19 en el esquema, con
profundidad máxima de 2 aristas, y agrupan las tablas exactamente donde tiene sentido que una sola
transacción las escriba. Ésta es la propuesta de la fase D4 — **diez repositorios, no sesenta y siete
clases**:

| Repositorio | Raíz | Tablas del agregado |
|---|---|---|
| `PersonRepository` | `persons` | `persons`, `person_certificates`, `email_verification_codes`, `password_reset_codes` |
| `OrgRepository` | `units` | `units`, `unit_relations`, `unit_positions`, `position_assignments`, + vista `unit_org_levels` |
| `RbacRepository` | `roles` | `roles`, `permissions`, `role_permissions`, `role_assignments`, `cargo_role_map`, `role_assignment_relation_types` |
| `ProcessDefinitionRepository` | `processes` | `processes`, `process_definition_series`, `process_definition_versions`, `process_target_rules`, `process_definition_templates`, `process_definition_period_types` |
| `ProcessRunRepository` | `process_runs` | `process_runs` |
| `TaskRepository` | `tasks` | `tasks`, `task_items`, `task_item_tenures` |
| `DocumentRepository` | `documents` | `documents`, `document_versions`, `document_attachments`, `document_workflow_observations` |
| `SignatureRepository` | `signature_flow_instances` | `signature_flow_*`, `signature_requests`, `document_signatures`, `signature_batch_jobs` |
| `FillFlowRepository` | `document_fill_flows` | `fill_flow_templates`, `fill_flow_steps`, `document_fill_flows`, `fill_requests` |
| `TemplateRepository` | `deliverables` | `deliverables`, `template_artifacts`, `template_seeds` |

Fuera del reparto quedan: los **12 catálogos y 10 joins**, que ya sirve el motor de metadatos; y
`chat_*` + `dossier*`, que **ya tienen su repositorio de facto** (`chatStore.js`, `dossierStore.js`)
y no hay motivo para renombrarlos.

Las cuatro cascadas de 2 aristas, que confirman los cortes: `tasks`→`task_items`→flujos;
`processes`→`process_definition_versions`→reglas/plantillas/periodos;
`contracts`→`contract_origins`→subtipos; `chat_conversations`→`chat_messages`→adjuntos/lecturas.

---

## 5. El grafo de FKs

**137 FKs.** Los tres *hubs* concentran **47, el 34 %**:

| Tabla | FKs entrantes |
|---|---:|
| `persons` | **26** |
| `units` | 11 |
| `unit_positions` | 10 |
| `cargos`, `task_items` | 6 |
| `unit_types`, `process_definition_versions`, `document_versions` | 5 |

**Ciclos a nivel de tabla: ninguno.** Cinco autorreferencias (`processes.parent_id`:416,
`template_artifacts.parent_version_id`:532, `process_runs.source_run_id`:620,
`task_items.source_task_item_id`:683, `chat_messages.reply_to_message_id`:1185). Un ciclo potencial se
evitó a propósito: `chat_conversations.last_message_id` **se dejó sin FK** (comentario `:1137`).

**FKs lógicas sin constraint, por decisión explícita** (`:1134-1137` y `:1229-1232`): en `chat_*` y
`dossiers`, los `person_id` / `process_id` / `unit_id` no llevan constraint para no acoplar los
módulos ex-documentales al núcleo relacional. **El censo completo, clasificado, está en
[`censo-fks-ausentes.md`](./censo-fks-ausentes.md)** (`TD7-c`): son 18, y hicieron falta **cinco**
categorías, no tres — tres de ellas ni siquiera son referencias.

Los dos que sí eran descuido **ya están corregidos** (`TD7-d`, 2026-08-24): `signature_batch_jobs.user_id`
y `task_item_tenures.performed_by_person_id` eran `BIGINT` contra `persons.id INT`, así que la FK no
se podía declarar. Hoy son `INT` con su `REFERENCES persons(id)` —política por defecto, como las otras
18—, y el segundo perdió de paso el `user` del nombre: es un fósil de la tabla `users`, que ya no existe.

---

## 6. Comportamiento que ya vive en la base

**5 triggers de negocio** (además de los 18 de `set_updated_at`). Ésta es la razón 4 del rechazo a
«una clase por tabla»: poner esa lógica en JavaScript crearía una segunda fuente de verdad.

| Función | Línea | Qué hace |
|---|---:|---|
| `trg_pdv_before_update_fn` | 1264 | **Guarda de activación**: prohíbe pasar `process_definition_versions.status` a `active` sin ≥1 regla activa y ≥1 periodo activo (`RAISE EXCEPTION` en `:1274` y `:1281`) |
| `trg_position_assignments_after_insert_fn` | 1293 | Deriva `role_assignments` vía `cargo_role_map` y **reasigna `task_items.assigned_person_id`** |
| `trg_position_assignments_after_update_fn` | 1320 | Revoca los derivados y vacía/reasigna `task_items` |
| `trg_persons_after_update_fn` | 1354 | Al inactivar una persona, cierra sus ocupaciones y roles |
| `trg_units_after_update_fn` | 1377 | Al inactivar una unidad, revoca roles y cancela vacantes abiertas |

**Una vista:** `unit_org_levels`:1048-1086, CTE `RECURSIVE` sobre `unit_relations` filtrando
`relation_unit_types.code = 'org'`. Expone `org_level`, `root_unit_id`, `level2/3_unit_id` y
`group_unit_id`. La hace válida el índice `uq_unit_relations_child_type`:126, que fuerza ≤1 padre por
tipo de relación.

**Los dos huecos que había aquí están CERRADOS (2026-08-23):**

- ~~`documents` declara `updated_at` sin trigger que lo mantenga~~ — la tabla **se retiró entera**: era
  una cáscara 1:1 sobre `task_items` sin ni una columna propia.
- ~~Los triggers reasignan `task_items` sin dejar asiento~~ — con `task_item_tenures`, **el asiento ES
  la reasignación**: no hay dos cosas que puedan desincronizarse, porque abrir la tenencia es a la
  vez cambiar de responsable y dejar constancia. Y el vocabulario de causas ya no tiene valores
  inalcanzables: `position_deactivated`, que llevaba años sin un solo emisor, lo estrenó el trigger
  de desactivación de puestos.

**El hueco que SÍ sigue abierto**, y es de la misma familia: `signature_flow_steps.signers` es un
JSONB que **no valida nadie** y que manda sobre la columna que sí. Registrado como defecto **1.19**.

---

## 7. Índices que no son obvios

**121 índices** (85 normales + 36 únicos). Los que codifican reglas de negocio:

- **Unicidad parcial emulada con columna generada** (7): `uq_unit_head`:160 (un solo jefe por unidad),
  `uq_position_current`:178, `uq_one_open_vacancy_per_position`:199,
  `uq_one_selected_per_vacancy`:217, `uq_one_active_offer_per_application`:235,
  `uq_role_assignment_current`:354, `uq_process_definition_one_active_series`:452 (una sola versión
  `active` por proceso + variación).
- **Unicidad con NULL normalizado a 0**: `uq_tasks_definition_term_scope`:650 y
  `uq_task_items_defined_target`:690 (tres columnas generadas a la vez).
- **Relaciones 1:1 impuestas por índice**: `uq_task_item_tenure_current` (una tenencia VIGENTE por
  entregable — la invariante que sostiene el relevo),
  `uq_document_fill_flows_document`:877, `uq_signature_flow_instances_document`:979,
  `uq_dossiers_person`:1241.
- **Doble unicidad redundante** en `permissions`: `uq_permissions_resource_action`:317 y
  `uq_permissions_code`:318, cuando `code` es derivable de resource × action.

---

## 8. Cómo se accede hoy (resumen)

El detalle y las tareas están en el plan; aquí solo las cifras de referencia:

| Hecho | Cifra |
|---|---|
| Llamadas `.query()`/`.execute()` | **531** en 46 ficheros |
| Reparto por capa | services 37 · **controllers 5** · config 1 · utils 1 · scripts 2 |
| `getConnection()` / `beginTransaction` | **32** / **20**, en 11 ficheros |
| Tablas cubiertas por `sqlTables.js` | **44** de 67 (66 %) · remedido 2026-08-23 |
| Tablas con *hook* en `crud/tableHooks.js` | 23 |
| Dependencias de datos en `package.json` | **una:** `pg ^8.22.0` |
| ORM / query builder / validador de esquema / migrador | **ninguno** |
| `LIMIT ? OFFSET ?` en todo el backend productivo | **1** (`SqlAdminService.js:382`) |
| Complejidad cognitiva de `config/postgres.js` | **241 en 391 ncloc** = 0,62/línea, el más denso |
