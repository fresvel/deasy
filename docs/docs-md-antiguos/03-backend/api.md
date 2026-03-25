# Backend - API (tecnico)

## Base URL

- /easym/v1/
- Swagger: /easym/docs y /easym/docs.json

## Rutas principales (segun archivos de routes)

- /academia (backend/routes/academia_router.js)
- /admin (backend/routes/admin_router.js)
- /area (backend/routes/area_router.js)
- /dossier (backend/routes/dossier_router.js)
- /program (backend/routes/program_router.js) -> compat con unidades
- /units (backend/routes/unit_router.js)
- /admin/sql (backend/routes/sql_admin_router.js)
- /tarea (backend/routes/tarea_router.js)
- /tutorias (backend/routes/tutorias_router.js)
- /users (backend/routes/user_router.js)
- /vacancies (backend/routes/vacancy_router.js)
- /whatsapp (backend/routes/whatsapp_router.js)

## Jobs administrativos

- Catalogos SQL de admin:
  - `term_types`: tipos de periodo (Semestre/Trimestre/Intensivo)
  - `terms`: periodos (requiere `term_type_id`)

- POST /admin/terms/:termId/generate-tasks
  - Genera instancias de tareas, items y asignaciones para un periodo a partir de procesos activos.
  - Toma definiciones `active`.
  - Solo considera definiciones con `process_definition_triggers` activos de tipo `automatic_by_term_type` compatibles con el `term_type_id`.
  - Resuelve responsables via `process_target_rules` contra `units`, `unit_types`, `unit_positions` y `position_assignments`.
  - Crea una `task` por definicion y `task_items` por cada `process_definition_template` con `creates_task = 1`.
  - Los `documents` de negocio cuelgan de `task_items`.
  - Los `signature_flow_templates` cuelgan de `process_definition_templates`.
  - Es idempotente: no duplica tareas automaticas existentes en el mismo periodo.
  - No se ejecuta automaticamente al crear un periodo; el frontend puede sugerir lanzarlo despues del alta.

## Uso del modelo de procesos

- Crear `processes` desde `/admin/sql/processes`.
- Crear `process_definition_series` desde `/admin/sql/process_definition_series` y luego `process_definition_versions` desde `/admin/sql/process_definition_versions`.
  - Las nuevas definiciones se crean en `draft`.
  - No se pueden activar sin al menos una regla activa en `process_target_rules` y al menos un disparador activo en `process_definition_triggers`.
  - Si `has_document = 1`, tampoco se pueden activar sin al menos un artifact vinculado en `process_definition_templates`.
  - Si se crea una nueva version desde una definicion existente, el backend puede clonar automaticamente `process_definition_templates`, `process_target_rules` y `process_definition_triggers` desde la definicion origen.
- Registrar el alcance con `/admin/sql/process_target_rules`.
- Registrar la politica de disparo con `/admin/sql/process_definition_triggers`.
- Las tareas manuales creadas desde `/admin/sql/tasks` tambien validan disparadores:
  - `manual_only` para periodos normales.
  - `manual_custom_term` para periodos con tipo `Custom`.
- Sincronizar seeds publicados en MinIO con `POST /admin/sql/template_seeds/sync`.
- Consultar el preview PDF de un seed con `GET /admin/sql/template_seeds/:id/preview`.
- Registrar templates publicados en MinIO con `/admin/sql/template_artifacts`.
- Sincronizar automaticamente `template_artifacts` desde `tools/templates/dist` con `POST /admin/sql/template_artifacts/sync`.
- Durante esa sincronizacion, si `meta.yaml` incluye `seed_code`, el backend enlaza automaticamente `template_artifacts.template_seed_id`.
- Crear borradores de artifact con `POST /admin/sql/template_artifacts/draft`.
- Actualizar artifacts de usuario con `PUT /admin/sql/template_artifacts/draft/:id`.
  - El backend arma el paquete temporal en `backend/storage/minio-jobs/...`.
  - Luego lo sube directamente a MinIO dentro de la misma peticion.
  - Infiere `owner_ref` con la cedula y `owner_person_id` con el `persons.id` del usuario logueado.
  - Solo cuando la subida termina correctamente se inserta o actualiza el registro en `template_artifacts`.
  - Los artifacts creados por este flujo quedan con `artifact_origin=user`.
- Vincular templates a cada definicion con `/admin/sql/process_definition_templates`.
  - Estas vinculaciones solo se deben editar mientras la definicion este en `draft`.

Flujo recomendado:

1) Crear el proceso base.
2) Crear una serie controlada (`process_definition_series`) y luego una definicion con `series_id`, `definition_version` (formato `x.y.z`), vigencia y `execution_mode`.
3) Agregar una o varias reglas de alcance segun el publico objetivo.
4) Editar la fuente del template en `tools/templates/templates/`.
5) Ejecutar `node tools/templates/cli.mjs package`.
6) Ejecutar `node tools/templates/cli.mjs publish` para subir el paquete a MinIO.
7) Ejecutar `POST /admin/sql/template_artifacts/sync` o usar `Sincronizar dist` en el admin.
   - Este paso genera o actualiza `template_artifacts` desde el `dist` local.
   - Si el paquete publicado declara `seed_code` en `meta.yaml`, se resuelve tambien `template_seed_id`.
7.1) Para borradores creados desde el admin:
   - sincronizar `template_seeds`
   - crear el borrador con `POST /admin/sql/template_artifacts/draft`
   - el backend deja el paquete en `backend/storage/minio-jobs/...`
   - el backend lo sube directo a `deasy-templates/Users/<cedula>/...`
8) Vincular los templates requeridos a la definicion mediante `process_definition_templates`.
9) Crear el periodo y, si deseas instanciarlo de inmediato, ejecutar `POST /admin/terms/:termId/generate-tasks`.

Panel operativo de definiciones para usuario:

- `GET /users/:id/process-definitions/:definitionId/panel`
  - Devuelve el contexto operativo de la definicion activa para el usuario actual:
    - resumen
    - tareas del usuario
    - entregables
    - documentos
    - firmas
    - dependencias
    - paquetes del usuario
    - periodos disponibles
- `POST /users/:id/process-definitions/:definitionId/tasks`
  - Crea una tarea manual para esa definicion usando:
    - un periodo existente permitido por sus disparadores manuales
    - o un periodo `Custom` si la definicion tiene `manual_custom_term`

## Dossier - Investigacion (Mongo)

- GET /dossier/:cedula
  - Retorna el dossier completo del usuario.
- POST /dossier/:cedula/investigacion/:tipo
  - Agrega un registro en `investigacion`.
- PUT /dossier/:cedula/investigacion/:tipo/:itemId
  - Actualiza un registro de `investigacion` por `_id`.
- DELETE /dossier/:cedula/investigacion/:tipo/:itemId
  - Elimina un registro de `investigacion` por `_id`.

Tipos validos en `:tipo`:

- `articulos`
- `libros`
- `ponencias`
- `tesis`
- `proyectos`

## Controladores (referencia por modulo)

- Usuarios/Auth: backend/controllers/users/
- Admin: backend/controllers/admin/
- Tutorias: backend/controllers/tutorias/
- Academia: backend/controllers/academia/
- Empresa/Procesos: backend/controllers/empresa/
- WhatsApp: backend/controllers/whatsapp/

## Modelos (principales)

- Usuarios: backend/models/users/
- Empresa/Procesos: backend/models/empresa/
- Informes: backend/models/informes/

## Middleware relevante

- Auth/Token: backend/middlewares/val_token.js
- Validaciones: backend/middlewares/val_createuser.js, val_password.js
- Archivos: backend/middlewares/validate_file.js, uploadProfilePhoto.js

## Fuentes de verdad

- Swagger describe contratos, esquemas y ejemplos.
- SQL schema en backend/database/mariadb_schema.sql
