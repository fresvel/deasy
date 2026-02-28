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
- /webtemplate (backend/routes/webtemplate_router.js)
- /whatsapp (backend/routes/whatsapp_router.js)

## Jobs administrativos

- Catalogos SQL de admin:
  - `term_types`: tipos de periodo (Semestre/Trimestre/Intensivo)
  - `terms`: periodos (requiere `term_type_id`)

- POST /admin/terms/:termId/generate-tasks
  - Genera tareas y asignaciones para un periodo a partir de procesos activos.
  - Toma la definicion activa mas reciente (`process_definition_versions`) por proceso y `variation_key`.
  - Resuelve responsables via `process_target_rules` contra `units`, `unit_types`, `unit_positions` y `position_assignments`.
  - Es idempotente: no duplica tareas existentes en el mismo periodo.
  - Se ejecuta automaticamente al crear un periodo desde /admin/sql/terms.

## Uso del modelo de procesos

- Crear `processes` desde `/admin/sql/processes`.
- Crear `process_definition_versions` desde `/admin/sql/process_definition_versions`.
- Registrar el alcance con `/admin/sql/process_target_rules`.
- Registrar templates publicados en MinIO con `/admin/sql/template_artifacts`.
- Sincronizar automaticamente `template_artifacts` desde `tools/templates/dist` con `POST /admin/sql/template_artifacts/sync`.
- Vincular templates a cada definicion con `/admin/sql/process_definition_templates`.

Flujo recomendado:

1) Crear el proceso base.
2) Crear una definicion con `variation_key`, `definition_version` (formato `x.y.z`), vigencia y `execution_mode`.
3) Agregar una o varias reglas de alcance segun el publico objetivo.
4) Editar la fuente del template en `tools/templates/templates/`.
5) Ejecutar `node tools/templates/cli.mjs package`.
6) Ejecutar `node tools/templates/cli.mjs publish` para subir el paquete a MinIO.
7) Ejecutar `POST /admin/sql/template_artifacts/sync` o usar `Sincronizar dist` en el admin.
   - Este paso genera o actualiza `template_artifacts` desde el `dist` local.
8) Vincular los templates requeridos a la definicion mediante `process_definition_templates`.
9) Crear el periodo o ejecutar `POST /admin/terms/:termId/generate-tasks`.

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
- Informes/WebTemplate: backend/controllers/informes/
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
