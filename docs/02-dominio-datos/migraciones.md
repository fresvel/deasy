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
