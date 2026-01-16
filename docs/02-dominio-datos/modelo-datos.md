# Dominio y datos - Modelo de datos (tecnico)

## Fuente de verdad

- backend/database/mariadb_schema.sql
- docs/02-dominio-datos/MER_LIMPIO.drawio
- docs/02-dominio-datos/er-resumen.md

## Relacional (MariaDB) - tablas principales

### Estructura academica

- unit_types(id, name, is_active, created_at)
- units(id, name, slug, unit_type_id, is_active, created_at)
- unit_relations(parent_unit_id, child_unit_id, relation_type, created_at)
- programs(id, name, slug, level_type, is_active, created_at)
- program_unit_history(id, program_id, unit_id, start_date, end_date, is_current)
- terms(id, name, start_date, end_date, is_active)

### Procesos y plantillas

- processes(id, name, slug, parent_id, person_id, unit_id, program_id, term_id, has_document, is_active, created_at)
  - CHECK: unit_id IS NOT NULL OR program_id IS NOT NULL
  - FK: parent_id -> processes.id
  - FK: person_id -> persons.id
  - FK: unit_id -> units.id
  - FK: program_id -> programs.id
  - FK: term_id -> terms.id

- templates(id, name, slug, description, version, created_at)
- process_templates(process_id, template_id)

### Personas, roles y cargos

- persons(id, cedula, first_name, last_name, email, whatsapp, is_active, created_at)
- roles(id, name, description, is_active)
- permissions(id, code, description)
- role_permissions(role_id, permission_id)
- role_assignments(id, person_id, role_id, unit_id, program_id, assigned_at)
- cargos(id, name, description, is_active)
- person_cargos(id, person_id, cargo_id, unit_id, program_id, start_date, end_date, is_current, current_flag)
  - UNIQUE(person_id, cargo_id, current_flag)

### Documentos y firmas

- documents(id, process_id, status, created_at, updated_at)
- document_versions(id, document_id, version, payload_mongo_id, payload_hash, latex_path, pdf_path, signed_pdf_path, status, created_at)
  - UNIQUE(document_id, version)
- document_signatures(id, document_version_id, signer_user_id, signature_role, signature_status, note_short, signed_file_path, signed_at, created_at)

### Docencia/contratos

- vacancies(id, unit_id, program_id, title, category, dedication, relation_type, status, created_at)
  - CHECK: solo uno de unit_id o program_id puede ser NULL (XOR)
- contracts(id, person_id, vacancy_id, relation_type, dedication, start_date, end_date, status, created_at)
- student_program_terms(id, person_id, program_id, term_id, status, created_at)
  - UNIQUE(person_id, program_id, term_id)

## NoSQL (MongoDB)

Modelos para chat/notificaciones (ver docs/01-arquitectura/chat-notificaciones.md):

- conversations: _id, type, title, participants[], process_id, created_at, updated_at, last_message_id
- messages: _id, conversation_id, sender_id, content, attachments[], created_at, read_by[]

## Archivos y storage

- Adjuntos y documentos en filesystem compartido.
- Variable esperada: SHARED_STORAGE_ROOT.

## Pendientes

- Revisar columna legacy template_version_id en process_templates (error conocido).
