# Backend - API (tecnico)

## Base URL

- /easym/v1/
- Swagger: /easym/docs y /easym/docs.json

## Rutas principales (segun archivos de routes)

- /academia (backend/routes/academia_router.js)
- /admin (backend/routes/admin_router.js)
- /area (backend/routes/area_router.js)
- /dossier (backend/routes/dossier_router.js)
- /program (backend/routes/program_router.js)
- /sql-admin (backend/routes/sql_admin_router.js)
- /tarea (backend/routes/tarea_router.js)
- /tutorias (backend/routes/tutorias_router.js)
- /user (backend/routes/user_router.js)
- /webtemplate (backend/routes/webtemplate_router.js)
- /whatsapp (backend/routes/whatsapp_router.js)

## Jobs administrativos

- POST /admin/terms/:termId/generate-tasks
  - Genera tareas y asignaciones para un periodo a partir de procesos activos.
  - Resuelve responsables via process_cargos + person_cargos (filtra por unidad/programa si aplica).
  - Es idempotente: no duplica tareas existentes en el mismo periodo.
  - Se ejecuta automaticamente al crear un periodo desde /admin/sql/terms.

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
