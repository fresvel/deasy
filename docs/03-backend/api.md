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
  - Resuelve responsables via process_versions (cargo_id) + process_units + unit_positions + position_assignments (unidades asociadas al proceso).
  - Es idempotente: no duplica tareas existentes en el mismo periodo.
  - Se ejecuta automaticamente al crear un periodo desde /admin/sql/terms.

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
