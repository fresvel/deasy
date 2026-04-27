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
   - `node backend/scripts/reset_mariadb.mjs`
2. Reaplicar la semilla:
   - `node backend/scripts/seed_pucese.mjs`
3. Si se usa Docker, recrear backend:
   - `cd docker`
   - `docker compose up -d --force-recreate backend`

## Referencias utiles

- `backend/database/mariadb_schema.sql`
- `backend/database/mariadb_initializer.js`
- `docs/02-dominio-datos/migraciones.md`

## Estado actualizado: inicializador MariaDB (2026-03-17)

### Problema previo

- El backend podia registrar: `No se pudo inicializar MariaDB: Table 'deasy.templates' doesn't exist`.
- Causa: el inicializador intentaba migraciones sobre `templates` / `process_templates` sin verificar existencia previa.

### Estado actual

- Corregido en `backend/database/mariadb_initializer.js`.
- Ahora verifica si existen esas tablas antes de aplicar `ALTER`/FK y, si no existen, emite aviso controlado y continua.
- Resultado: el servidor ya no corta su arranque por ausencia de esas tablas.

### Nota operativa

- Si existen filas invalidas en `processes` (sin `unit_id` ni `program_id`), el inicializador omite crear el CHECK `chk_process_unit_program` y reporta el total de filas conflictivas.

## Error pendiente (no bloqueante para registro)

- Durante el envio de codigo de verificacion de email puede aparecer:
  - FK de `email_verification_codes.user_id` apuntando a `users(id)` mientras el alta actual usa `persons(id)`.
- Impacto:
  - No bloquea el alta del usuario.
  - Si bloquea la insercion del codigo de verificacion en ese flujo.
