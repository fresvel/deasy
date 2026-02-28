# Dominio y datos - Modelo de datos (tecnico)

## Fuente de verdad

- backend/database/mariadb_schema.sql
- docs/02-dominio-datos/MER_LIMPIO.drawio
- docs/02-dominio-datos/er-resumen.md

## Relacional (MariaDB) - tablas principales

### Estructura y personas

- unit_types(id, name, is_active, created_at)
- units(id, name, label, slug, unit_type_id, is_active, created_at, updated_at)
- relation_unit_types(id, code, name, is_inheritance_allowed, is_active, created_at)
- unit_relations(id, relation_type_id, parent_unit_id, child_unit_id, created_at)
- unit_org_levels(view: unit_id, parent_unit_id, org_level, root_unit_id, level2_unit_id, level3_unit_id, group_unit_id)
- persons(id, cedula, first_name, last_name, email, whatsapp, direccion, pais, password_hash, status, verify_email, verify_whatsapp, photo_url, is_active, created_at, updated_at)
- cargos(id, name, description, is_active, created_at, updated_at)
- unit_positions(id, unit_id, cargo_id, slot_no, title, profile_ref, position_type, is_active, created_at, updated_at)
  - position_type: real | promocion | simbolico
- position_assignments(id, position_id, person_id, start_date, end_date, is_current, created_at, updated_at)
- roles(id, name, description, is_active)
- resources(id, code, name, description, is_active)
- actions(id, code, name, description, is_active)
- permissions(id, resource_id, action_id, code, description, is_active)
- role_permissions(id, role_id, permission_id)
- role_assignments(id, person_id, role_id, unit_id, source, derived_from_assignment_id, max_depth, start_date, end_date, is_current)
- role_assignment_relation_types(id, relation_type_id, role_assignment_id)
- cargo_role_map(id, role_id, cargo_id)

### Vacantes y contratos

- vacancies(id, position_id, title, category, dedication, relation_type, status, opened_at, closed_at, created_at, updated_at)
  - relation_type: dependencia | servicios | promocion
- vacancy_visibility(id, vacancy_id, unit_id, role_id, created_at)
- aplications(id, vacancy_id, person_id, status, applied_at, note, created_at, updated_at)
- offers(id, application_id, status, sent_at, responded_at, expires_at, created_at)
- contracts(id, person_id, position_id, relation_type, dedication, start_date, end_date, status, created_at, updated_at)
- contract_origins(contract_id, origin_type, created_at)
- contract_origin_recruitment(contract_id, offer_id, vacancy_id, created_at)
- contract_origin_renewal(contract_id, renewed_from_contract_id, created_at)

### Procesos, tareas y plantillas

- processes(id, name, slug, parent_id, is_active, created_at)
- process_definition_versions(id, process_id, variation_key, definition_version, name, description, has_document, execution_mode, status, effective_from, effective_to, created_at)
- process_target_rules(id, process_definition_id, unit_scope_type, unit_id, unit_type_id, include_descendants, cargo_id, position_id, recipient_policy, priority, is_active, effective_from, effective_to, created_at)
- term_types(id, code, name, description, is_active, created_at, updated_at)
- terms(id, name, term_type_id, start_date, end_date, is_active)
- tasks(id, process_definition_template_id, process_definition_id, term_id, parent_task_id, responsible_position_id, start_date, end_date, status, created_at)
- task_assignments(id, task_id, position_id, assigned_person_id, status, assigned_at, unassigned_at)
- template_artifacts(id, template_code, display_name, source_version, storage_version, bucket, base_object_prefix, available_formats, schema_object_key, meta_object_key, content_hash, is_active, created_at)
- process_definition_templates(id, process_definition_id, template_artifact_id, usage_role, creates_task, is_required, sort_order, created_at)
- documents(id, task_id, status, comments_thread_ref, created_at, updated_at)
- document_versions(id, document_id, version, payload_mongo_id, payload_hash, latex_path, pdf_path, signed_pdf_path, status, created_at)
- signature_types(id, code, name, description, is_active, created_at)
- signature_statuses(id, code, name, description, is_active, created_at)
- signature_request_statuses(id, code, name, description, is_active, created_at)
- signature_flow_templates(id, process_definition_id, name, description, is_active, created_at)
- signature_flow_steps(id, template_id, step_order, step_type_id, required_cargo_id, selection_mode, required_signers_min, required_signers_max, is_required, created_at)
- signature_flow_instances(id, template_id, document_version_id, status_id, created_at)
- signature_requests(id, instance_id, step_id, assigned_person_id, status_id, is_manual, requested_at, notified_at, responded_at)
- document_signatures(id, signature_request_id, document_version_id, signer_user_id, signature_type_id, signature_status_id, note_short, signed_file_path, signed_at, created_at)

## Uso del modelo de procesos

1) Crear `processes` para la identidad estable del proceso.
2) Crear una fila en `process_definition_versions` por cada definicion vigente o futura del proceso. Cada definicion pertenece a una `variation_key` (serie) y su `definition_version` usa formato semantico `major.minor.patch` (ej: `0.1.0`).
3) Definir el alcance con una o varias filas en `process_target_rules`:
   - `unit_exact`: una unidad puntual.
   - `unit_subtree`: una unidad y toda su jerarquia.
   - `unit_type`: todas las unidades de un tipo.
   - `all_units`: cualquier unidad activa.
   - Si solo cambia el alcance, reutilizar la misma definicion y ajustar/agregar reglas.
   - Si cambia la logica funcional (templates, modo, contenido), crear una nueva version o una nueva `variation_key`.
4) Publicar templates empaquetados en MinIO y registrarlos en `template_artifacts`.
5) Vincular los templates requeridos a la definicion mediante `process_definition_templates`.
6) Marcar `creates_task = 1` en cada plantilla de definicion que represente una plantilla ejecutable.
7) Al crear un periodo (`terms`), el backend toma la definicion activa mas reciente por proceso y `variation_key`, genera una tarea por cada plantilla de definicion ejecutable y asigna destinatarios con las reglas de alcance.
8) `parent_task_id` queda reservado para jerarquias manuales; el generador automatico no lo completa.

## NoSQL (MongoDB)

Modelos para chat/notificaciones (ver docs/01-arquitectura/chat-notificaciones.md):

- conversations: _id, type, title, participants[], process_id, created_at, updated_at, last_message_id
- messages: _id, conversation_id, sender_id, content, attachments[], created_at, read_by[]

## Archivos y storage

- Adjuntos y documentos en filesystem compartido.
- Variable esperada: SHARED_STORAGE_ROOT.

## Pendientes

- Revisar columna legacy template_version_id en process_templates (error conocido).
- Separación de document_signatures en otra tabla (sería firmas).
- Afinar la resolución de múltiples definiciones activas para un mismo proceso si negocio lo requiere.
- Validar cierre de tareas padre cuando finalizan tareas hijas.
- Verificar asignaciones por unidad y programa con datos reales (BD actualmente vacía).
