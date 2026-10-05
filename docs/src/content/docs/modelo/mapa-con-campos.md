---
title: "El mapa completo, con todos sus campos"
description: "Las 38 tablas de la cadena proceso → documento, agrupadas como en el mapa, con todas sus columnas y claves ajenas. Se genera desde el esquema."
sidebar:
  label: "Mapa con campos"
  order: 15.5
---

:::note[Esta página se genera: no se edita a mano]
La escribe `scripts/docs/gen-mapa-campos.mjs` cada vez que corre `bash scripts/docs/gen-dbml.sh`,
a partir del esquema, y la puerta de CI falla si se separa de él. Una edición a mano se pierde en
la siguiente regeneración.

**La agrupación sale de [el mapa completo](/modelo/mapa-completo/)**: si una tabla cambia de subgrupo allí,
cambia aquí. **Los campos y las relaciones salen del esquema, sin elegir**: están todos.
:::

**38 tablas · 367 columnas · 99 claves ajenas · 10 diagramas.**

## Cómo leerla

- Cada **caja con campos** es una tabla del grupo, con **todas** sus columnas: tipo, nombre y, si
  lo es, `PK` (clave primaria), `FK` (clave ajena) o `UK` (única).
- **Cada clave ajena se dibuja una sola vez: en el diagrama de la tabla que la guarda.** Si apunta a
  una tabla de otro diagrama, esa tabla sale como **caja vacía**; sus campos están en el suyo.
- Las claves que **llegan** desde otros diagramas se listan debajo de cada uno, en un desplegable.
  Dibujarlas también hacía ilegible cualquier grupo con una tabla a la que apunta medio esquema,
  como `persons`.
- En cada línea, `||` quiere decir que la clave ajena es obligatoria y `|o` que admite nulos; `o{`
  son varias filas y `o|` como mucho una. La etiqueta es la columna que guarda la clave.
- Un subgrupo grande va en varios diagramas seguidos, y algunos se leen de izquierda a derecha:
  se decidió midiendo la letra de cada uno, para que ninguno baje de 12 px a ancho de columna.
- Para acercar, **Ctrl + rueda** sobre el diagrama, o su botón de pantalla completa.

## La organización

**7 tablas** · 63 columnas · 12 claves ajenas propias. Apunta a `cantones`, `estados_civiles`, `paises`, `relation_unit_types`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  unit_types {
    int id PK
    varchar name
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  units {
    int id PK
    varchar name
    varchar label
    varchar slug
    int unit_type_id FK
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  unit_positions {
    int id PK
    int unit_id FK
    int slot_no
    varchar title
    jsonb profile
    text position_type
    smallint is_active
    smallint is_unit_head
    smallint head_flag
    timestamp created_at
    timestamp updated_at
    int cargo_id FK
  }
  cargos {
    int id PK
    varchar code UK
    varchar name UK
    varchar description
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  position_assignments {
    int id PK
    int position_id FK
    int person_id FK
    date start_date
    date end_date
    smallint is_current
    smallint current_flag
    timestamp created_at
    timestamp updated_at
  }
  persons {
    int id PK
    varchar first_name
    varchar last_name
    int nacionalidad_pais_id FK
    date fecha_nacimiento
    int nacimiento_pais_id FK
    int nacimiento_canton_id FK
    text sexo
    int estado_civil_id FK
    varchar password_hash
    text status
    text photo_url
    smallint is_active
    varchar token UK
    timestamp created_at
    timestamp updated_at
  }
  unit_relations {
    int id PK
    int relation_type_id FK
    int parent_unit_id FK
    int child_unit_id FK
    timestamp created_at
    timestamp updated_at
  }
  estados_civiles |o--o{ persons : "estado_civil_id"
  cantones |o--o{ persons : "nacimiento_canton_id"
  paises |o--o{ persons : "nacimiento_pais_id"
  paises |o--o{ persons : "nacionalidad_pais_id"
  persons ||--o{ position_assignments : "person_id"
  unit_positions ||--o{ position_assignments : "position_id"
  cargos ||--o{ unit_positions : "cargo_id"
  units ||--o{ unit_positions : "unit_id"
  units ||--o{ unit_relations : "child_unit_id"
  units ||--o{ unit_relations : "parent_unit_id"
  relation_unit_types ||--o{ unit_relations : "relation_type_id"
  unit_types ||--o{ units : "unit_type_id"
```

<details>
<summary>Llegan 58 claves ajenas desde otros diagramas</summary>

`aplications.person_id` → `persons` · `persona_autoidentificacion.person_id` → `persons` · `cargo_role_map.cargo_id` → `cargos` · `chat_conversations.created_by` → `persons` · `chat_conversations.scope_unit_id` → `units` · `chat_messages.sender_person_id` → `persons` · `chat_notifications.recipient_person_id` → `persons` · `chat_conversation_participants.person_id` → `persons` · `chat_message_reads.person_id` → `persons` · `contracts.person_id` → `persons` · `contracts.position_id` → `unit_positions` · `deliverables.owner_person_id` → `persons` · `direcciones.person_id` → `persons` · `document_attachments.uploaded_by_person_id` → `persons` · `document_signatures.signer_user_id` → `persons` · `document_version_uploads.uploaded_by_person_id` → `persons` · `document_workflow_observations.author_person_id` → `persons` · `document_workflow_observations.resolved_by_person_id` → `persons` · `documentos_identidad.person_id` → `persons` · `dossiers.person_id` → `persons` · `emails.person_id` → `persons` · `fill_flow_steps.cargo_id` → `cargos` · `fill_flow_steps.assigned_person_id` → `persons` · `fill_flow_steps.position_id` → `unit_positions` · `fill_flow_steps.unit_type_id` → `unit_types` · `fill_flow_steps.unit_id` → `units` · `fill_requests.assigned_person_id` → `persons` · `password_reset_codes.person_id` → `persons` · `person_certificates.person_id` → `persons` · `process_definition_series.cargo_id` → `cargos` · `process_definition_series.unit_type_id` → `unit_types` · `process_runs.created_by_user_id` → `persons` · `process_target_rules.cargo_id` → `cargos` · `process_target_rules.position_id` → `unit_positions` · `process_target_rules.unit_type_id` → `unit_types` · `process_target_rules.unit_id` → `units` · `role_assignments.person_id` → `persons` · `role_assignments.derived_from_assignment_id` → `position_assignments` · `role_assignments.unit_id` → `units` · `signature_flow_steps.required_cargo_id` → `cargos` · `signature_flow_steps.assigned_person_id` → `persons` · `signature_flow_steps.position_id` → `unit_positions` · `signature_flow_steps.unit_type_id` → `unit_types` · `signature_flow_steps.unit_id` → `units` · `signature_requests.assigned_person_id` → `persons` · `task_item_tenures.person_id` → `persons` · `task_item_tenures.position_id` → `unit_positions` · `task_items.assigned_person_id` → `persons` · `task_items.created_by_person_id` → `persons` · `task_items.origin_unit_id` → `units` · `task_items.responsible_position_id` → `unit_positions` · `task_items.target_unit_id` → `units` · `tasks.scope_unit_id` → `units` · `telefonos.person_id` → `persons` · `vacancies.position_id` → `unit_positions` · `vacancy_visibility.unit_id` → `units` · `signature_batch_jobs.user_id` → `persons` · `task_item_tenures.performed_by_person_id` → `persons`

</details>

## Lo que se declara (1 de 2)

**6 tablas** · 50 columnas · 12 claves ajenas propias. Apunta a `cargos`, `unit_positions`, `unit_types`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  processes {
    int id PK
    varchar name
    varchar slug UK
    int parent_id FK
    smallint is_active
    timestamp created_at
  }
  process_definition_versions {
    int id PK
    int process_id FK
    int series_id FK
    varchar variation_key
    varchar definition_version
    varchar name
    varchar description
    text status
    smallint active_series_flag
    date effective_from
    date effective_to
    timestamp created_at
  }
  process_definition_series {
    int id PK
    text source_type
    int unit_type_id FK
    int cargo_id FK
    varchar code UK
    smallint is_active
    timestamp created_at
  }
  process_target_rules {
    int id PK
    int process_definition_id FK
    text unit_scope_type
    int unit_id FK
    int unit_type_id FK
    int cargo_id FK
    int position_id FK
    text recipient_policy
    int priority
    smallint is_active
    date effective_from
    date effective_to
    timestamp created_at
  }
  process_definition_period_types {
    int id PK
    int process_definition_id FK
    int term_type_id FK
    smallint is_active
    timestamp created_at
  }
  term_types {
    int id PK
    varchar code UK
    varchar name UK
    varchar description
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  process_definition_versions ||--o{ process_definition_period_types : "process_definition_id"
  term_types ||--o{ process_definition_period_types : "term_type_id"
  cargos |o--o{ process_definition_series : "cargo_id"
  unit_types |o--o{ process_definition_series : "unit_type_id"
  processes ||--o{ process_definition_versions : "process_id"
  process_definition_series ||--o{ process_definition_versions : "series_id"
  cargos |o--o{ process_target_rules : "cargo_id"
  process_definition_versions ||--o{ process_target_rules : "process_definition_id"
  unit_positions |o--o{ process_target_rules : "position_id"
  unit_types |o--o{ process_target_rules : "unit_type_id"
  units |o--o{ process_target_rules : "unit_id"
  processes |o--o{ processes : "parent_id"
```

<details>
<summary>Llegan 8 claves ajenas desde otros diagramas</summary>

`chat_conversations.process_id` → `processes` · `chat_conversations.scope_current_definition_id` → `process_definition_versions` · `chat_conversations.scope_origin_definition_id` → `process_definition_versions` · `chat_conversations.scope_process_id` → `processes` · `process_definition_templates.process_definition_id` → `process_definition_versions` · `process_runs.process_definition_id` → `process_definition_versions` · `tasks.process_definition_id` → `process_definition_versions` · `terms.term_type_id` → `term_types`

</details>

## Lo que se declara (2 de 2)

**5 tablas** · 44 columnas · 7 claves ajenas propias. Apunta a `persons`, `process_definition_versions`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  template_seeds {
    int id PK
    varchar seed_code UK
    varchar display_name
    varchar description
    varchar seed_type
    varchar source_path
    varchar preview_path
    smallint is_active
    timestamp created_at
  }
  deliverables {
    int id PK
    varchar code UK
    varchar display_name
    varchar description
    text template_scope
    int template_seed_id FK
    int owner_person_id FK
    timestamp created_at
  }
  template_artifacts {
    int id PK
    int deliverable_id FK
    varchar storage_version
    text lifecycle_state
    varchar base_object_prefix
    jsonb available_formats
    varchar schema_object_key
    varchar content_hash
    int parent_version_id FK
    smallint is_active
    timestamp created_at
  }
  template_artifact_fields {
    int id PK
    int template_artifact_id FK
    int field_order
    varchar data_key
    varchar field_code
    varchar title
    text ui_component
    varchar ui_group
    smallint is_required
    timestamp created_at
  }
  process_definition_templates {
    int id PK
    int process_definition_id FK
    int template_artifact_id FK
    int sort_order
    text item_mode
    timestamp created_at
  }
  persons |o--o{ deliverables : "owner_person_id"
  template_seeds |o--o{ deliverables : "template_seed_id"
  template_artifacts ||--o{ process_definition_templates : "template_artifact_id"
  process_definition_versions ||--o{ process_definition_templates : "process_definition_id"
  template_artifacts ||--o{ template_artifact_fields : "template_artifact_id"
  deliverables ||--o{ template_artifacts : "deliverable_id"
  template_artifacts |o--o{ template_artifacts : "parent_version_id"
```

<details>
<summary>Llegan 6 claves ajenas desde otros diagramas</summary>

`document_versions.template_artifact_id` → `template_artifacts` · `fill_flow_templates.template_artifact_id` → `template_artifacts` · `fill_flow_templates.process_definition_template_id` → `process_definition_templates` · `signature_flow_templates.template_artifact_id` → `template_artifacts` · `signature_flow_templates.process_definition_template_id` → `process_definition_templates` · `task_items.process_definition_template_id` → `process_definition_templates`

</details>

## Lo que ocurre (1 de 3)

**3 tablas** · 27 columnas · 9 claves ajenas propias. Apunta a `persons`, `process_definition_versions`, `term_types`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  process_runs {
    int id PK
    int process_definition_id FK
    int term_id FK
    text run_mode
    int source_run_id FK
    int created_by_user_id FK
    varchar reason
    text status
    timestamp created_at
    timestamp updated_at
  }
  terms {
    int id PK
    varchar name UK
    int term_type_id FK
    date start_date
    date end_date
    smallint is_active
  }
  tasks {
    int id PK
    int process_definition_id FK
    int process_run_id FK
    int term_id FK
    int scope_unit_id FK
    int normalized_scope_unit_id
    text description
    date start_date
    date end_date
    varchar status
    timestamp created_at
  }
  persons |o--o{ process_runs : "created_by_user_id"
  process_definition_versions ||--o{ process_runs : "process_definition_id"
  process_runs |o--o{ process_runs : "source_run_id"
  terms |o--o{ process_runs : "term_id"
  process_definition_versions ||--o{ tasks : "process_definition_id"
  process_runs |o--o{ tasks : "process_run_id"
  units ||--o{ tasks : "scope_unit_id"
  terms ||--o{ tasks : "term_id"
  term_types ||--o{ terms : "term_type_id"
```

<details>
<summary>Llega 1 clave ajena desde otros diagramas</summary>

`task_items.task_id` → `tasks`

</details>

## Lo que ocurre (2 de 3)

**3 tablas** · 45 columnas · 14 claves ajenas propias. Apunta a `persons`, `process_definition_templates`, `tasks`, `template_artifacts`, `unit_positions`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  task_items {
    int id PK
    int task_id FK
    int process_definition_template_id FK
    text origin_kind
    varchar title
    int sort_order
    int created_by_person_id FK
    int source_task_item_id FK
    int target_unit_id FK
    int process_definition_template_key
    int responsible_position_id FK
    int responsible_position_key
    int assigned_person_id FK
    varchar document_status
    int origin_unit_id FK
    date start_date
    date end_date
    timestamp user_started_at
    timestamp created_at
  }
  task_item_tenures {
    int id PK
    int task_item_id FK
    int person_id FK
    int position_id FK
    timestamp started_at
    timestamp ended_at
    text opened_by
    smallint work_started
    varchar reason
    int performed_by_person_id FK
    smallint current_flag
    timestamp created_at
  }
  document_versions {
    int id PK
    int task_item_id FK
    int version
    int version_minor
    text version_label
    int template_artifact_id FK
    varchar payload_hash
    varchar payload_object_path
    varchar working_file_path
    varchar final_file_path
    varchar format
    varchar render_engine
    varchar status
    timestamp created_at
  }
  template_artifacts |o--o{ document_versions : "template_artifact_id"
  task_items ||--o{ document_versions : "task_item_id"
  task_items ||--o{ task_item_tenures : "task_item_id"
  persons |o--o{ task_item_tenures : "person_id"
  unit_positions |o--o{ task_item_tenures : "position_id"
  persons |o--o{ task_items : "assigned_person_id"
  persons |o--o{ task_items : "created_by_person_id"
  units |o--o{ task_items : "origin_unit_id"
  process_definition_templates ||--o{ task_items : "process_definition_template_id"
  unit_positions ||--o{ task_items : "responsible_position_id"
  task_items |o--o{ task_items : "source_task_item_id"
  units |o--o{ task_items : "target_unit_id"
  tasks ||--o{ task_items : "task_id"
  persons |o--o{ task_item_tenures : "performed_by_person_id"
```

<details>
<summary>Llegan 9 claves ajenas desde otros diagramas</summary>

`document_attachments.document_version_id` → `document_versions` · `document_fill_flows.document_version_id` → `document_versions` · `document_signatures.document_version_id` → `document_versions` · `document_version_uploads.document_version_id` → `document_versions` · `document_workflow_observations.task_item_id` → `task_items` · `document_workflow_observations.document_version_id` → `document_versions` · `fill_flow_templates.task_item_id` → `task_items` · `signature_flow_instances.document_version_id` → `document_versions` · `signature_flow_templates.task_item_id` → `task_items`

</details>

## Lo que ocurre (3 de 3)

**2 tablas** · 21 columnas · 4 claves ajenas propias. Apunta a `document_versions`, `persons`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  document_version_uploads {
    int id PK
    int document_version_id FK
    int minor
    varchar file_path
    varchar file_name
    varchar mime_type
    bigint size_bytes
    int uploaded_by_person_id FK
    varchar note
    timestamp created_at
  }
  document_attachments {
    int id PK
    int document_version_id FK
    text kind
    varchar file_path
    varchar file_name
    varchar mime_type
    bigint size_bytes
    varchar description
    int uploaded_by_person_id FK
    int sort_order
    timestamp created_at
  }
  persons |o--o{ document_attachments : "uploaded_by_person_id"
  document_versions ||--o{ document_attachments : "document_version_id"
  persons |o--o{ document_version_uploads : "uploaded_by_person_id"
  document_versions ||--o{ document_version_uploads : "document_version_id"
```

## Flujo de entrega

**4 tablas** · 41 columnas · 15 claves ajenas propias. Apunta a `cargos`, `document_versions`, `persons`, `process_definition_templates`, `relation_unit_types`, `task_items`, `template_artifacts`, `unit_positions`, `unit_types`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  fill_flow_templates {
    int id PK
    int process_definition_template_id FK
    int task_item_id FK
    int template_artifact_id FK
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
  }
  fill_flow_steps {
    int id PK
    int fill_flow_template_id FK
    int step_order
    varchar code
    varchar name
    text resolver_type
    int assigned_person_id FK
    text unit_scope_type
    int unit_id FK
    int unit_type_id FK
    int relation_type_id FK
    int cargo_id FK
    int position_id FK
    text selection_mode
    smallint is_required
    smallint can_reject
    timestamp created_at
  }
  document_fill_flows {
    int id PK
    int fill_flow_template_id FK
    int document_version_id FK, UK
    text status
    int current_step_order
    timestamp created_at
    timestamp updated_at
  }
  fill_requests {
    int id PK
    int document_fill_flow_id FK
    int fill_flow_step_id FK
    int assigned_person_id FK
    text status
    smallint is_manual
    timestamp requested_at
    timestamp responded_at
    varchar response_note
  }
  document_versions ||--o| document_fill_flows : "document_version_id"
  fill_flow_templates ||--o{ document_fill_flows : "fill_flow_template_id"
  cargos |o--o{ fill_flow_steps : "cargo_id"
  persons |o--o{ fill_flow_steps : "assigned_person_id"
  unit_positions |o--o{ fill_flow_steps : "position_id"
  relation_unit_types |o--o{ fill_flow_steps : "relation_type_id"
  fill_flow_templates ||--o{ fill_flow_steps : "fill_flow_template_id"
  unit_types |o--o{ fill_flow_steps : "unit_type_id"
  units |o--o{ fill_flow_steps : "unit_id"
  template_artifacts |o--o{ fill_flow_templates : "template_artifact_id"
  process_definition_templates |o--o{ fill_flow_templates : "process_definition_template_id"
  task_items |o--o{ fill_flow_templates : "task_item_id"
  document_fill_flows ||--o{ fill_requests : "document_fill_flow_id"
  persons |o--o{ fill_requests : "assigned_person_id"
  fill_flow_steps ||--o{ fill_requests : "fill_flow_step_id"
```

<details>
<summary>Llega 1 clave ajena desde otros diagramas</summary>

`document_workflow_observations.fill_request_id` → `fill_requests`

</details>

## Flujo de firma (1 de 2)

**4 tablas** · 43 columnas · 16 claves ajenas propias. Apunta a `cargos`, `document_versions`, `persons`, `process_definition_templates`, `signature_request_statuses`, `task_items`, `template_artifacts`, `unit_positions`, `unit_types`, `units`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  signature_flow_templates {
    int id PK
    int process_definition_template_id FK
    int task_item_id FK
    int template_artifact_id FK
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
  }
  signature_flow_steps {
    int id PK
    int template_id FK
    int step_order
    varchar code
    varchar name
    varchar slot
    text resolver_type
    int assigned_person_id FK
    text unit_scope_type
    int unit_id FK
    int unit_type_id FK
    int position_id FK
    int required_cargo_id FK
    varchar selection_mode
    text approval_mode
    int required_signers_min
    int required_signers_max
    smallint is_required
    jsonb anchor_refs
    jsonb signers
    timestamp created_at
  }
  signature_flow_instances {
    int id PK
    int template_id FK
    int document_version_id FK, UK
    int status_id FK
    timestamp created_at
  }
  signature_requests {
    int id PK
    int instance_id FK
    int step_id FK
    int assigned_person_id FK
    int status_id FK
    smallint is_manual
    timestamp requested_at
    timestamp notified_at
    timestamp responded_at
  }
  document_versions ||--o| signature_flow_instances : "document_version_id"
  signature_request_statuses ||--o{ signature_flow_instances : "status_id"
  signature_flow_templates ||--o{ signature_flow_instances : "template_id"
  cargos |o--o{ signature_flow_steps : "required_cargo_id"
  persons |o--o{ signature_flow_steps : "assigned_person_id"
  unit_positions |o--o{ signature_flow_steps : "position_id"
  signature_flow_templates ||--o{ signature_flow_steps : "template_id"
  unit_types |o--o{ signature_flow_steps : "unit_type_id"
  units |o--o{ signature_flow_steps : "unit_id"
  template_artifacts |o--o{ signature_flow_templates : "template_artifact_id"
  process_definition_templates |o--o{ signature_flow_templates : "process_definition_template_id"
  task_items |o--o{ signature_flow_templates : "task_item_id"
  signature_flow_instances ||--o{ signature_requests : "instance_id"
  persons |o--o{ signature_requests : "assigned_person_id"
  signature_request_statuses ||--o{ signature_requests : "status_id"
  signature_flow_steps ||--o{ signature_requests : "step_id"
```

<details>
<summary>Llegan 2 claves ajenas desde otros diagramas</summary>

`document_signatures.signature_request_id` → `signature_requests` · `document_workflow_observations.signature_request_id` → `signature_requests`

</details>

## Flujo de firma (2 de 2)

**3 tablas** · 21 columnas · 4 claves ajenas propias. Apunta a `document_versions`, `persons`, `signature_requests`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  document_signatures {
    int id PK
    int signature_request_id FK
    int document_version_id FK
    int signer_user_id FK
    int signature_status_id FK
    varchar note_short
    varchar signed_file_path
    timestamp signed_at
    timestamp created_at
  }
  signature_request_statuses {
    int id PK
    varchar code UK
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
  }
  signature_statuses {
    int id PK
    varchar code UK
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
  }
  document_versions ||--o{ document_signatures : "document_version_id"
  signature_requests |o--o{ document_signatures : "signature_request_id"
  persons ||--o{ document_signatures : "signer_user_id"
  signature_statuses ||--o{ document_signatures : "signature_status_id"
```

<details>
<summary>Llegan 2 claves ajenas desde otros diagramas</summary>

`signature_flow_instances.status_id` → `signature_request_statuses` · `signature_requests.status_id` → `signature_request_statuses`

</details>

## Fuera de los subgrupos

**1 tabla** · 12 columnas · 6 claves ajenas propias. Apunta a `document_versions`, `fill_requests`, `persons`, `signature_requests`, `task_items`, que salen como caja vacía.

```mermaid
erDiagram
  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano
  document_workflow_observations {
    int id PK
    int task_item_id FK
    int document_version_id FK
    int fill_request_id FK
    int signature_request_id FK
    text phase
    text kind
    text message
    int author_person_id FK
    int resolved_by_person_id FK
    timestamp resolved_at
    timestamp created_at
  }
  persons ||--o{ document_workflow_observations : "author_person_id"
  fill_requests |o--o{ document_workflow_observations : "fill_request_id"
  task_items ||--o{ document_workflow_observations : "task_item_id"
  persons |o--o{ document_workflow_observations : "resolved_by_person_id"
  signature_requests |o--o{ document_workflow_observations : "signature_request_id"
  document_versions ||--o{ document_workflow_observations : "document_version_id"
```
