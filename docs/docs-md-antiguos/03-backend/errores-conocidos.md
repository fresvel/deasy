# Backend - Errores conocidos

## Esquema MariaDB desalineado con el codigo

- Error tipico: `Unknown column 'launch_mode' in 'SELECT'`
- Contexto: el codigo backend ya fue actualizado, pero la base sigue con un esquema anterior.
- Estado: esperado si se cambiaron tablas como `tasks`, `task_items`, `documents` o `signature_flow_templates` y no se recreo el esquema.
- Impacto: listados, CRUDs y paneles del dashboard pueden fallar aunque el frontend este correcto.

## Causa habitual

- Se actualizo el codigo del proyecto sin ejecutar `reset + seed`.
- O se actualizo el esquema, pero el contenedor `backend` no se recreo despues del cambio.

## Sugerencias

1. Rehacer el esquema vigente:
   - `node scripts/reset_mariadb.mjs`
2. Reaplicar la semilla:
   - `node scripts/seed_pucese.mjs`
3. Si se usa Docker, recrear backend:
   - `cd docker`
   - `docker compose up -d --force-recreate backend`

## Referencias utiles

- `backend/database/mariadb_schema.sql`
- `backend/database/mariadb_initializer.js`
- `docs/02-dominio-datos/migraciones.md`
