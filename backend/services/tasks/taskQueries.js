// Consultas de LECTURA sobre tareas y entregables. Aquí no hay reglas: se pregunta y se devuelven
// filas; quien decide qué hacer con ellas es su llamador.
//
// ⚠️ VIVÍAN EN `controllers/tareas/` HASTA EL 2026-10-07 (F7.2), que es una fuga de capa: un
// controller es transporte. Se movieron tal cual, sin tocar una línea de SQL.

// Las tareas de una persona, por TENENCIA. El segundo término del WHERE cubre lo ABANDONADO.
// Movida desde `tareas_controler.js`: el filtro opcional se compone igual que allí.
export const listTasksForPerson = async (pool, personId, filtros = {}) => {
  const condiciones = [];
  const params = [personId, personId];
  if (filtros.processId) {
    condiciones.push("p.id = ?");
    params.push(Number(filtros.processId));
  }
  if (filtros.processSlug) {
    condiciones.push("p.slug = ?");
    params.push(String(filtros.processSlug));
  }
  if (filtros.termId) {
    condiciones.push("t.term_id = ?");
    params.push(Number(filtros.termId));
  }
  if (filtros.status) {
    condiciones.push("ta.status = ?");
    params.push(String(filtros.status));
  }
  const whereExtra = condiciones.length ? ` AND ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT t.id AS task_id,
            t.status AS task_status,
            t.start_date,
            t.end_date,
            t.term_id,
            -- assignment_id/assignment_status salian de task_assignments, retirada el
            -- 2026-08-23. El id pasa a ser el de la TENENCIA, que es lo que de verdad relaciona a
            -- esta persona con esta tarea; el estado NO tiene sucesor y desaparece: era una
            -- columna sin escritores, se quedaba en 'pendiente' para siempre.
            te.id AS assignment_id,
            pdv.id AS process_definition_id,
            pdv.variation_key,
            pdv.definition_version,
            pdv.name AS process_definition_name,
            tis.task_item_count,
            tis.task_item_names,
            p.id AS process_id,
            p.name AS process_name,
            p.slug AS process_slug,
            u.id AS unit_id,
            u.name AS unit_name
     FROM task_item_tenures te
     INNER JOIN task_items ti_te ON ti_te.id = te.task_item_id
     INNER JOIN tasks t ON t.id = ti_te.task_id
     INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     LEFT JOIN (
       SELECT
         ti.task_id,
         COUNT(*) AS task_item_count,
         GROUP_CONCAT(DISTINCT tar_dl.display_name ORDER BY ti.sort_order SEPARATOR ' | ') AS task_item_names
       FROM task_items ti
       LEFT JOIN vinculos pdt
         ON pdt.id = ti.vinculo_id
       LEFT JOIN ediciones tar
         ON tar.id = pdt.edicion_id
         LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
       GROUP BY ti.task_id
     ) tis
       ON tis.task_id = t.id
     INNER JOIN processes p ON p.id = pdv.process_id
     INNER JOIN unit_positions up ON up.id = ti_te.responsible_position_id
     INNER JOIN units u ON u.id = up.unit_id
     LEFT JOIN position_assignments pa
       ON pa.position_id = ti_te.responsible_position_id AND pa.is_current = 1
     -- El segundo termino cubre lo ABANDONADO: tenencia abierta sin persona, y quien ocupa hoy el
     -- puesto responsable la ve. te.ended_at IS NULL es nuevo y hace falta: sin el, una tenencia
     -- CERRADA sin persona (las hay: son el rastro de cada abandono) le daria la tarea al ocupante
     -- actual por cada abandono historico.
     WHERE (te.person_id = ? OR (te.person_id IS NULL AND te.ended_at IS NULL AND pa.person_id = ?))
     ${whereExtra}
     ORDER BY t.start_date DESC`,
    params
  );
  return rows || [];
};

// La definición de proceso de un entregable. Movida desde `supervision_controler.js`, donde existía
// porque el jefe de unidad NO manda la definición: aceptarla del cliente sería dejarle elegir sobre
// qué proceso opera.
export const getProcessDefinitionIdForTaskItem = async (connection, taskItemId) => {
  const [rows] = await connection.query(
    `SELECT t.process_definition_id
       FROM task_items ti
       INNER JOIN tasks t ON t.id = ti.task_id
      WHERE ti.id = ?
      LIMIT 1`,
    [Number(taskItemId)]
  );
  return rows?.[0]?.process_definition_id ?? null;
};

// La definición de proceso de una TAREA. Hermana de la de arriba, que va por entregable.
// Movida desde `user_controler.js` (F7.2, 2026-10-07).
export const getProcessDefinitionIdForTask = async (ejecutor, taskId) => {
  const [rows] = await ejecutor.query(
    `SELECT process_definition_id FROM tasks WHERE id = ? LIMIT 1`,
    [Number(taskId)]
  );
  return rows?.[0]?.process_definition_id ? Number(rows[0].process_definition_id) : null;
};

// EL HISTORIAL DE RELEVOS de un entregable, con forma de EVENTOS.
// Movido desde `user_controler.js` (F7.2, 2026-10-07).
//
// Sale de `task_item_tenures` (periodos) con forma de eventos (`from`/`to`), que es la que el
// frontend pinta: el «de quién» es el ocupante de la tenencia anterior, o sea un `LAG`. Incluye la
// tenencia `original` del reparto inicial, que el asiento viejo no registraba — el historial empezaba
// en el segundo responsable.
//
// `performed_by_person_id` NO se proyecta: a un responsable le importa el qué y el porqué, no qué
// administrador lo ejecutó. Sigue en la tabla para la consulta forense.
export const listTenureHistoryForTaskItem = async (ejecutor, taskItemId) => {
  const [rows] = await ejecutor.query(
    `SELECT te.id,
            te.from_person_id,
            te.person_id AS to_person_id,
            te.reason,
            te.opened_by AS trigger_kind,
            te.started_at AS created_at,
            CONCAT(fp.first_name, ' ', fp.last_name) AS from_person_name,
            CONCAT(tp.first_name, ' ', tp.last_name) AS to_person_name
       FROM (
         SELECT t.id, t.task_item_id, t.person_id, t.reason, t.opened_by, t.started_at,
                LAG(t.person_id) OVER (PARTITION BY t.task_item_id ORDER BY t.started_at, t.id)
                  AS from_person_id
           FROM task_item_tenures t
          WHERE t.task_item_id = ?
       ) te
       LEFT JOIN persons fp ON fp.id = te.from_person_id
       LEFT JOIN persons tp ON tp.id = te.person_id
      ORDER BY te.id DESC`,
    [Number(taskItemId)]
  );
  return rows || [];
};
