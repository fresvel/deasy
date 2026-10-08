-- MIGRACIÓN DEL FRENTE 24 · FASE 1 · los tres renombrados
--
-- `postgres_schema.sql` describe la FORMA y no reubica una base anterior (contrato TD7-s): todo es
-- `CREATE TABLE IF NOT EXISTS`, así que sobre una base que ya existe los nombres viejos se quedan
-- como están y el arranque falla con `column "vinculo_id" does not exist`. Esto lo arregla.
--
-- Es IDEMPOTENTE: cada paso comprueba antes si hace falta, así que se puede correr dos veces.
--
--   psql -U deasy -d deasy -v ON_ERROR_STOP=1 -f scripts/migrar-recorrido.sql
--
-- La alternativa es resetear (`scripts/reset-system.sh <env>`), que es lo que se hace en dev.

BEGIN;

-- ── Las tres tablas ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='plantillas' AND tablename='deliverables') THEN
    ALTER TABLE plantillas.deliverables RENAME TO catalogo_documental;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='plantillas' AND tablename='template_artifacts') THEN
    ALTER TABLE plantillas.template_artifacts RENAME TO ediciones;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='procesos' AND tablename='process_definition_templates') THEN
    ALTER TABLE procesos.process_definition_templates RENAME TO vinculos;
  END IF;
END $$;

-- ── Las tres columnas, allá donde estén ───────────────────────────────────────────────────────
-- Se recorre el catálogo en vez de escribir una lista a mano: `edicion_id` existía en cuatro tablas
-- y `vinculo_id` en tres, y una lista escrita a mano es una lista que se queda corta.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
      FROM information_schema.columns
     WHERE table_schema IN ('identidad','organizacion','procesos','plantillas','tareas','firmas','chat','empleo')
       AND column_name IN ('template_artifact_id','process_definition_template_id','deliverable_id')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO %I',
      r.table_schema, r.table_name, r.column_name,
      CASE r.column_name
        WHEN 'template_artifact_id'            THEN 'edicion_id'
        WHEN 'process_definition_template_id'  THEN 'vinculo_id'
        WHEN 'deliverable_id'                  THEN 'catalogo_documental_id'
      END);
  END LOOP;
END $$;

-- ── Índices y restricciones que llevaban el nombre viejo dentro ───────────────────────────────
-- No son cosméticos: `postgres_schema.sql` los crea con `IF NOT EXISTS`, así que sin renombrarlos
-- quedarían DUPLICADOS —el viejo con su nombre y el nuevo recién creado— sobre las mismas columnas.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS esquema, c.relname AS nombre, 'index' AS clase
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'i'
       AND (c.relname LIKE '%deliverables%' OR c.relname LIKE '%template_artifacts%'
            OR c.relname LIKE '%process_definition_template%')
  LOOP
    EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', r.esquema, r.nombre,
      replace(replace(replace(r.nombre,
        'process_definition_templates','vinculos'),
        'template_artifacts','ediciones'),
        'deliverables','catalogo_documental'));
  END LOOP;

  FOR r IN
    SELECT n.nspname AS esquema, t.relname AS tabla, con.conname AS nombre
      FROM pg_constraint con
      JOIN pg_class t ON t.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE (con.conname LIKE '%deliverables%' OR con.conname LIKE '%template_artifacts%'
            OR con.conname LIKE '%process_definition_template%')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I', r.esquema, r.tabla, r.nombre,
      replace(replace(replace(r.nombre,
        'process_definition_templates','vinculos'),
        'template_artifacts','ediciones'),
        'deliverables','catalogo_documental'));
  END LOOP;
END $$;

COMMIT;
