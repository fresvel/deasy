---
title: "Campos de la cadena proceso → documento"
description: "Las 33 tablas del recorrido, con todas sus columnas, tipos, referencias y valores admitidos. Generada del catálogo de PostgreSQL."
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

Son **33 tablas**. El recorrido narrado, con sus diagramas, está en
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
| `first_name` | varchar(120) | sí | — | — |
| `last_name` | varchar(120) | sí | — | — |
| `nacionalidad_pais_id` | int | no | `paises.id` · impide borrar | — |
| `fecha_nacimiento` | date | no | — | — |
| `nacimiento_pais_id` | int | no | `paises.id` · impide borrar | — |
| `nacimiento_canton_id` | int | no | `cantones.id` · impide borrar | — |
| `sexo` | text | no | — | `hombre` · `mujer` |
| `estado_civil_id` | int | no | `estados_civiles.id` · impide borrar | — |
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

### `catalogo_documental`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(180) | sí | — | — |
| `display_name` | varchar(180) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `template_scope` | text | sí | — | `official` · `ad_hoc` |
| `owner_person_id` | int | no | `persons.id` · impide borrar | — |
| `created_at` | timestamp | sí | — | — |

### `ediciones`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `catalogo_documental_id` | int | sí | `catalogo_documental.id` · impide borrar | — |
| `storage_version` | varchar(20) | sí | — | — |
| `lifecycle_state` | text | sí | — | `draft` · `published` · `retired` |
| `base_object_prefix` | varchar(255) | sí | — | — |
| `available_formats` | jsonb | sí | — | — |
| `generador_id` | int | no | `generadores_de_documento.id` · impide borrar | — |
| `content_hash` | varchar(64) | no | — | — |
| `parent_version_id` | int | no | `ediciones.id` · impide borrar | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `generadores_de_documento`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `code` | varchar(180) | sí | — | — |
| `nombre` | varchar(180) | sí | — | — |
| `description` | varchar(255) | no | — | — |
| `tipo` | text | sí | — | `latex` · `servicio` |
| `destino` | varchar(255) | no | — | — |
| `source_path` | varchar(255) | no | — | — |
| `preview_path` | varchar(255) | no | — | — |
| `is_active` | smallint | sí | — | — |
| `created_at` | timestamp | sí | — | — |

### `vinculos`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `process_definition_id` | int | sí | `process_definition_versions.id` · se va con el | — |
| `edicion_id` | int | sí | `ediciones.id` · impide borrar | — |
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
| `vinculo_id` | int | sí | `vinculos.id` · impide borrar | — |
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
| `edicion_id` | int | no | `ediciones.id` · impide borrar | — |
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
| `turno_id` | int | no | `turnos.id` · impide borrar | — |
| `phase` | text | sí | — | `review` · `signature` |
| `kind` | text | sí | — | `observation` · `return_reason` · `rejection_reason` · `internal_note` |
| `message` | text | sí | — | — |
| `author_person_id` | int | sí | `persons.id` · impide borrar | — |
| `resolved_by_person_id` | int | no | `persons.id` · impide borrar | — |
| `resolved_at` | timestamp | no | — | — |
| `created_at` | timestamp | sí | — | — |

## El recorrido del documento: quien hace cada paso

### `pasos_declarados`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `accion` | text | sí | — | `entrega` · `firma` |
| `edicion_id` | int | no | `ediciones.id` · impide borrar | — |
| `task_item_id` | int | no | `task_items.id` · se va con el | — |
| `orden` | int | sí | — | — |
| `code` | varchar(120) | no | — | — |
| `nombre` | varchar(180) | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `participantes_declarados`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `paso_id` | int | sí | `pasos_declarados.id` · se va con el | — |
| `orden` | int | sí | — | — |
| `resolver_type` | text | sí | — | `task_assignee` · `specific_person` · `cargo_in_scope` |
| `persona_id` | int | no | `persons.id` · impide borrar | — |
| `cargo_id` | int | no | `cargos.id` · impide borrar | — |
| `unit_scope_type` | text | sí | — | `unit_exact` · `context_exact` · `all_units` |
| `unit_id` | int | no | `units.id` · impide borrar | — |
| `slot` | varchar(80) | no | — | — |
| `created_at` | timestamp | sí | — | — |

### `recorridos`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `document_version_id` | int | sí | `document_versions.id` · impide borrar | — |
| `accion` | text | sí | — | `entrega` · `firma` |
| `estado` | text | sí | — | `pendiente` · `en_progreso` · `completado` · `rechazado` · `cancelado` |
| `paso_actual` | int | no | — | — |
| `created_at` | timestamp | sí | — | — |
| `updated_at` | timestamp | sí | — | — |

### `turnos`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `recorrido_id` | int | sí | `recorridos.id` · se va con el | — |
| `accion` | text | sí | `recorridos.accion` · se va con el | `entrega` · `firma` |
| `participante_id` | int | sí | `participantes_declarados.id` · impide borrar | — |
| `persona_id` | int | no | `persons.id` · impide borrar | — |
| `estado` | text | sí | — | `devuelto` · `entrega` |
| `manual` | smallint | sí | — | — |
| `solicitado` | timestamp | sí | — | — |
| `notificado` | timestamp | no | — | — |
| `respondido` | timestamp | no | — | — |
| `nota_respuesta` | varchar(255) | no | — | — |

## La firma en si

### `document_signatures`

| Columna | Tipo | Obligatorio | Apunta a | Admite |
|---|---|---|---|---|
| `id` | int | sí | — | — |
| `turno_id` | int | no | `turnos.id` · impide borrar | — |
| `document_version_id` | int | sí | `document_versions.id` · impide borrar | — |
| `signer_user_id` | int | sí | `persons.id` · impide borrar | — |
| `signature_status_id` | int | sí | `signature_statuses.id` · impide borrar | — |
| `note_short` | varchar(255) | no | — | — |
| `signed_file_path` | varchar(255) | no | — | — |
| `signed_at` | timestamp | no | — | — |
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

**33 tablas · 310 columnas · 77 referencias.** Leídas del catálogo de PostgreSQL.
