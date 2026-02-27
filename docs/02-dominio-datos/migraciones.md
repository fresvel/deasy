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

## Migracion: processes <-> units (N:M via process_units)

Motivo: un proceso puede pertenecer a varias unidades y una unidad puede participar en varios procesos.

SQL sugerido (MariaDB):

```sql
CREATE TABLE process_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_id INT NOT NULL,
  unit_id INT NOT NULL,
  scope ENUM('owner','collaborator') NOT NULL DEFAULT 'owner',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  effective_from DATE NULL,
  effective_to DATE NULL,
  primary_active_flag TINYINT(1)
    AS (IF(is_primary = 1 AND is_active = 1, 1, NULL)) PERSISTENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_process_units_process_unit (process_id, unit_id),
  UNIQUE KEY uq_process_units_single_primary (process_id, primary_active_flag),
  INDEX idx_process_units_process_active (process_id, is_active),
  INDEX idx_process_units_unit_active (unit_id, is_active),
  CONSTRAINT fk_process_units_process FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
  CONSTRAINT fk_process_units_unit FOREIGN KEY (unit_id) REFERENCES units(id)
);

INSERT INTO process_units
  (process_id, unit_id, scope, is_primary, is_active, effective_from, effective_to)
SELECT id, unit_id, 'owner', 1, 1, CURDATE(), NULL
FROM processes
WHERE unit_id IS NOT NULL;

ALTER TABLE processes
  DROP FOREIGN KEY fk_processes_unit,
  DROP COLUMN unit_id;
```
