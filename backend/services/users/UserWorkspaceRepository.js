// EL ESPACIO DE TRABAJO DE UNA PERSONA, en modo LECTURA: las consultas que alimentan el panel
// operativo, el centro de documentos, el centro de firmas y las bandejas.
//
// Aquí NO hay reglas: 22 funciones, ninguna lanza, ninguna decide. Cada una recibe el `pool` o la
// `connection` por parámetro y devuelve filas. Es una capa de datos, y por eso vive en `services/`.
//
// ⚠️ VIVIÓ EN `controllers/users/user_controler.queries.js` HASTA EL 2026-10-07, y su propia cabecera
// pedía este traslado: «es el candidato natural a promoverse a
// services/users/UserWorkspaceRepository.js cuando se corrija la fuga de capa (SQL crudo en un
// controller)». Eran 45 de las 77 consultas que estaban fuera de la capa de servicio. Se movió tal
// cual: mismas 22 funciones, mismos nombres, mismas consultas, ni un golden movido.
// Historia del primer troceado: docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-user-controler-2026-07.md
//
// ⚠️ Y su cabecera decía «este módulo NO importa nada», que era falso: importa los dos fragmentos de
// subconsulta de acceso que usan casi todas sus consultas. Lo que sí es cierto —y es lo que vale— es
// que no captura estado de módulo ni abre conexiones propias.
//
// OJO (bug histórico, ver commit a199a28): en PostgreSQL, un SELECT DISTINCT exige que
// TODA columna del ORDER BY esté proyectada. MySQL no. Si añades un ORDER BY aquí,
// proyecta la columna o tendrás un 500.

import {
  accessSubqueryCorrelated,
  accessSubqueryForTaskItem,
} from "../documents/DeliverableAccessService.js";

export const getActiveUserPositions = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       up.id AS position_id,
       up.title AS position_title,
       up.slot_no,
       u.id AS unit_id,
       u.name AS unit_name,
       u.label AS unit_label,
       u.unit_type_id,
       c.id AS cargo_id,
       c.name AS cargo_name
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     INNER JOIN units u ON u.id = up.unit_id
     INNER JOIN cargos c ON c.id = up.cargo_id
     WHERE pa.person_id = ?
       AND pa.is_current = 1
       AND up.is_active = 1
       AND u.is_active = 1
       AND c.is_active = 1
     ORDER BY u.name, c.name, up.slot_no, up.id`,
    [userId]
  );
  return rows;
};

export const getUserDocumentCenterRows = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       ti.id AS document_id,
       ti.id AS task_item_id,
       ti.document_status,
       dv.id AS document_version_id,
       dv.version_label AS document_version,
       dv.status AS document_version_status,
       dv.working_file_path,
       dv.final_file_path,
       t.id AS task_id,
       t.status AS task_status,
       t.term_id,
       pdv.id AS process_definition_id,
       pdv.name AS definition_name,
       pdv.variation_key,
       pdv.definition_version,
       p.id AS process_id,
       p.name AS process_name,
       p.slug AS process_slug,
       COALESCE(origin_unit.label, origin_unit.name, scope_unit.label, scope_unit.name) AS unit_label,
       COALESCE(origin_unit.id, scope_unit.id) AS unit_id,
       trm.name AS term_name,
       tt.name AS term_type_name,
       YEAR(trm.start_date) AS term_year,
       tar_dl.display_name AS template_artifact_name,
       COALESCE(fill_stats.pending_fill_count, 0) AS pending_fill_count,
       COALESCE(signature_stats.pending_signature_count, 0) AS pending_signature_count,
       COALESCE(trm.start_date, t.created_at) AS sort_date
     FROM task_items ti
     INNER JOIN (
       SELECT dv1.*
       FROM document_versions dv1
       INNER JOIN (
         SELECT task_item_id, MAX(version) AS max_version
         FROM document_versions
         GROUP BY task_item_id
       ) latest
         ON latest.task_item_id = dv1.task_item_id
        AND latest.max_version = dv1.version
     ) dv ON dv.task_item_id = ti.id
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     INNER JOIN processes p ON p.id = pdv.process_id
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     LEFT JOIN terms trm ON trm.id = t.term_id
     LEFT JOIN term_types tt ON tt.id = trm.term_type_id
     LEFT JOIN units origin_unit ON origin_unit.id = ti.origin_unit_id
     LEFT JOIN unit_positions scope_position ON scope_position.id = ti.responsible_position_id
     LEFT JOIN units scope_unit ON scope_unit.id = scope_position.unit_id
     LEFT JOIN (
       SELECT
         r.document_version_id,
         SUM(CASE WHEN t.respondido IS NULL THEN 1 ELSE 0 END) AS pending_fill_count
       FROM recorridos r
       LEFT JOIN turnos t ON t.recorrido_id = r.id
       WHERE r.accion = 'entrega'
       GROUP BY r.document_version_id
     ) fill_stats ON fill_stats.document_version_id = dv.id
     LEFT JOIN (
       SELECT
         r.document_version_id,
         SUM(CASE WHEN t.respondido IS NULL THEN 1 ELSE 0 END) AS pending_signature_count
       FROM recorridos r
       LEFT JOIN turnos t ON t.recorrido_id = r.id
       WHERE r.accion = 'firma'
       GROUP BY r.document_version_id
     ) signature_stats ON signature_stats.document_version_id = dv.id
     WHERE EXISTS (
       -- Sexta y ultima copia del predicado de participacion. El IDOR que llevaba dentro se
       -- midio en su dia aqui: 15 de 18 documentos del Centro Documental eran ajenos.
       SELECT 1
       FROM (${accessSubqueryCorrelated("ti")}) participantes
       WHERE participantes.person_id = ?
     )
     ORDER BY sort_date DESC, p.name ASC, ti.id DESC`,
    // Seis `userId` en uno.
    [userId]
  );
  return rows;
};

export const getUserGlobalPendingSignatureRows = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       sr.id AS turno_id,
       sr.solicitado AS requested_at,
       sr.estado AS signature_request_status_code,
       sfs.orden AS step_order,
       sfs.nombre AS step_name,
       ti.id AS document_id,
       ti.id AS task_item_id,
       ti.document_status,
       dv.id AS document_version_id,
       dv.version_label AS document_version,
       dv.status AS document_version_status,
       dv.working_file_path,
       dv.final_file_path,
       t.id AS task_id,
       t.term_id,
       pdv.id AS process_definition_id,
       pdv.name AS definition_name,
       p.id AS process_id,
       p.name AS process_name,
       p.slug AS process_slug,
       COALESCE(origin_unit.label, origin_unit.name, scope_unit.label, scope_unit.name) AS unit_label,
       COALESCE(origin_unit.id, scope_unit.id) AS unit_id,
       trm.name AS term_name,
       tt.name AS term_type_name,
       YEAR(trm.start_date) AS term_year,
       tar_dl.display_name AS template_artifact_name,
       COALESCE(trm.start_date, t.created_at) AS sort_date
     FROM turnos sr
     INNER JOIN recorridos sfi ON sfi.id = sr.recorrido_id AND sfi.accion = 'firma'
     INNER JOIN participantes_declarados spr ON spr.id = sr.participante_id
     INNER JOIN pasos_declarados sfs ON sfs.id = spr.paso_id
     INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
     INNER JOIN (
       SELECT task_item_id, MAX(version) AS max_version
       FROM document_versions
       GROUP BY task_item_id
     ) latest
       ON latest.task_item_id = dv.task_item_id
      AND latest.max_version = dv.version
     INNER JOIN task_items ti ON ti.id = dv.task_item_id
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     INNER JOIN processes p ON p.id = pdv.process_id
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     LEFT JOIN terms trm ON trm.id = t.term_id
     LEFT JOIN term_types tt ON tt.id = trm.term_type_id
     LEFT JOIN units origin_unit ON origin_unit.id = ti.origin_unit_id
     LEFT JOIN unit_positions scope_position ON scope_position.id = ti.responsible_position_id
     LEFT JOIN units scope_unit ON scope_unit.id = scope_position.unit_id
     WHERE sr.persona_id = ?
       AND sr.respondido IS NULL
       AND LOWER(COALESCE(dv.status, '')) IN (
         'listo para firma',
         'pendiente de firma',
         'firmado parcial'
       )
     ORDER BY sort_date DESC, sr.solicitado DESC, sr.id DESC`,
    [userId]
  );
  return rows;
};

export const getOrgChildrenMap = async (pool) => {
  const [rows] = await pool.query(
    `SELECT ur.parent_unit_id, ur.child_unit_id
     FROM unit_relations ur
     INNER JOIN relation_unit_types rt
       ON rt.id = ur.relation_type_id
      AND rt.code = 'org'`
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.parent_unit_id)) {
      map.set(row.parent_unit_id, []);
    }
    map.get(row.parent_unit_id).push(row.child_unit_id);
  });
  return map;
};

export const getDefinitionContext = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       pdv.id,
       pdv.process_id,
       pdv.series_id,
       pdv.variation_key,
       pdv.definition_version,
       pdv.name,
       pdv.description,
       pdv.status,
       pdv.effective_from,
       pdv.effective_to,
       p.name AS process_name,
       p.slug AS process_slug,
       pds.code AS series_code,
       pds.source_type AS series_source_type,
       CASE
         WHEN pds.source_type = 'unit_type' THEN ut.name
         WHEN pds.source_type = 'cargo' THEN c.name
         ELSE NULL
       END AS series_source_name
     FROM process_definition_versions pdv
     INNER JOIN processes p ON p.id = pdv.process_id
     LEFT JOIN process_definition_series pds ON pds.id = pdv.series_id
     LEFT JOIN unit_types ut ON ut.id = pds.unit_type_id
     LEFT JOIN cargos c ON c.id = pds.cargo_id
     WHERE pdv.id = ?
     LIMIT 1`,
    [definitionId]
  );
  return rows[0] || null;
};

export const getActiveDefinitionRules = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       ptr.id,
       ptr.unit_scope_type,
       ptr.unit_id,
       ptr.unit_type_id,
       ptr.cargo_id,
       ptr.position_id,
       ptr.recipient_policy,
       ptr.priority,
       ptr.is_active,
       ptr.effective_from,
       ptr.effective_to,
       u.name AS unit_name,
       ut.name AS unit_type_name,
       c.name AS cargo_name,
       up.title AS position_title
     FROM process_target_rules ptr
     LEFT JOIN units u ON u.id = ptr.unit_id
     LEFT JOIN unit_types ut ON ut.id = ptr.unit_type_id
     LEFT JOIN cargos c ON c.id = ptr.cargo_id
     LEFT JOIN unit_positions up ON up.id = ptr.position_id
     WHERE ptr.process_definition_id = ?
       AND ptr.is_active = 1
       AND (ptr.effective_from IS NULL OR ptr.effective_from <= CURDATE())
       AND (ptr.effective_to IS NULL OR ptr.effective_to >= CURDATE())
     ORDER BY ptr.priority ASC, ptr.id ASC`,
    [definitionId]
  );
  return rows;
};

export const getActiveDefinitionPeriodTypes = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       pdp.id,
       pdp.term_type_id,
       pdp.is_active,
       tt.code AS term_type_code,
       tt.name AS term_type_name
     FROM process_definition_period_types pdp
     LEFT JOIN term_types tt ON tt.id = pdp.term_type_id
     WHERE pdp.process_definition_id = ?
       AND pdp.is_active = 1
     ORDER BY tt.code ASC, pdp.id ASC`,
    [definitionId]
  );
  return rows;
};

export const getDefinitionTemplates = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       pdt.id,
       pdt.sort_order,
       tar.id AS edicion_id,
       tar_dl.display_name AS template_artifact_name,
       tar.is_active AS template_artifact_active,
       COUNT(DISTINCT pd.edicion_id) AS signature_flow_count
     FROM vinculos pdt
     INNER JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     -- El recorrido de un vinculo ES el de su edicion: la cabecera del vinculo --el escalon 2-- no la
     -- escribia nadie y la puerta de publicacion la excluia. Frente 24, fase 2.
     -- Y ya no hay cabecera que contar: se cuenta por EDICION, no por paso, asi que sigue dando 0 o
     -- 1 como antes. Lo que decide es que EXISTA un paso declarado de esta accion, que es justo lo
     -- que significaba una cabecera activa con pasos.
     LEFT JOIN pasos_declarados pd
       ON pd.edicion_id = pdt.edicion_id
      AND pd.accion = 'firma'
      AND pd.task_item_id IS NULL
     WHERE pdt.process_definition_id = ?
     GROUP BY
       pdt.id,
       pdt.sort_order,
       tar.id,
       tar_dl.display_name,
       tar.is_active
     ORDER BY pdt.sort_order ASC, pdt.id ASC`,
    [definitionId]
  );
  return rows;
};

export const getAvailableTerms = async (pool) => {
  const [rows] = await pool.query(
    `SELECT
       t.id,
       t.name,
       t.start_date,
       t.end_date,
       tt.id AS term_type_id,
       tt.code AS term_type_code,
       tt.name AS term_type_name
     FROM terms t
     INNER JOIN term_types tt ON tt.id = t.term_type_id
     WHERE t.is_active = 1
     ORDER BY t.start_date DESC, t.id DESC
     LIMIT 40`
  );
  return rows;
};

export const getUserOwnedTemplateArtifacts = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT
       ta.id,
       d.display_name,
       d.description,
       ta.is_active,
       ta.available_formats,
       ta.created_at
     FROM ediciones ta
     INNER JOIN catalogo_documental d ON d.id = ta.catalogo_documental_id
     WHERE d.owner_person_id = ?
       AND ta.is_active = 1
     ORDER BY ta.created_at DESC, ta.id DESC
     LIMIT 12`,
    [userId]
  );
  return rows;
};

export const getUserAccessibleTasksForDefinition = async (pool, userId, definitionId, scopeUnitId = null) => {
  const unitFilter = scopeUnitId
    ? `AND t.scope_unit_id = ${Number(scopeUnitId)}`
    : "";

  const [rows] = await pool.query(
    `SELECT
       t.id,
       t.term_id,
       t.scope_unit_id,
       t.description,
       t.start_date,
       t.end_date,
       t.status,
       t.created_at,
       trm.name AS term_name,
       tt.code AS term_type_code,
       tt.name AS term_type_name,
       t.scope_unit_id AS responsible_unit_id,
       COALESCE(ru.label, ru.name) AS responsible_unit_label
     FROM tasks t
     INNER JOIN terms trm ON trm.id = t.term_id
     INNER JOIN term_types tt ON tt.id = trm.term_type_id
     LEFT JOIN units ru ON ru.id = t.scope_unit_id
     WHERE t.process_definition_id = ?
       ${unitFilter}
       AND (
         EXISTS (
           SELECT 1
           FROM task_items ti_owner
           WHERE ti_owner.task_id = t.id
             AND (
               ti_owner.assigned_person_id = ?
               -- Quien encargo el entregable. Absorbe al t.created_by_user_id que habia aqui,
               -- retirado el 2026-08-23: en la tarea ad-hoc los dos valian lo mismo, y en la
               -- automatica el de la tarea estaba NULL.
               OR ti_owner.created_by_person_id = ?
             )
         )
         -- Antes esto miraba task_assignments, la foto del reparto que ningun relevo refrescaba:
         -- por ella, quien dejaba un puesto seguia viendo las tareas para siempre. Ahora mira las
         -- TENENCIAS —incluidas las cerradas, que es lo correcto en un listado: quien respondio de
         -- un entregable puede seguir consultando su tarea— y, para lo abandonado, a quien ocupa
         -- hoy el puesto responsable.
         OR EXISTS (
           SELECT 1
           FROM task_item_tenures te
           INNER JOIN task_items ti_te ON ti_te.id = te.task_item_id
           LEFT JOIN position_assignments pa
             ON pa.position_id = ti_te.responsible_position_id
            AND pa.is_current = 1
            AND pa.person_id = ?
           WHERE ti_te.task_id = t.id
             AND (
               te.person_id = ?
               OR (te.person_id IS NULL AND te.ended_at IS NULL AND pa.person_id = ?)
             )
         )
         OR EXISTS (
           SELECT 1
           FROM task_items ti
           INNER JOIN document_versions dv ON dv.task_item_id = ti.id
           INNER JOIN recorridos r ON r.document_version_id = dv.id AND r.accion = 'entrega'
           INNER JOIN turnos tu ON tu.recorrido_id = r.id
           WHERE ti.task_id = t.id
             AND tu.persona_id = ?
         )
         OR EXISTS (
           SELECT 1
           FROM task_items ti
           INNER JOIN document_versions dv ON dv.task_item_id = ti.id
           INNER JOIN recorridos rf ON rf.document_version_id = dv.id AND rf.accion = 'firma'
           INNER JOIN turnos tf ON tf.recorrido_id = rf.id
           WHERE ti.task_id = t.id
             AND tf.persona_id = ?
         )
       )
     ORDER BY t.start_date DESC, t.id DESC`,
    // Siete `userId`: uno por cada rama de participacion. Eran ocho hasta que el «Para:» dejo de
    // ser una de ellas (2026-08-23).
    [definitionId, userId, userId, userId, userId, userId, userId, userId]
  );
  return rows;
};

export const getTaskItemsForTaskIds = async (pool, taskIds, userId) => {
  if (!taskIds.length) {
    return [];
  }
  const placeholders = taskIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       ti.id,
       ti.task_id,
       ti.vinculo_id,
       pdt.edicion_id,
       ti.origin_kind,
       ti.title,
       tar.generador_id,
       ti.sort_order,
       ti.responsible_position_id,
       ti.assigned_person_id,
       ti.target_unit_id,
       ti.start_date,
       ti.end_date,
       ti.user_started_at,
       COALESCE(NULLIF(ti.title, ''), tar_dl.display_name) AS template_artifact_name,
       rp.title AS responsible_position_title,
       pdt.item_mode AS item_mode,
       COALESCE(target_unit.label, target_unit.name) AS target_unit_label
     FROM task_items ti
     INNER JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     LEFT JOIN unit_positions rp ON rp.id = ti.responsible_position_id
     LEFT JOIN units target_unit ON target_unit.id = ti.target_unit_id
     WHERE ti.task_id IN (${placeholders})
       -- El panel devolvía TODOS los task_items de la tarea. Como un proceso dirigido a un
       -- cargo crea UN task_item por persona dentro de la MISMA tarea, cada responsable
       -- recibía en el cliente los entregables de sus compañeros (nombre, estado, fechas).
       -- El bloqueo era solo visual: la API los servía igual. Se filtra por participación,
       -- con el mismo criterio que getAccessibleTaskItemForUser.
       AND EXISTS (
         -- El guard del panel era la QUINTA copia del predicado de participación. Ahora es la
         -- misma subconsulta que el resto, correlacionada con el alias ti porque esto lista
         -- muchos entregables y no puede pasar un parametro por cada uno.
         SELECT 1
         FROM (${accessSubqueryCorrelated("ti")}) participantes
         WHERE participantes.person_id = ?
       )
     ORDER BY ti.task_id ASC, ti.sort_order ASC, ti.id ASC`,
    // Ocho `userId` quedaron en uno: el resto los absorbió la subconsulta correlacionada.
    [...taskIds, userId]
  );
  return rows;
};

export const getDocumentsForTaskItemIds = async (pool, taskItemIds) => {
  if (!taskItemIds.length) {
    return [];
  }
  const placeholders = taskItemIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       ti.id AS document_id,
       ti.id AS task_item_id,
       ti.origin_unit_id,
       COALESCE(origin_unit.label, origin_unit.name) AS origin_unit_label,
       ti.document_status,
       dv.id AS document_version_id,
       dv.version_label AS document_version,
       dv.working_file_path,
       dv.final_file_path,
       COALESCE(sig.total_signature_count, 0) AS total_signature_count,
       COALESCE(sig.pending_signature_count, 0) AS pending_signature_count
     FROM task_items ti
     LEFT JOIN units origin_unit ON origin_unit.id = ti.origin_unit_id
     LEFT JOIN (
       SELECT dv1.*
       FROM document_versions dv1
       INNER JOIN (
         SELECT task_item_id, MAX(version) AS max_version
         FROM document_versions
         GROUP BY task_item_id
       ) latest
         ON latest.task_item_id = dv1.task_item_id
        AND latest.max_version = dv1.version
     ) dv ON dv.task_item_id = ti.id
     LEFT JOIN (
       SELECT
         sfi.document_version_id,
         COUNT(sr.id) AS total_signature_count,
         SUM(CASE WHEN sr.respondido IS NULL THEN 1 ELSE 0 END) AS pending_signature_count
       FROM recorridos sfi
       INNER JOIN document_versions dv2 ON dv2.id = sfi.document_version_id
       LEFT JOIN turnos sr ON sr.recorrido_id = sfi.id
       WHERE sfi.accion = 'firma'
         AND LOWER(COALESCE(dv2.status, '')) IN (
         'listo para firma',
         'pendiente de firma',
         'firmado',
         'firmado parcial',
         'firmado completo'
       )
       GROUP BY sfi.document_version_id
     ) sig ON sig.document_version_id = dv.id
     WHERE ti.id IN (${placeholders})
     ORDER BY dv.task_item_id ASC, dv.id DESC`,
    taskItemIds
  );
  return rows;
};

export const getUserTaskItemParticipationSummary = async (pool, userId, taskItemIds) => {
  if (!taskItemIds.length) {
    return [];
  }
  const placeholders = taskItemIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       participation.task_item_id,
       MAX(participation.has_past_fill) AS has_past_fill,
       MAX(participation.has_past_signature) AS has_past_signature
     FROM (
       SELECT
         dv.task_item_id,
         CASE WHEN tu.respondido IS NOT NULL THEN 1 ELSE 0 END AS has_past_fill,
         0 AS has_past_signature
       FROM document_versions dv
       INNER JOIN recorridos r ON r.document_version_id = dv.id AND r.accion = 'entrega'
       INNER JOIN turnos tu ON tu.recorrido_id = r.id
       WHERE dv.task_item_id IN (${placeholders})
         AND tu.persona_id = ?

       UNION ALL

       SELECT
         dv.task_item_id,
         0 AS has_past_fill,
         CASE WHEN sr.respondido IS NOT NULL THEN 1 ELSE 0 END AS has_past_signature
       FROM document_versions dv
       INNER JOIN recorridos sfi ON sfi.document_version_id = dv.id AND sfi.accion = 'firma'
       INNER JOIN turnos sr ON sr.recorrido_id = sfi.id
       WHERE dv.task_item_id IN (${placeholders})
         AND sr.persona_id = ?
     ) participation
     GROUP BY participation.task_item_id`,
    [...taskItemIds, userId, ...taskItemIds, userId]
  );
  return rows;
};

export const getAccessibleTaskItemForUser = async (pool, userId, definitionId, taskItemId) => {
  const [rows] = await pool.query(
    `SELECT
       ti.id AS task_item_id,
       t.id AS task_id,
       t.term_id,
       ti.vinculo_id,
       pdt.edicion_id,
       ti.origin_kind,
       ti.target_unit_id,
       ti.start_date,
       ti.end_date,
       ti.user_started_at,
       tar_dl.display_name AS template_artifact_name,
       pdv.process_id,
       trm.term_type_id,
       trm.start_date AS term_start_date,
       YEAR(trm.start_date) AS term_year,
       -- Era resolved_owner_person_id, un COALESCE de TRES escalones: el «Para:», y dos que leian
       -- task_assignments —el ultimo de ellos cogiendo «el primer asignado de la tarea por id», que
       -- no era un respaldo sino una loteria—. Los tres intentaban responder «¿quien responde de
       -- esto?», y esa respuesta es una columna: la cache de la tenencia vigente.
       ti.assigned_person_id,
       COALESCE(ti.target_unit_id, t.scope_unit_id, responsible_pos.unit_id) AS scope_unit_id
     FROM task_items ti
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     INNER JOIN terms trm ON trm.id = t.term_id
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     LEFT JOIN unit_positions responsible_pos ON responsible_pos.id = ti.responsible_position_id
     WHERE ti.id = ?
       AND t.process_definition_id = ?
       -- ── EL GUARD YA NO VIVE AQUI ──────────────────────────────────────────────────────
       -- Hasta el 2026-08-22 este WHERE era una TERCERA implementacion del conjunto de
       -- participantes, con el arreglo del IDOR escrito dentro y ocho placeholders que eran el
       -- mismo userId. Las otras dos -isUserInTaskItemChain y ChatAuthorizationService- habian
       -- divergido de esta y entre si.
       --
       -- Ahora la pregunta la contesta DeliverableAccessService, que es el unico sitio donde se
       -- declara quien participa y por que. La acotacion del IDOR viaja con ella, en la fuente
       -- puesto_responsable_asignado.
       AND EXISTS (
         SELECT 1
         FROM (${accessSubqueryForTaskItem()}) participantes
         WHERE participantes.person_id = ?
       )
     LIMIT 1`,
    [taskItemId, definitionId, taskItemId, userId]
  );
  return rows?.[0] || null;
};

export const getAccessibleTaskItemDocumentForUser = async (
  pool,
  userId,
  definitionId,
  taskItemId,
  { documentId = null } = {}
) => {
  const taskItem = await getAccessibleTaskItemForUser(pool, userId, definitionId, taskItemId);
  if (!taskItem) {
    return null;
  }

  // EL FILTRO POR DOCUMENTO SE RETIRO (2026-08-23), y llevaba tiempo sin filtrar nada. Era
  // `AND d.id = ?` sobre una relacion 1:1 impuesta por indice: un entregable tenia como mucho un
  // documento, asi que el filtro solo podia devolver la MISMA fila o ninguna, y esto ultimo unicamente
  // si el cliente mandaba un id que no era el suyo. Con la tabla retirada, el documento ES el
  // entregable, y el entregable ya viene en la ruta.
  //
  // El parametro se sigue aceptando y se ignora: cinco endpoints lo reciben del cliente y romper
  // su firma no aporta nada.
  const params = [taskItemId];

  const [rows] = await pool.query(
    `SELECT
       ti.id AS document_id,
       ti.id AS task_item_id,
       ti.origin_unit_id,
       COALESCE(origin_unit.label, origin_unit.name) AS origin_unit_label,
       ti.document_status,
       dv.id AS document_version_id,
       dv.status AS document_version_status,
       dv.version_label AS document_version,
       dv.working_file_path,
       dv.final_file_path,
       (
         SELECT COUNT(*)
         FROM document_versions dv_seq
         WHERE dv_seq.task_item_id = ti.id
           AND dv_seq.id <= dv.id
       ) AS document_version_sequence
     FROM task_items ti
     LEFT JOIN units origin_unit ON origin_unit.id = ti.origin_unit_id
     INNER JOIN document_versions dv ON dv.task_item_id = ti.id
     INNER JOIN (
       SELECT task_item_id, MAX(version) AS max_version
       FROM document_versions
       GROUP BY task_item_id
     ) latest
       ON latest.task_item_id = dv.task_item_id
      AND latest.max_version = dv.version
     WHERE ti.id = ?
     ORDER BY dv.id DESC`,
    params
  );

  const documentRows = rows || [];
  const selectedDocument = documentRows[0] || null;
  return {
    ...taskItem,
    document_count: documentRows.length,
    document_id: selectedDocument?.document_id || null,
    origin_unit_id: selectedDocument?.origin_unit_id || null,
    origin_unit_label: selectedDocument?.origin_unit_label || null,
    document_status: selectedDocument?.document_status || null,
    document_version_id: selectedDocument?.document_version_id || null,
    document_version_status: selectedDocument?.document_version_status || null,
    document_version: selectedDocument?.document_version || null,
    working_file_path: selectedDocument?.working_file_path || null,
    final_file_path: selectedDocument?.final_file_path || null,
    document_version_sequence: selectedDocument?.document_version_sequence || null
  };
};

export const getUserPendingSignaturesForDefinition = async (pool, userId, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       sr.id,
       sr.solicitado AS requested_at,
       sr.respondido AS responded_at,
       sr.estado AS estado,
       sfs.orden AS step_order,
       tar_dl.display_name AS template_artifact_name,
       ti.id AS document_id,
       dv.id AS document_version_id,
       dv.version_label AS document_version
     FROM turnos sr
     INNER JOIN recorridos sfi ON sfi.id = sr.recorrido_id AND sfi.accion = 'firma'
     INNER JOIN participantes_declarados spr ON spr.id = sr.participante_id
     INNER JOIN pasos_declarados sfs ON sfs.id = spr.paso_id
     INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
     INNER JOIN task_items ti ON ti.id = dv.task_item_id
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     WHERE sr.persona_id = ?
       AND t.process_definition_id = ?
       AND LOWER(COALESCE(dv.status, '')) IN (
         'listo para firma',
         'pendiente de firma',
         'firmado',
         'firmado parcial',
         'firmado completo'
       )
     ORDER BY sr.respondido IS NOT NULL ASC, sr.solicitado DESC, sr.id DESC
     LIMIT 12`,
    [userId, definitionId]
  );
  return rows;
};

export const getSignatureWorkflowRequestsForDocumentVersions = async (pool, documentVersionIds) => {
  if (!documentVersionIds.length) {
    return [];
  }
  const placeholders = documentVersionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       sfi.document_version_id,
       sr.id,
       sr.persona_id AS assigned_person_id,
       sr.solicitado AS requested_at,
       sr.respondido AS responded_at,
       sr.estado AS estado,
       sfs.orden AS step_order,
       c.name AS cargo_name,
       tar_dl.display_name AS template_artifact_name,
       ti.id AS document_id,
       dv.id AS document_version_id,
       dv.version_label AS document_version,
       TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS assigned_person_name
     FROM recorridos sfi
     INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
     INNER JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     INNER JOIN turnos sr ON sr.recorrido_id = sfi.id
     INNER JOIN participantes_declarados spr ON spr.id = sr.participante_id
     INNER JOIN pasos_declarados sfs ON sfs.id = spr.paso_id
     LEFT JOIN persons p ON p.id = sr.persona_id
     -- EL CARGO LO TRAE EL PARTICIPANTE, no el paso. Es la diferencia que la unificacion hace
     -- visible: un paso con tres firmantes tenia UN cargo en su columna, el del primero, y los otros
     -- dos vivian sin reflejo en el JSONB. Ahora cada turno cuelga de su participante y trae el suyo.
     LEFT JOIN cargos c ON c.id = spr.cargo_id
     WHERE sfi.accion = 'firma'
       AND sfi.document_version_id IN (${placeholders})
     ORDER BY sfi.document_version_id ASC, sfs.orden ASC, spr.orden ASC, sr.id ASC`,
    documentVersionIds
  );
  return rows;
};

// ── EL ORIGEN DE LA RECETA, EN SQL Y CON PRIORIDAD ──────────────────────────────────────────────
//
// Los dos escalones --primero el del ENTREGABLE, despues el de la EDICION-- los resuelve
// `resolverReceta` en JavaScript, y aqui hacen falta DENTRO de una consulta porque estos dos
// lectores sirven a VARIAS versiones de documento de una vez.
//
// ⚠️ ESTABA ESCRITO DOS VECES Y UNA DE LAS DOS ESTABA MAL. El lector de entrega lo resolvia con un
// `OR` entre los dos origenes, y un `OR` no es una prioridad: un entregable *routed* con receta
// propia CUYA EDICION tambien tenga receta autorada casaba con las DOS, y el panel recibia los pasos
// duplicados. No lo cazo ningun golden porque el proceso por defecto no tiene receta de edicion.
//
// Asi que el escalon se escribe una vez. CONTRATO: el llamador declara un `dv_ctx` con
// `document_version_id`, `task_item_id`, `edicion_id` y `accion`.
//
// ⚠️ Y LA PUERTA DE ALIAS SE QUEJO, con razon aparente: el `pd` que trae este fragmento se usa en la
// lista del SELECT --zona revisada-- y se declaraba dentro de un hueco, que la puerta tapaba. Era un
// FALSO POSITIVO que empujaba justo a lo contrario de esto: duplicar la regla para callarla. Se
// arreglo la puerta, no la consulta: `check_sql_aliases.mjs` resuelve ahora los fragmentos que son un
// `const` sin huecos, y la nota de ese fichero dice exactamente cuanto alcanza.
const PASOS_DE_LA_RECETA = `
     INNER JOIN pasos_declarados pd
       ON pd.accion = dv_ctx.accion
      AND CASE
            WHEN EXISTS (
              SELECT 1
              FROM pasos_declarados px
              WHERE px.accion = dv_ctx.accion
                AND px.task_item_id = dv_ctx.task_item_id
            )
            THEN pd.task_item_id = dv_ctx.task_item_id
            ELSE pd.edicion_id = dv_ctx.edicion_id
          END`;

// El CONTEXTO de una version de documento para el fragmento de arriba.
const contextoDeLaReceta = (accion, placeholders) => `
     SELECT
       dv.id AS document_version_id,
       dv.task_item_id,
       pdt.edicion_id,
       '${accion}' AS accion
     FROM document_versions dv
     LEFT JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     WHERE dv.id IN (${placeholders})`;

// LOS PASOS DE FIRMA DECLARADOS, uno por paso. Antes salian de la cabecera activa resuelta por
// COALESCE de tres subconsultas --la ultima de las cuales miraba la instancia-- y hoy salen de la
// receta, que ya lleva su origen.
//
// ⚠️ UNA FILA POR PASO, NO POR FIRMANTE, y eso es deliberado: `total_signature_steps` del panel sale
// de `length`, asi que agrupar mal INFLA el total que ve el usuario. Lo que un paso con N firmantes
// añade aqui es `signer_count`; quien lo necesita por firmante lee `signature_requests`, que trae una
// fila por turno con SU cargo.
//
// Y no se exigen ni recorrido ni turnos: el panel enseña los pasos de firma PREVISTOS mientras el
// documento todavia esta en entrega. Su gemelo de llenado si arranca en `recorridos`, porque alli
// nunca hubo vista previa.
export const getSignatureWorkflowStepsForDocumentVersions = async (pool, documentVersionIds) => {
  if (!documentVersionIds.length) {
    return [];
  }
  const placeholders = documentVersionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       dv_ctx.document_version_id,
       pd.id,
       pd.orden AS step_order,
       pd.code,
       pd.nombre AS name,
       MIN(pr.slot) AS slot,
       COUNT(pr.id) AS signer_count
     FROM (${contextoDeLaReceta("firma", placeholders)}
     ) dv_ctx
     ${PASOS_DE_LA_RECETA}
     INNER JOIN participantes_declarados pr ON pr.paso_id = pd.id
     GROUP BY dv_ctx.document_version_id, pd.id, pd.orden, pd.code, pd.nombre
     ORDER BY dv_ctx.document_version_id ASC, pd.orden ASC, pd.id ASC`,
    documentVersionIds
  );
  return rows;
};

export const getUserPendingFillRequestsForDefinition = async (pool, userId, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       tu.id,
       tu.solicitado AS requested_at,
       tu.respondido AS responded_at,
       -- SE LLAMABA status_name, Y ERA UNA MENTIRA COMPARTIDA: aqui traia el CODIGO y en el lado
       -- de firma la misma clave traia la ETIQUETA del catalogo. El frontend la leia primero como
       -- codigo, asi que "En progreso" llegaba como "en progreso" y no coincidia con nada --por eso
       -- habia una entrada "en progreso" con espacio en el mapa de tonos--. Una clave, dos
       -- significados. Hoy es lo que es (fase 3 del frente 24).
       tu.estado AS status,
       pd.orden AS step_order,
       tar_dl.display_name AS template_artifact_name,
       ti.id AS document_id,
       dv.id AS document_version_id,
       dv.version_label AS document_version
     FROM turnos tu
     INNER JOIN recorridos r ON r.id = tu.recorrido_id AND r.accion = 'entrega'
     INNER JOIN participantes_declarados pr ON pr.id = tu.participante_id
     INNER JOIN pasos_declarados pd ON pd.id = pr.paso_id
     INNER JOIN document_versions dv ON dv.id = r.document_version_id
     INNER JOIN task_items ti ON ti.id = dv.task_item_id
     INNER JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     WHERE tu.persona_id = ?
       AND t.process_definition_id = ?
       AND LOWER(COALESCE(dv.status, '')) IN (
         'pendiente de llenado',
         'en llenado',
         'en revisión de llenado',
         'observado'
       )
     ORDER BY tu.respondido IS NOT NULL ASC, tu.solicitado DESC, tu.id DESC
     LIMIT 12`,
    [userId, definitionId]
  );
  return rows;
};

export const getAttachmentsForDocumentVersions = async (pool, documentVersionIds) => {
  if (!documentVersionIds.length) {
    return [];
  }
  const placeholders = documentVersionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT id, document_version_id, kind, file_path, file_name, mime_type,
            size_bytes, description, uploaded_by_person_id, sort_order, created_at
     FROM document_attachments
     WHERE document_version_id IN (${placeholders})
     ORDER BY sort_order ASC, id ASC`,
    documentVersionIds
  );
  return rows || [];
};

export const getFillWorkflowStepsForDocumentVersions = async (pool, documentVersionIds) => {
  if (!documentVersionIds.length) {
    return [];
  }
  const placeholders = documentVersionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    // ⚠️ `selection_mode`, `is_required`, `can_reject`, `position_id` y `unit_type_id` NO SALEN, y
    // no es un olvido: se retiraron en la fase 4 del frente 24 --ver §10 del plan--. Las claves que
    // el frontend consume conservan su nombre; lo que cambia es de donde salen.
    //
    // ⚠️ Y EL ORIGEN DE LA RECETA YA NO SE RESUELVE AQUI CON UN `OR`. Lo hacia, y un `OR` no es una
    // prioridad: con receta del entregable Y de la edicion casaban las dos y los pasos salian
    // duplicados. Hoy lo resuelve `PASOS_DE_LA_RECETA`, una sola vez para los dos lectores.
    `SELECT
       r.document_version_id,
       r.estado AS recorrido_estado,
       r.paso_actual AS current_step_order,
       pd.id AS fill_flow_step_id,
       pd.orden AS step_order,
       pr.resolver_type,
       tu.id AS turno_id,
       tu.persona_id AS assigned_person_id,
       tu.manual AS is_manual,
       tu.estado AS request_status,
       tu.solicitado AS requested_at,
       tu.respondido AS responded_at,
       tu.nota_respuesta AS response_note,
       TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS assigned_person_name,
       c.name AS cargo_name,
       u.name AS unit_name
     FROM recorridos r
     INNER JOIN (${contextoDeLaReceta("entrega", placeholders)}
     ) dv_ctx ON dv_ctx.document_version_id = r.document_version_id
     ${PASOS_DE_LA_RECETA}
     INNER JOIN participantes_declarados pr ON pr.paso_id = pd.id
     LEFT JOIN turnos tu ON tu.recorrido_id = r.id AND tu.participante_id = pr.id
     LEFT JOIN persons p ON p.id = COALESCE(tu.persona_id, pr.persona_id)
     LEFT JOIN cargos c ON c.id = pr.cargo_id
     LEFT JOIN units u ON u.id = pr.unit_id
     WHERE r.accion = 'entrega'
     ORDER BY r.document_version_id ASC, pd.orden ASC, pr.orden ASC, tu.id ASC`,
    documentVersionIds
  );
  return rows;
};

// getUserOperationalProcessRows se movio a services/users/UserMenuService.js con la Fase D:
// era de uso exclusivo de getUserMenu.

// getCustomTermType / getActiveGeneralDefinition / resolveUserPositionInUnit se movieron a
// services/tasks/GeneralTaskService.js con la Fase D: eran de uso exclusivo de createGeneralTask.


// ─────────────────────────────────────────────────────────────────────────────────────────────────
// LAS BANDEJAS Y SUS CATÁLOGOS. Movidas desde `controllers/users/user_controler.js` el 2026-10-07
// (F7.2). Mismas consultas; lo que se dejó en el controller es el 403, el 400/404 y la forma de la
// respuesta.
//
// ⚠️ Y SE LES QUITÓ UN `getConnection()` QUE NO HACÍA FALTA. Los cinco manejadores pedían una conexión
// dedicada del pool y NINGUNO abría transacción: `beginTransaction` no aparecía en ninguno. Sin
// transacción, una conexión dedicada y el pool hacen lo mismo, y la dedicada se podía quedar sin
// soltar por cualquier camino que no pasara por el `finally`. Ahora reciben el ejecutor que les den.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// Los entregables que se pueden AÑADIR a una tarea: los de modo replicado o enrutado de su definición.
export const findAddableDeliverables = async (ejecutor, definitionId) => {
  const [rows] = await ejecutor.query(
    `SELECT pdt.id,
            pdt.edicion_id,
            pdt.item_mode,
            pdt.sort_order,
            COALESCE(dl.display_name, dl.code) AS name
     FROM vinculos pdt
     LEFT JOIN ediciones ta ON ta.id = pdt.edicion_id
     LEFT JOIN catalogo_documental dl ON dl.id = ta.catalogo_documental_id
     WHERE pdt.process_definition_id = ?
       AND pdt.item_mode IN ('replicated', 'routed')
     ORDER BY pdt.sort_order ASC, pdt.id ASC`,
    [Number(definitionId)]
  );
  return rows || [];
};

// Buscador de destinatarios. El filtro es opcional y se compone aquí, con la consulta, y no en el
// controller: componerlo allí era dejarle decidir la forma del SQL.
export const findRecipients = async (ejecutor, texto = "") => {
  const q = String(texto || "").trim();
  const params = [];
  let where = "p.is_active = 1";
  if (q) {
    const like = `%${q}%`;
    where +=
      " AND (p.first_name ILIKE ? OR p.last_name ILIKE ? OR d.numero ILIKE ? OR e.direccion ILIKE ? OR CONCAT(p.first_name, ' ', p.last_name) ILIKE ?)";
    params.push(like, like, like, like, like);
  }
  const [rows] = await ejecutor.query(
    `SELECT p.id, d.numero AS cedula, p.first_name, p.last_name, e.direccion AS email,
            CONCAT(p.first_name, ' ', p.last_name) AS full_name
     FROM persons p
     LEFT JOIN emails e ON e.person_id = p.id AND e.principal = 1 AND e.is_active = 1
     LEFT JOIN documentos_identidad d ON d.person_id = p.id AND d.principal = 1 AND d.is_active = 1
     WHERE ${where}
     ORDER BY p.first_name ASC, p.last_name ASC
     LIMIT 25`,
    params
  );
  return rows || [];
};

// El catálogo que necesita el editor de flujo en runtime: unidades y cargos activos.
export const findFlowCatalog = async (ejecutor) => {
  const [units] = await ejecutor.query(
    `SELECT id, name FROM units WHERE is_active = 1 ORDER BY name ASC LIMIT 1000`
  );
  const [cargos] = await ejecutor.query(
    `SELECT id, name FROM cargos WHERE is_active = 1 ORDER BY name ASC LIMIT 500`
  );
  return { units: units || [], cargos: cargos || [] };
};

// Lo que esta persona ENVIÓ: entregables enrutados que ella creó.
export const findRoutedItemsCreatedBy = async (ejecutor, personId) => {
  const [rows] = await ejecutor.query(
    `SELECT
       ti.id,
       ti.title AS label,
       ti.created_at,
       p.id AS process_id,
       p.name AS process_name,
       pdv.id AS definition_id,
       ti.document_status
     FROM task_items ti
     JOIN vinculos pdt
       ON pdt.id = ti.vinculo_id AND pdt.item_mode = 'routed'
     JOIN tasks t ON t.id = ti.task_id
     JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     JOIN processes p ON p.id = pdv.process_id
     WHERE ti.created_by_person_id = ?
     ORDER BY ti.created_at DESC, ti.id DESC
     LIMIT 200`,
    [personId]
  );
  return rows || [];
};

// Subconsultas EXISTS reutilizables: ¿la persona es asignada de llenado / firma del documento del item?
const FILL_EXISTS = `EXISTS (
  SELECT 1 FROM turnos tu
    JOIN recorridos r ON r.id = tu.recorrido_id AND r.accion = 'entrega'
    JOIN document_versions dv ON dv.id = r.document_version_id
   WHERE dv.task_item_id = ti.id AND tu.persona_id = ?
)`;
const SIGN_EXISTS = `EXISTS (
  SELECT 1 FROM turnos tu
    JOIN recorridos r ON r.id = tu.recorrido_id AND r.accion = 'firma'
    JOIN document_versions dv ON dv.id = r.document_version_id
   WHERE dv.task_item_id = ti.id AND tu.persona_id = ?
)`;

// Lo que esta persona RECIBIÓ: un documento es «recibido» si participas en su ENTREGA o en su FIRMA.
// El tercer término era `ti.target_person_id = ?` —el «Para:»—, retirado el 2026-08-23: quien recibe
// el documento firma su recibido, así que ya entra por SIGN_EXISTS.
export const findRoutedItemsReceivedBy = async (ejecutor, personId) => {
  const [rows] = await ejecutor.query(
    `SELECT
       ti.id,
       ti.title AS label,
       ti.created_at,
       ti.created_by_person_id,
       NULLIF(TRIM(CONCAT(COALESCE(sender.first_name, ''), ' ', COALESCE(sender.last_name, ''))), '') AS sender_name,
       p.id AS process_id,
       p.name AS process_name,
       pdv.id AS definition_id,
       ti.document_status,
       ${FILL_EXISTS} AS needs_fill,
       ${SIGN_EXISTS} AS needs_sign
     FROM task_items ti
     JOIN vinculos pdt
       ON pdt.id = ti.vinculo_id AND pdt.item_mode = 'routed'
     JOIN tasks t ON t.id = ti.task_id
     JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     JOIN processes p ON p.id = pdv.process_id
     LEFT JOIN persons sender ON sender.id = ti.created_by_person_id
     WHERE (ti.created_by_person_id IS NULL OR ti.created_by_person_id <> ?)
       AND ( ${FILL_EXISTS} OR ${SIGN_EXISTS} )
     ORDER BY ti.created_at DESC, ti.id DESC
     LIMIT 200`,
    [
      personId, // FILL_EXISTS (select)
      personId, // SIGN_EXISTS (select)
      personId, // created_by <> (where)
      personId, // FILL_EXISTS (where)
      personId, // SIGN_EXISTS (where)
    ]
  );
  return rows || [];
};

// EL ARTEFACTO DE PLANTILLA de un entregable, si esta persona participa en él.
// Movida desde `user_controler.js` (F7.2, 2026-10-07).
//
// ⚠️ El predicado de participación es `accessSubqueryForTaskItem()`, el MISMO que usa el guard, y no
// una copia: la cuarta copia laxa vivió aquí hasta el 2026-08-22 con un comentario que ya admitía
// serlo. Tres parámetros donde había ocho: el id del entregable viaja dos veces —el WHERE y el ancla
// de la subconsulta— y la persona una sola vez.
export const findDeliverableTemplateForUser = async (ejecutor, { taskItemId, definitionId, personId }) => {
  const [rows] = await ejecutor.query(
    `SELECT
       ti.id AS task_item_id,
       tar.generador_id,
       tar_dl.display_name AS template_artifact_name,
       tar.available_formats
     FROM task_items ti
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     INNER JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     WHERE ti.id = ?
       AND t.process_definition_id = ?
       AND EXISTS (
         SELECT 1
         FROM (${accessSubqueryForTaskItem()}) participantes
         WHERE participantes.person_id = ?
       )
     LIMIT 1`,
    [taskItemId, definitionId, taskItemId, personId]
  );
  return rows?.[0] ?? null;
};
