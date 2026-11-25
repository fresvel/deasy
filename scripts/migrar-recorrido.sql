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

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- FASE 3 · un mecanismo y un idioma para el estado del recorrido
--
-- Cuatro columnas describian lo mismo de dos maneras: la ENTREGA con `status TEXT` y un CHECK en
-- INGLES, y la FIRMA con `status_id` apuntando al catalogo `signature_request_statuses`, en ESPAÑOL.
-- Se unifica en CHECK y en español.
--
-- ⚠️ `signature_statuses` NO SE TOCA: es el estado del HECHO de firmar
-- (`document_signatures.signature_status_id`), no el de la solicitud.
--
-- ⚠️ EL ORDEN TIENE TRES PASOS Y NINGUNO SE PUEDE ADELANTAR, y el segundo costo una corrida:
--   1. se QUITA el CHECK viejo. Admite solo ingles, asi que mientras este puesto **rechaza el
--      propio UPDATE que traduce** (`new row ... violates check constraint`);
--   2. se TRADUCEN los valores;
--   3. y se pone el CHECK nuevo. Al reves lo rechazaria el `ALTER`.
-- Despues se añade la columna de texto a las dos de firma, se rellena desde el catalogo, y solo al
-- final se borran `status_id` y el catalogo.
-- ══════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  r RECORD;
  traducidas INT := 0;
  rebeldes TEXT;
  ES6 TEXT := '''pendiente'', ''en_progreso'', ''completado'', ''rechazado'', ''devuelto'', ''cancelado''';
  ES5 TEXT := '''pendiente'', ''en_progreso'', ''completado'', ''rechazado'', ''cancelado''';
BEGIN
  -- 1 · ENTREGA: traducir los valores y recolocar el CHECK.
  FOR r IN SELECT 'plantillas' AS esq, 'fill_requests' AS tabla, 1 AS con_devuelto
           UNION ALL SELECT 'plantillas', 'document_fill_flows', 0
  LOOP
    -- EL CHECK VIEJO, FUERA ANTES DE TRADUCIR: admite solo ingles y rechazaria el UPDATE.
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.esq, r.tabla, r.tabla || '_status_check');

    -- Idempotencia: si ya no queda ni un valor en ingles, esta tabla ya paso por aqui.
    EXECUTE format($f$
      UPDATE %I.%I SET status = CASE status
        WHEN 'pending'     THEN 'pendiente'
        WHEN 'in_progress' THEN 'en_progreso'
        WHEN 'approved'    THEN 'completado'
        WHEN 'rejected'    THEN 'rechazado'
        WHEN 'returned'    THEN 'devuelto'
        WHEN 'cancelled'   THEN 'cancelado'
        ELSE status END
      WHERE status IN ('pending','in_progress','approved','rejected','returned','cancelled')
    $f$, r.esq, r.tabla);
    GET DIAGNOSTICS traducidas = ROW_COUNT;
    RAISE NOTICE 'MIGRACION: %.% -> % fila(s) traducidas al español', r.esq, r.tabla, traducidas;

    -- Si queda algun valor que no sea del vocabulario nuevo, esto PARA: poner el CHECK encima lo
    -- rechazaria igual, pero con un mensaje que no dice QUE valor sobra.
    EXECUTE format($f$
      SELECT string_agg(DISTINCT quote_literal(status), ', ') FROM %I.%I
       WHERE status NOT IN (%s)
    $f$, r.esq, r.tabla, CASE WHEN r.con_devuelto = 1 THEN ES6 ELSE ES5 END) INTO rebeldes;
    IF rebeldes IS NOT NULL THEN
      RAISE EXCEPTION 'MIGRACION DETENIDA: %.% tiene valores de estado fuera del vocabulario nuevo: %. Traducelos a mano y relanza.',
        r.esq, r.tabla, rebeldes;
    END IF;

    -- Y el CHECK nuevo, ya con el vocabulario traducido debajo.
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (status IN (%s))',
                   r.esq, r.tabla, r.tabla || '_status_check',
                   CASE WHEN r.con_devuelto = 1 THEN ES6 ELSE ES5 END);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN status SET DEFAULT ''pendiente''', r.esq, r.tabla);
  END LOOP;

  -- 2 · FIRMA: de clave ajena a texto. El catalogo ya estaba en español, asi que aqui no se
  --     traduce nada: se COPIA el codigo y se tira la indireccion.
  FOR r IN SELECT 'firmas' AS esq, 'signature_requests' AS tabla
           UNION ALL SELECT 'firmas', 'signature_flow_instances'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = r.esq AND table_name = r.tabla AND column_name = 'status_id') THEN
      CONTINUE;   -- ya migrada
    END IF;

    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS status TEXT', r.esq, r.tabla);
    EXECUTE format($f$
      UPDATE %I.%I h SET status = srs.code
        FROM firmas.signature_request_statuses srs
       WHERE srs.id = h.status_id
    $f$, r.esq, r.tabla);
    GET DIAGNOSTICS traducidas = ROW_COUNT;
    RAISE NOTICE 'MIGRACION: %.% -> % fila(s) con su codigo copiado del catalogo', r.esq, r.tabla, traducidas;

    EXECUTE format('SELECT count(*)::text FROM %I.%I WHERE status IS NULL', r.esq, r.tabla) INTO rebeldes;
    IF rebeldes <> '0' THEN
      RAISE EXCEPTION 'MIGRACION DETENIDA: %.% deja % fila(s) sin estado (su status_id no estaba en el catalogo).',
        r.esq, r.tabla, rebeldes;
    END IF;

    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN status SET NOT NULL', r.esq, r.tabla);
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN status SET DEFAULT ''pendiente''', r.esq, r.tabla);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.esq, r.tabla, r.tabla || '_status_check');
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (status IN (%s))',
                   r.esq, r.tabla, r.tabla || '_status_check', ES5);
    EXECUTE format('ALTER TABLE %I.%I DROP COLUMN status_id', r.esq, r.tabla);
  END LOOP;

  -- 3 · y el catalogo, que ya no lo lee nadie.
  DROP TABLE IF EXISTS firmas.signature_request_statuses;
  RAISE NOTICE 'MIGRACION: firmas.signature_request_statuses -> borrada (un CHECK la sustituye)';
END $$;

COMMIT;
