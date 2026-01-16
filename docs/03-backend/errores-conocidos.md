# Backend - Errores conocidos

## MariaDB: template_version_id

- Error: Field 'template_version_id' doesn't have a default value
- Contexto: columna legacy en process_templates
- Estado: pendiente revisar estructura y ajustar DB
- Impacto: inserciones/updates pueden fallar si la columna no tiene valor

## Sugerencias

- Revisar backend/database/mariadb_schema.sql
- Verificar migraciones en backend/database/mariadb_initializer.js

