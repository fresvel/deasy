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

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- FASE 2 · muere el escalón 2 (el recorrido del VÍNCULO)
--
-- Se midió antes de quitarlo: nadie lo escribía, su único productor —el `meta.yaml` que proyectaba
-- `WorkflowSyncService`— se borró en el sub-paso 8 del §0.8, y la puerta de publicación lo EXCLUÍA
-- con un `vinculo_id IS NULL` explícito. Las únicas filas que existían las ponía la siembra de dev
-- a través del editor genérico de /admin.
--
-- ⚠️ ORDEN IMPORTANTE: primero se MIGRAN las filas que queden a la edición del vínculo, y sólo
-- después se borra la columna. Al revés se perderían los pasos que cuelgan de esas cabeceras.
-- ══════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE r RECORD; migradas INT := 0; huerfanas INT := 0; ids TEXT;
BEGIN
  FOR r IN SELECT 'plantillas' AS esq, 'fill_flow_templates' AS tabla
           UNION ALL SELECT 'firmas', 'signature_flow_templates'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = r.esq AND table_name = r.tabla AND column_name = 'vinculo_id') THEN
      CONTINUE;   -- ya migrada
    END IF;

    -- 1 · las de RUNTIME llevaban las DOS anclas; se quedan sólo con la del entregable.
    EXECUTE format('UPDATE %I.%I SET vinculo_id = NULL WHERE task_item_id IS NOT NULL', r.esq, r.tabla);

    -- 2 · las del VÍNCULO pasan a la EDICIÓN que ese vínculo enlaza — si esa edición no tiene ya
    --     una cabecera propia, que ganaría de todos modos por ser la que el resolvedor busca.
    EXECUTE format($f$
      UPDATE %I.%I h
         SET edicion_id = v.edicion_id
        FROM procesos.vinculos v
       WHERE h.vinculo_id = v.id
         AND h.task_item_id IS NULL
         AND h.edicion_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM %I.%I otra
                          WHERE otra.edicion_id = v.edicion_id
                            AND otra.task_item_id IS NULL)
    $f$, r.esq, r.tabla, r.esq, r.tabla);
    GET DIAGNOSTICS migradas = ROW_COUNT;

    -- 3 · y si alguna se queda SIN ANCLA, esto PARA. No es celo: una cabecera sin ancla no la
    --     encuentra ningun escalon —los dos resolutores preguntan por un portador—, asi que sus
    --     pasos no los sirve nadie, y ademas bloquea el CHECK del paso 4. Borrarla es seguro pero
    --     es una decision de quien migra, no de este script. Como el bloque entero va en una sola
    --     transaccion, al fallar aqui NO queda media migracion: se arregla y se vuelve a lanzar.
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE edicion_id IS NULL AND task_item_id IS NULL', r.esq, r.tabla)
      INTO huerfanas;
    IF huerfanas > 0 THEN
      EXECUTE format('SELECT string_agg(id::text, '', '' ORDER BY id) FROM %I.%I WHERE edicion_id IS NULL AND task_item_id IS NULL', r.esq, r.tabla)
        INTO ids;
      RAISE EXCEPTION 'MIGRACION DETENIDA: % cabecera(s) de %.% quedan SIN ANCLA (ids: %). La edicion de su vinculo ya tenia recorrido propio, asi que estas son redundantes y nadie las sirve. Revisalas y, si confirmas que sobran: DELETE FROM %.% WHERE id IN (%); y relanza este script.',
        huerfanas, r.esq, r.tabla, ids, r.esq, r.tabla, ids;
    END IF;
    RAISE NOTICE 'MIGRACION: %.% -> % cabecera(s) movidas del vinculo a la edicion', r.esq, r.tabla, migradas;

    EXECUTE format('ALTER TABLE %I.%I DROP COLUMN vinculo_id', r.esq, r.tabla);
  END LOOP;

  -- 4 · el CHECK de "exactamente un portador", que el escalon del vinculo hacia imposible: las
  --     filas de runtime llevaban `vinculo_id` Y `task_item_id` a la vez, asi que los tres
  --     portadores no eran excluyentes. Con dos si lo son, y cada escritor usa uno.
  --     Va aparte del CREATE TABLE porque `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya
  --     existe (contrato TD7-s): sobre una base viva el CHECK del esquema ni se aplica ni falla.
  FOR r IN SELECT 'plantillas' AS esq, 'fill_flow_templates' AS tabla
           UNION ALL SELECT 'firmas', 'signature_flow_templates'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = 'ck_' || r.tabla || '_un_portador'
                      AND conrelid = (r.esq || '.' || r.tabla)::regclass) THEN
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (num_nonnulls(task_item_id, edicion_id) = 1)',
                     r.esq, r.tabla, 'ck_' || r.tabla || '_un_portador');
      RAISE NOTICE 'MIGRACION: %.% -> CHECK de un solo portador anadido', r.esq, r.tabla;
    END IF;
  END LOOP;
END $$;

COMMIT;
