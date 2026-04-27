# Dominio y datos - Migraciones (tecnico)

## Fuente de verdad

- backend/database/mariadb_schema.sql
- backend/database/mariadb_initializer.js

## Procedimiento sugerido

1) Actualizar el schema SQL.
2) Ajustar el inicializador si se requiere compatibilidad con datos existentes.
3) Ejecutar migracion manual en entornos con datos reales.

## Riesgos conocidos

- Desalinear el codigo y el esquema real de MariaDB rompe paneles y consultas (`Unknown column ...`).
- Llaves foraneas requieren limpieza previa de datos.
- Cambios estructurales en `tasks`, `task_items`, `documents` y firmas exigen reset en entornos de prueba si no se migra dato por dato.

## Recomendacion

- Versionar cambios de schema y documentar scripts de migracion.
- Usar `node backend/scripts/drop_legacy_tables.mjs` solo cuando quieras eliminar tablas heredadas fuera del flujo normal de arranque/reset.

## Cambios recientes de schema (2026-03-17)

### Tabla `persons`: direccion de residencia ampliada

Se agregaron columnas para soportar el formulario de registro del frontend:

- `pais_residencia VARCHAR(80)`
- `provincia_residencia VARCHAR(120)`
- `ciudad_residencia VARCHAR(120)`
- `calle_primaria VARCHAR(180)`
- `calle_secundaria VARCHAR(180)`
- `codigo_postal VARCHAR(30)`

Implementacion:

- Definicion base en `CREATE TABLE persons`.
- Compatibilidad para bases existentes con:
  - `ALTER TABLE persons ADD COLUMN IF NOT EXISTS ...`

### Inicializador: migraciones condicionales por existencia de tablas

En `backend/database/mariadb_initializer.js` se ajusto el flujo para:

- verificar existencia de `templates` y `process_templates` antes de aplicar cambios,
- omitir solo ese bloque cuando no existan,
- continuar con el resto de la inicializacion y no cortar el arranque.

### CHECK en `processes`

La creacion de `chk_process_unit_program` ahora:

- primero verifica si el CHECK ya existe,
- valida si hay filas que violan la regla (`unit_id` y `program_id` nulos),
- si hay violaciones, omite crear el CHECK y lo reporta de forma explicita.

## Scripts operativos

- Migrar una base existente al nombre y estructura nuevos (procesos, definiciones, templates de proceso):
  - `node backend/scripts/migrate_process_templates.mjs`
- Consolidar `template_artifacts` a una fila por paquete y mover formatos a JSON:
  - `node backend/scripts/migrate_template_artifacts_to_json.mjs`
- Agregar `artifact_origin` y normalizar origenes:
  - `node backend/scripts/migrate_template_artifact_origin.mjs`
- Ampliar enum de `artifact_stage`:
  - `node backend/scripts/migrate_template_artifact_stage_enum.mjs`
- Migrar prefijos de templates en MinIO a `System/Users`:
  - `node backend/scripts/migrate_template_prefixes_to_system_users.mjs`
- Agregar FK `owner_person_id` a `template_artifacts`:
  - `node backend/scripts/migrate_template_artifact_owner_fk.mjs`
- Sincronizar modelo de seeds y drafts de paquetes de usuario:
  - `node backend/scripts/migrate_template_seed_drafts.mjs`
- Convertir series de definicion a catalogo global:
  - `node backend/scripts/migrate_process_definition_series.mjs`
- Enforzar una sola definicion activa por serie y normalizar conflictos existentes:
  - `node backend/scripts/enforce_process_definition_active_series.mjs`
- Enforzar que una definicion no pueda activarse sin disparadores/reglas y, si aplica, sin paquetes vinculados:
  - `node backend/scripts/enforce_process_definition_document_artifacts.mjs`
- Eliminar tablas heredadas ya fuera de uso:
  - `node backend/scripts/drop_legacy_tables.mjs`
- Resetear completamente el esquema MariaDB vigente:
  - `node backend/scripts/reset_mariadb.mjs`
- Aplicar la semilla PUCESA sobre un esquema limpio:
  - `node backend/scripts/seed_pucese.mjs`

## Migracion: procesos -> definiciones + reglas de alcance

Motivo: separar identidad estable (`processes`) de configuracion versionada (`process_definition_versions`), versionar por series (`variation_key`) y resolver destinatarios sin sobreasignacion mediante `process_target_rules`.

Pasos sugeridos:

1) Crear `process_definition_versions`.
2) Crear `process_target_rules`.
3) Crear `process_definition_triggers`.
4) Migrar cada version vigente de `process_versions` a `process_definition_versions`.
5) Convertir cada relacion previa de `process_units` + `cargo_id` en una o mas filas de `process_target_rules`.
6) Reconvertir `tasks` para que representen la instancia del proceso (`process_definition_id + term_id`) y agregar `task_items` para los entregables derivados de `process_definition_templates`.
7) Actualizar `documents.task_id` -> `documents.task_item_id`.
8) Actualizar `signature_flow_templates.process_version_id` -> `signature_flow_templates.process_definition_template_id`.
9) Registrar paquetes publicados en `template_artifacts` y vincularlos con `process_definition_templates`.
10) Cambiar la generacion automatica para crear una `task` por definicion y `task_items` solo para las plantillas con `creates_task = 1`.

Restriccion vigente sobre definiciones:

- las nuevas definiciones se crean en `draft`
- solo puede existir una definicion `active` por cada `process_id + variation_key`
- al activar una definicion nueva de una serie, la activa anterior de esa misma serie se retira automaticamente (`retired`)
- la definicion no puede pasar a `active` sin al menos una regla activa y al menos un disparador activo
- si `has_document = 1`, la definicion no puede pasar a `active` sin al menos un registro en `process_definition_templates`

Regla practica de migracion:

- Si antes un proceso apuntaba a una unidad exacta y un cargo exacto, migrar a:
  - `unit_scope_type = 'unit_exact'`
  - `unit_id = <unidad>`
  - `cargo_id = <cargo>`
  - `recipient_policy = 'all_matches'`

- Si el alcance era organizacional amplio, usar:
  - `unit_scope_type = 'unit_subtree'` o `unit_type`
  - y dejar el filtro fino en `cargo_id` o `position_id`.
