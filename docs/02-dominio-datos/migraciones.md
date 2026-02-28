# Dominio y datos - Migraciones (tecnico)

## Fuente de verdad

- backend/database/mariadb_schema.sql
- backend/database/mariadb_initializer.js

## Procedimiento sugerido

1) Actualizar el schema SQL.
2) Ajustar el inicializador si se requiere compatibilidad con datos existentes.
3) Ejecutar migracion manual en entornos con datos reales.

## Riesgos conocidos

- Columna legacy template_version_id en process_templates (puede romper inserts/updates).
- Llaves foraneas requieren limpieza previa de datos.

## Recomendacion

- Versionar cambios de schema y documentar scripts de migracion.

## Migracion: templates (1:N con processes)

Motivo: `processes 1─∞ templates` requiere eliminar la unicidad por `process_id`.

SQL sugerido (MariaDB):

```sql
ALTER TABLE templates
  DROP INDEX uq_templates_process,
  ADD INDEX idx_templates_process_id (process_id);
```

## Migracion: procesos -> definiciones + reglas de alcance

Motivo: separar identidad estable (`processes`) de configuracion versionada (`process_definition_versions`), versionar por series (`variation_key`) y resolver destinatarios sin sobreasignacion mediante `process_target_rules`.

Pasos sugeridos:

1) Crear `process_definition_versions`.
2) Crear `process_target_rules`.
3) Migrar cada version vigente de `process_versions` a `process_definition_versions`.
4) Convertir cada relacion previa de `process_units` + `cargo_id` en una o mas filas de `process_target_rules`.
5) Actualizar `tasks.process_version_id` -> `tasks.process_definition_id`.
6) Actualizar `signature_flow_templates.process_version_id` -> `signature_flow_templates.process_definition_id`.
7) Registrar templates publicados en `template_artifacts` y vincularlos con `process_definition_template_bindings`.

Regla practica de migracion:

- Si antes un proceso apuntaba a una unidad exacta y un cargo exacto, migrar a:
  - `unit_scope_type = 'unit_exact'`
  - `unit_id = <unidad>`
  - `cargo_id = <cargo>`
  - `recipient_policy = 'all_matches'`

- Si el alcance era organizacional amplio, usar:
  - `unit_scope_type = 'unit_subtree'` o `unit_type`
  - y dejar el filtro fino en `cargo_id` o `position_id`.
