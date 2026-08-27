---
title: "Campos de la cadena proceso → documento"
description: "Las 39 tablas del recorrido, con todas sus columnas, tipos, referencias y valores admitidos. Generada del catálogo de PostgreSQL."
sidebar:
  order: 20
---

:::caution[Esta página está GENERADA — no la edites]

La produce `backend/scripts/docs/gen-campos-md.mjs` leyendo el **catálogo de PostgreSQL en ejecución**, no
el fichero de esquema ni esta documentación. Editarla a mano no sirve: la siguiente regeneración la
pisa. Si cambias el esquema, regenérala **en el mismo commit**:

```bash
bash scripts/docs/gen-campos.sh <letra>          # regenera
bash scripts/docs/gen-campos.sh <letra> --check  # falla si no coincide
```

⚠️ **Regenérala contra una base RECIÉN CREADA.** Desde `TD7-s` el esquema describe la forma y no
converge bases anteriores, así que una pila levantada desde hace tiempo puede tener una forma vieja
y esta página saldría mintiendo. `npm run test:char:run` la recrea.

:::

Son **39 tablas**. El recorrido narrado, con sus diagramas, está en
[Del proceso al documento firmado](/modelo/). Esta página es el
detalle: **cada columna de cada tabla**, en el orden de la cadena y no en orden alfabético.

Cómo leer las columnas: **Obligatorio** dice si la base exige un valor; **Apunta a** es la referencia
con lo que ocurre al borrar el destino; **Admite** son los únicos valores que la base acepta.

## La organizacion: quien existe y donde

### `unit_types`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `name` | varchar(120) | sí | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `units`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `name` | varchar(180) | sí | — | — |
| `label` | varchar(75) | no | — | — |
| `slug` | varchar(180) | sí | — | — |
| `unit_type_id` | int | sí | `unit_types.id` · impide borrar | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `relation_unit_types`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(40) | sí | — | — |
| `name` | varchar(40) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `is_inheritance_allowed` | smallint | sí | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `unit_relations`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `relation_type_id` | int | sí | `relation_unit_types.id` · impide borrar | — |
| `parent_unit_id` | int | sí | `units.id` · impide borrar | — |
| `child_unit_id` | int | sí | `units.id` · impide borrar | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `cargos`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(120) | sí | — | — |
| `name` | varchar(120) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `unit_positions`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `unit_id` | int | sí | `units.id` · impide borrar | — |
| `slot_no` | int | sí | — | — |
| `title` | varchar(180) | no | — | — |
| `profile` | jsonb | no | — | — |
| `position_type` | text | sí | — | `real` · `promocion` · `simbolico` |
| `is_active` | smallint | sí | — | — |
| `is_unit_head` | smallint | sí | — | — |
| `head_flag` | smallint | no | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |
| `cargo_id` | int | sí | `cargos.id` · impide borrar | — |

### `persons`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `cedula` | varchar(20) | no | — | — |
| `first_name` | varchar(120) | sí | — | — |
| `last_name` | varchar(120) | sí | — | — |
| `nacionalidad_pais_id` | int | no | `paises.id` · impide borrar | — |
| `password_hash` | varchar(255) | sí | — | — |
| `status` | text | no | — | `Inactivo` · `Activo` · `Verificado` · `Reportado` |
| `photo_url` | text | no | — | — |
| `is_active` | smallint | sí | — | — |
| `token` | varchar(10) | sí | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `position_assignments`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `position_id` | int | sí | `unit_positions.id` · impide borrar | — |
| `person_id` | int | sí | `persons.id` · impide borrar | — |
| `start_date` | date | sí | — | — |
| `end_date` | date | no | — | — |
| `is_current` | smallint | sí | — | — |
| `current_flag` | smallint | no | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

## La declaracion del proceso

### `processes`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `name` | varchar(180) | sí | — | — |
| `slug` | varchar(180) | sí | — | — |
| `parent_id` | int | no | `processes.id` · impide borrar | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `process_definition_series`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `source_type` | text | sí | — | `unit_type` · `cargo` · `default` |
| `unit_type_id` | int | no | `unit_types.id` · impide borrar | — |
| `cargo_id` | int | no | `cargos.id` · impide borrar | — |
| `code` | varchar(120) | sí | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `process_definition_versions`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_id` | int | sí | `processes.id` · se va con el | — |
| `series_id` | int | sí | `process_definition_series.id` · impide borrar | — |
| `variation_key` | varchar(120) | sí | — | — |
| `definition_version` | varchar(20) | sí | — | — |
| `name` | varchar(180) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `status` | text | sí | — | `draft` · `active` · `retired` |
| `active_series_flag` | smallint | no | — | — |
| `effective_from` | date | sí | — | — |
| `effective_to` | date | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `process_target_rules`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_id` | int | sí | `process_definition_versions.id` · se va con el | — |
| `unit_scope_type` | text | sí | — | `unit_exact` · `unit_subtree` · `unit_type` · `all_units` |
| `unit_id` | int | no | `units.id` · impide borrar | — |
| `unit_type_id` | int | no | `unit_types.id` · impide borrar | — |
| `cargo_id` | int | no | `cargos.id` · impide borrar | — |
| `position_id` | int | no | `unit_positions.id` · impide borrar | — |
| `recipient_policy` | text | sí | — | `all_matches` · `unit_head` · `exact_position` |
| `priority` | int | sí | — | — |
| `is_active` | smallint | sí | — | — |
| `effective_from` | date | no | — | — |
| `effective_to` | date | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `process_definition_period_types`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_id` | int | sí | `process_definition_versions.id` · se va con el | — |
| `term_type_id` | int | sí | `term_types.id` · impide borrar | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `term_types`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(40) | sí | — | — |
| `name` | varchar(80) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `terms`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `name` | varchar(60) | sí | — | — |
| `term_type_id` | int | sí | `term_types.id` · impide borrar | — |
| `start_date` | date | sí | — | — |
| `end_date` | date | sí | — | — |
| `is_active` | smallint | sí | — | — |

## Que se produce: entregables y plantillas

### `deliverables`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(180) | sí | — | — |
| `display_name` | varchar(180) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `owner_process_id` | int | no | `processes.id` · impide borrar | — |
| `owner_variation_key` | varchar(120) | no | — | — |
| `template_scope` | text | sí | — | `official` · `ad_hoc` |
| `template_seed_id` | int | no | `template_seeds.id` · impide borrar | — |
| `owner_person_id` | int | no | `persons.id` · impide borrar | — |
| `created_at` | timestamp | sí | — | — |

### `template_artifacts`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `deliverable_id` | int | sí | `deliverables.id` · impide borrar | — |
| `storage_version` | varchar(20) | sí | — | — |
| `lifecycle_state` | text | sí | — | `draft` · `published` · `retired` |
| `base_object_prefix` | varchar(255) | sí | — | — |
| `available_formats` | jsonb | sí | — | — |
| `schema_object_key` | varchar(255) | sí | — | — |
| `content_hash` | varchar(64) | no | — | — |
| `parent_version_id` | int | no | `template_artifacts.id` · impide borrar | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `template_artifact_fields`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `template_artifact_id` | int | sí | `template_artifacts.id` · se va con el | — |
| `field_order` | int | sí | — | — |
| `data_key` | varchar(180) | sí | — | — |
| `field_code` | varchar(255) | sí | — | — |
| `title` | varchar(180) | sí | — | — |
| `ui_component` | text | sí | — | `text` · `richtext` · `textarea` · `number` · `switch` · `date` · `date_expression` · `select` · `hidden` |
| `ui_group` | varchar(180) | sí | — | — |
| `is_required` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `template_seeds`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `seed_code` | varchar(180) | sí | — | — |
| `display_name` | varchar(180) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `seed_type` | varchar(40) | sí | — | — |
| `source_path` | varchar(255) | sí | — | — |
| `preview_path` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `process_definition_templates`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_id` | int | sí | `process_definition_versions.id` · se va con el | — |
| `template_artifact_id` | int | sí | `template_artifacts.id` · impide borrar | — |
| `sort_order` | int | sí | — | — |
| `item_mode` | text | sí | — | `single` · `replicated` · `routed` |
| `created_at` | timestamp | sí | — | — |

## El disparo y el trabajo real

### `process_runs`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_id` | int | sí | `process_definition_versions.id` · impide borrar | — |
| `term_id` | int | no | `terms.id` · impide borrar | — |
| `run_mode` | text | sí | — | `automatic` · `manual` |
| `source_run_id` | int | no | `process_runs.id` · impide borrar | — |
| `created_by_user_id` | int | no | `persons.id` · impide borrar | — |
| `reason` | varchar(255) | no | — | — |
| `status` | text | sí | — | `pending` · `active` · `completed` · `cancelled` |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `tasks`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_id` | int | sí | `process_definition_versions.id` · impide borrar | — |
| `process_run_id` | int | no | `process_runs.id` · impide borrar | — |
| `term_id` | int | sí | `terms.id` · impide borrar | — |
| `scope_unit_id` | int | sí | `units.id` · impide borrar | — |
| `normalized_scope_unit_id` | int | no | — | — |
| `description` | text | no | — | — |
| `start_date` | date | sí | — | — |
| `end_date` | date | no | — | — |
| `status` | varchar(30) | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `task_items`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `task_id` | int | sí | `tasks.id` · se va con el | — |
| `process_definition_template_id` | int | no | `process_definition_templates.id` · impide borrar | — |
| `template_artifact_id` | int | sí | `template_artifacts.id` · impide borrar | — |
| `origin_kind` | text | sí | — | `process_defined` · `user_added` |
| `title` | varchar(180) | no | — | — |
| `sort_order` | int | sí | — | — |
| `created_by_person_id` | int | no | `persons.id` · impide borrar | — |
| `source_task_item_id` | int | no | `task_items.id` · impide borrar | — |
| `target_unit_id` | int | no | `units.id` · impide borrar | — |
| `process_definition_template_key` | int | no | — | — |
| `responsible_position_id` | int | sí | `unit_positions.id` · impide borrar | — |
| `responsible_position_key` | int | no | — | — |
| `assigned_person_id` | int | no | `persons.id` · impide borrar | — |
| `document_status` | varchar(30) | sí | — | — |
| `origin_unit_id` | int | no | `units.id` · impide borrar | — |
| `start_date` | date | sí | — | — |
| `end_date` | date | no | — | — |
| `user_started_at` | timestamp | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `task_item_tenures`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `task_item_id` | int | sí | `task_items.id` · se va con el | — |
| `person_id` | int | no | `persons.id` · impide borrar | — |
| `position_id` | int | no | `unit_positions.id` · impide borrar | — |
| `started_at` | timestamp | sí | — | — |
| `ended_at` | timestamp | no | — | — |
| `opened_by` | text | sí | — | `original` · `occupancy_start` · `occupancy_end` · `position_deactivated` · `reconcile` · `manual` |
| `work_started` | smallint | sí | — | — |
| `reason` | varchar(255) | no | — | — |
| `performed_by_person_id` | int | no | `persons.id` · impide borrar | — |
| `current_flag` | smallint | no | — | — |
| `created_at` | timestamp | sí | — | — |

## El documento producido

### `document_versions`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `task_item_id` | int | sí | `task_items.id` · se va con el | — |
| `version` | int | sí | — | — |
| `version_minor` | int | sí | — | — |
| `version_label` | text | no | — | — |
| `template_artifact_id` | int | no | `template_artifacts.id` · impide borrar | — |
| `payload_hash` | varchar(64) | no | — | — |
| `payload_object_path` | varchar(255) | no | — | — |
| `working_file_path` | varchar(255) | no | — | — |
| `final_file_path` | varchar(255) | no | — | — |
| `format` | varchar(40) | no | — | — |
| `render_engine` | varchar(80) | no | — | — |
| `status` | varchar(30) | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `document_version_uploads`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `document_version_id` | int | sí | `document_versions.id` · se va con el | — |
| `minor` | int | sí | — | — |
| `file_path` | varchar(255) | sí | — | — |
| `file_name` | varchar(255) | no | — | — |
| `mime_type` | varchar(120) | no | — | — |
| `size_bytes` | bigint | no | — | — |
| `uploaded_by_person_id` | int | no | `persons.id` · impide borrar | — |
| `note` | varchar(255) | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `document_attachments`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `document_version_id` | int | sí | `document_versions.id` · se va con el | — |
| `kind` | text | sí | — | `annex` · `evidence` · `source` · `other` |
| `file_path` | varchar(255) | sí | — | — |
| `file_name` | varchar(255) | sí | — | — |
| `mime_type` | varchar(120) | no | — | — |
| `size_bytes` | bigint | no | — | — |
| `description` | varchar(255) | no | — | — |
| `uploaded_by_person_id` | int | no | `persons.id` · impide borrar | — |
| `sort_order` | int | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `document_workflow_observations`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `task_item_id` | int | sí | `task_items.id` · impide borrar | — |
| `document_version_id` | int | sí | `document_versions.id` · impide borrar | — |
| `fill_request_id` | int | no | `fill_requests.id` · impide borrar | — |
| `signature_request_id` | int | no | `signature_requests.id` · impide borrar | — |
| `phase` | text | sí | — | `review` · `signature` |
| `kind` | text | sí | — | `observation` · `return_reason` · `rejection_reason` · `internal_note` |
| `message` | text | sí | — | — |
| `author_person_id` | int | sí | `persons.id` · impide borrar | — |
| `resolved_by_person_id` | int | no | `persons.id` · impide borrar | — |
| `resolved_at` | timestamp | no | — | — |
| `created_at` | timestamp | sí | — | — |

## El flujo de entrega

### `fill_flow_templates`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_template_id` | int | no | `process_definition_templates.id` · impide borrar | — |
| `task_item_id` | int | no | `task_items.id` · se va con el | — |
| `template_artifact_id` | int | no | `template_artifacts.id` · impide borrar | — |
| `name` | varchar(180) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `fill_flow_steps`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `fill_flow_template_id` | int | sí | `fill_flow_templates.id` · impide borrar | — |
| `step_order` | int | sí | — | — |
| `code` | varchar(120) | no | — | — |
| `name` | varchar(180) | no | — | — |
| `resolver_type` | text | sí | — | `task_assignee` · `specific_person` · `cargo_in_scope` |
| `assigned_person_id` | int | no | `persons.id` · impide borrar | — |
| `unit_scope_type` | text | sí | — | `unit_exact` · `unit_subtree` · `unit_type` · `all_units` · `context_exact` |
| `unit_id` | int | no | `units.id` · impide borrar | — |
| `unit_type_id` | int | no | `unit_types.id` · impide borrar | — |
| `relation_type_id` | int | no | `relation_unit_types.id` · impide borrar | — |
| `cargo_id` | int | no | `cargos.id` · impide borrar | — |
| `position_id` | int | no | `unit_positions.id` · impide borrar | — |
| `selection_mode` | text | sí | — | `auto_one` · `auto_all` · `manual` |
| `is_required` | smallint | sí | — | — |
| `can_reject` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `document_fill_flows`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `fill_flow_template_id` | int | sí | `fill_flow_templates.id` · impide borrar | — |
| `document_version_id` | int | sí | `document_versions.id` · impide borrar | — |
| `status` | text | sí | — | `pending` · `in_progress` · `approved` · `rejected` · `cancelled` |
| `current_step_order` | int | no | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `fill_requests`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `document_fill_flow_id` | int | sí | `document_fill_flows.id` · impide borrar | — |
| `fill_flow_step_id` | int | sí | `fill_flow_steps.id` · impide borrar | — |
| `assigned_person_id` | int | no | `persons.id` · impide borrar | — |
| `status` | text | sí | — | `pending` · `in_progress` · `approved` · `rejected` · `returned` · `cancelled` |
| `is_manual` | smallint | sí | — | — |
| `requested_at` | timestamp | sí | — | — |
| `responded_at` | timestamp | no | — | — |
| `response_note` | varchar(255) | no | — | — |

## El flujo de firma

### `signature_flow_templates`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_template_id` | int | no | `process_definition_templates.id` · impide borrar | — |
| `task_item_id` | int | no | `task_items.id` · se va con el | — |
| `template_artifact_id` | int | no | `template_artifacts.id` · impide borrar | — |
| `name` | varchar(180) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `signature_flow_steps`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `template_id` | int | sí | `signature_flow_templates.id` · impide borrar | — |
| `step_order` | int | sí | — | — |
| `code` | varchar(120) | no | — | — |
| `name` | varchar(180) | no | — | — |
| `slot` | varchar(80) | no | — | — |
| `resolver_type` | text | sí | — | `task_assignee` · `specific_person` · `cargo_in_scope` |
| `assigned_person_id` | int | no | `persons.id` · impide borrar | — |
| `unit_scope_type` | text | sí | — | `unit_exact` · `unit_subtree` · `unit_type` · `all_units` · `context_exact` |
| `unit_id` | int | no | `units.id` · impide borrar | — |
| `unit_type_id` | int | no | `unit_types.id` · impide borrar | — |
| `position_id` | int | no | `unit_positions.id` · impide borrar | — |
| `required_cargo_id` | int | no | `cargos.id` · impide borrar | — |
| `selection_mode` | varchar(20) | sí | — | — |
| `approval_mode` | text | sí | — | `and` · `or` · `at_least` |
| `required_signers_min` | int | no | — | — |
| `required_signers_max` | int | no | — | — |
| `is_required` | smallint | sí | — | — |
| `anchor_refs` | jsonb | no | — | — |
| `signers` | jsonb | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `signature_flow_instances`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `template_id` | int | sí | `signature_flow_templates.id` · impide borrar | — |
| `document_version_id` | int | sí | `document_versions.id` · impide borrar | — |
| `status_id` | int | sí | `signature_request_statuses.id` · impide borrar | — |
| `created_at` | timestamp | sí | — | — |

### `signature_requests`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `instance_id` | int | sí | `signature_flow_instances.id` · impide borrar | — |
| `step_id` | int | sí | `signature_flow_steps.id` · impide borrar | — |
| `assigned_person_id` | int | no | `persons.id` · impide borrar | — |
| `status_id` | int | sí | `signature_request_statuses.id` · impide borrar | — |
| `is_manual` | smallint | sí | — | — |
| `requested_at` | timestamp | sí | — | — |
| `notified_at` | timestamp | no | — | — |
| `responded_at` | timestamp | no | — | — |

### `document_signatures`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `signature_request_id` | int | no | `signature_requests.id` · impide borrar | — |
| `document_version_id` | int | sí | `document_versions.id` · impide borrar | — |
| `signer_user_id` | int | sí | `persons.id` · impide borrar | — |
| `signature_status_id` | int | sí | `signature_statuses.id` · impide borrar | — |
| `note_short` | varchar(255) | no | — | — |
| `signed_file_path` | varchar(255) | no | — | — |
| `signed_at` | timestamp | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `signature_request_statuses`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(40) | sí | — | — |
| `name` | varchar(80) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `signature_statuses`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(40) | sí | — | — |
| `name` | varchar(80) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

---

**39 tablas · 374 columnas · 98 referencias.** Leídas del catálogo de PostgreSQL.
