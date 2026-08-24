// Acceso a datos (solo LECTURA) de user_controler.js: las queries que alimentan el
// panel operativo, el centro de documentos, el centro de firmas y las bandejas.
// Extraído en la Fase 3 (God Object #2). Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-user-controler-2026-07.md
//
// Todas reciben `pool`/`connection` explícitamente: no capturan estado de módulo ni
// abren conexiones propias. Por eso este módulo NO importa nada — es el candidato
// natural a promoverse a services/users/UserWorkspaceRepository.js cuando se corrija
// la fuga de capa (SQL crudo en un controller).
//
// OJO (bug histórico, ver commit a199a28): en PostgreSQL, un SELECT DISTINCT exige que
// TODA columna del ORDER BY esté proyectada. MySQL no. Si añades un ORDER BY aquí,
// proyecta la columna o tendrás un 500.

import {
  accessSubqueryCorrelated,
  accessSubqueryForTaskItem,
} from "../../services/documents/DeliverableAccessService.js";

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
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     LEFT JOIN terms trm ON trm.id = t.term_id
     LEFT JOIN term_types tt ON tt.id = trm.term_type_id
     LEFT JOIN units origin_unit ON origin_unit.id = ti.origin_unit_id
     LEFT JOIN unit_positions scope_position ON scope_position.id = ti.responsible_position_id
     LEFT JOIN units scope_unit ON scope_unit.id = scope_position.unit_id
     LEFT JOIN (
       SELECT
         dff.document_version_id,
         SUM(CASE WHEN fr.responded_at IS NULL THEN 1 ELSE 0 END) AS pending_fill_count
       FROM document_fill_flows dff
       LEFT JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
       GROUP BY dff.document_version_id
     ) fill_stats ON fill_stats.document_version_id = dv.id
     LEFT JOIN (
       SELECT
         sfi.document_version_id,
         SUM(CASE WHEN sr.responded_at IS NULL THEN 1 ELSE 0 END) AS pending_signature_count
       FROM signature_flow_instances sfi
       LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
       GROUP BY sfi.document_version_id
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
       sr.id AS signature_request_id,
       sr.requested_at,
       srs.code AS signature_request_status_code,
       srs.name AS signature_request_status_name,
       sfs.step_order,
       sfs.name AS step_name,
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
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
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
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     LEFT JOIN terms trm ON trm.id = t.term_id
     LEFT JOIN term_types tt ON tt.id = trm.term_type_id
     LEFT JOIN units origin_unit ON origin_unit.id = ti.origin_unit_id
     LEFT JOIN unit_positions scope_position ON scope_position.id = ti.responsible_position_id
     LEFT JOIN units scope_unit ON scope_unit.id = scope_position.unit_id
     LEFT JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     WHERE sr.assigned_person_id = ?
       AND sr.responded_at IS NULL
       AND LOWER(COALESCE(dv.status, '')) IN (
         'listo para firma',
         'pendiente de firma',
         'firmado parcial'
       )
     ORDER BY sort_date DESC, sr.requested_at DESC, sr.id DESC`,
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
       tar.id AS template_artifact_id,
       tar_dl.display_name AS template_artifact_name,
       tar.is_active AS template_artifact_active,
       COUNT(DISTINCT sft.id) AS signature_flow_count
     FROM process_definition_templates pdt
     INNER JOIN template_artifacts tar ON tar.id = pdt.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     LEFT JOIN signature_flow_templates sft
       ON sft.process_definition_template_id = pdt.id
      AND sft.is_active = 1
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
     FROM template_artifacts ta
     INNER JOIN deliverables d ON d.id = ta.deliverable_id
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
           INNER JOIN document_fill_flows dff ON dff.document_version_id = dv.id
           INNER JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
           WHERE ti.task_id = t.id
             AND fr.assigned_person_id = ?
         )
         OR EXISTS (
           SELECT 1
           FROM task_items ti
           INNER JOIN document_versions dv ON dv.task_item_id = ti.id
           INNER JOIN signature_flow_instances sfi ON sfi.document_version_id = dv.id
           INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
           WHERE ti.task_id = t.id
             AND sr.assigned_person_id = ?
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
       ti.process_definition_template_id,
       ti.template_artifact_id,
       ti.origin_kind,
       ti.title,
       tar_dl.template_seed_id,
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
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     LEFT JOIN process_definition_templates pdt ON pdt.id = ti.process_definition_template_id
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
         SUM(CASE WHEN sr.responded_at IS NULL THEN 1 ELSE 0 END) AS pending_signature_count
       FROM signature_flow_instances sfi
       INNER JOIN document_versions dv2 ON dv2.id = sfi.document_version_id
       LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
       WHERE LOWER(COALESCE(dv2.status, '')) IN (
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
         CASE WHEN fr.responded_at IS NOT NULL THEN 1 ELSE 0 END AS has_past_fill,
         0 AS has_past_signature
       FROM document_versions dv
       INNER JOIN document_fill_flows dff ON dff.document_version_id = dv.id
       INNER JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
       WHERE dv.task_item_id IN (${placeholders})
         AND fr.assigned_person_id = ?

       UNION ALL

       SELECT
         dv.task_item_id,
         0 AS has_past_fill,
         CASE WHEN sr.responded_at IS NOT NULL THEN 1 ELSE 0 END AS has_past_signature
       FROM document_versions dv
       INNER JOIN signature_flow_instances sfi ON sfi.document_version_id = dv.id
       INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
       WHERE dv.task_item_id IN (${placeholders})
         AND sr.assigned_person_id = ?
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
       ti.process_definition_template_id,
       ti.template_artifact_id,
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
     LEFT JOIN process_definition_templates pdt ON pdt.id = ti.process_definition_template_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
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
       sr.requested_at,
       sr.responded_at,
       srs.name AS status_name,
       sfs.step_order,       tar_dl.display_name AS template_artifact_name,
       ti.id AS document_id,
       dv.id AS document_version_id,
       dv.version_label AS document_version
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
     INNER JOIN task_items ti ON ti.id = dv.task_item_id
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN process_definition_templates pdt ON pdt.id = ti.process_definition_template_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     LEFT JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN signature_flow_steps sfs ON sfs.id = sr.step_id     WHERE sr.assigned_person_id = ?
       AND t.process_definition_id = ?
       AND LOWER(COALESCE(dv.status, '')) IN (
         'listo para firma',
         'pendiente de firma',
         'firmado',
         'firmado parcial',
         'firmado completo'
       )
     ORDER BY sr.responded_at IS NOT NULL ASC, sr.requested_at DESC, sr.id DESC
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
       sr.assigned_person_id,
       sr.requested_at,
       sr.responded_at,
       srs.code AS request_status_code,
       srs.name AS status_name,
       sfs.step_order,       c.name AS cargo_name,
       tar_dl.display_name AS template_artifact_name,
       ti.id AS document_id,
       dv.id AS document_version_id,
       dv.version_label AS document_version,
       TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS assigned_person_name
     FROM signature_flow_instances sfi
     INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
     INNER JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
     LEFT JOIN persons p ON p.id = sr.assigned_person_id
     LEFT JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN signature_flow_steps sfs ON sfs.id = sr.step_id     LEFT JOIN cargos c ON c.id = sfs.required_cargo_id
     WHERE sfi.document_version_id IN (${placeholders})
     ORDER BY sfi.document_version_id ASC, sfs.step_order ASC, sr.id ASC`,
    documentVersionIds
  );
  return rows;
};

export const getSignatureWorkflowStepsForDocumentVersions = async (pool, documentVersionIds) => {
  if (!documentVersionIds.length) {
    return [];
  }
  const placeholders = documentVersionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       dv_context.document_version_id,
       sfs.id,
       sfs.template_id,
       sfs.step_order,
       sfs.code,
       sfs.name,
       sfs.slot,
       sfs.resolver_type,
       sfs.selection_mode,
       sfs.approval_mode,
       sfs.required_signers_min,
       sfs.required_signers_max,
       sfs.is_required,
       c.code AS cargo_code,
       c.name AS cargo_name
     FROM (
       SELECT
         dv.id AS document_version_id,
         COALESCE(
           (
             SELECT sft.id
             FROM task_items ti2
             INNER JOIN signature_flow_templates sft
               ON sft.process_definition_template_id = ti2.process_definition_template_id
              AND sft.is_active = 1
             WHERE ti2.id = dv.task_item_id
             ORDER BY sft.id DESC
             LIMIT 1
           ),
           (
             SELECT sfi.template_id
             FROM signature_flow_instances sfi
             WHERE sfi.document_version_id = dv.id
             ORDER BY sfi.id DESC
             LIMIT 1
           )
         ) AS signature_template_id
       FROM document_versions dv
       WHERE dv.id IN (${placeholders})
     ) dv_context
     INNER JOIN signature_flow_steps sfs ON sfs.template_id = dv_context.signature_template_id     LEFT JOIN cargos c ON c.id = sfs.required_cargo_id
     ORDER BY dv_context.document_version_id ASC, sfs.step_order ASC, sfs.id ASC`,
    documentVersionIds
  );
  return rows;
};

export const getUserPendingFillRequestsForDefinition = async (pool, userId, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       fr.id,
       fr.requested_at,
       fr.responded_at,
       fr.status AS status_name,
       ffs.step_order,
       tar_dl.display_name AS template_artifact_name,
       ti.id AS document_id,
       dv.id AS document_version_id,
       dv.version_label AS document_version
     FROM fill_requests fr
     INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
     INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
     INNER JOIN document_versions dv ON dv.id = dff.document_version_id
     INNER JOIN task_items ti ON ti.id = dv.task_item_id
     INNER JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     WHERE fr.assigned_person_id = ?
       AND t.process_definition_id = ?
       AND LOWER(COALESCE(dv.status, '')) IN (
         'pendiente de llenado',
         'en llenado',
         'en revisión de llenado',
         'observado'
       )
     ORDER BY fr.responded_at IS NOT NULL ASC, fr.requested_at DESC, fr.id DESC
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
    `SELECT
       dff.document_version_id,
       dff.status AS fill_flow_status,
       dff.current_step_order,
       ffs.id AS fill_flow_step_id,
       ffs.step_order,
       ffs.resolver_type,
       ffs.selection_mode,
       ffs.is_required,
       ffs.can_reject,
       fr.id AS fill_request_id,
       fr.assigned_person_id,
       fr.is_manual,
       fr.status AS request_status,
       fr.requested_at,
       fr.responded_at,
       fr.response_note,
       TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS assigned_person_name,
       c.name AS cargo_name,
       up.title AS position_title,
       u.name AS unit_name,
       ut.name AS unit_type_name
     FROM document_fill_flows dff
     INNER JOIN fill_flow_steps ffs ON ffs.fill_flow_template_id = dff.fill_flow_template_id
     LEFT JOIN fill_requests fr
       ON fr.document_fill_flow_id = dff.id
      AND fr.fill_flow_step_id = ffs.id
     LEFT JOIN persons p ON p.id = COALESCE(fr.assigned_person_id, ffs.assigned_person_id)
     LEFT JOIN cargos c ON c.id = ffs.cargo_id
     LEFT JOIN unit_positions up ON up.id = ffs.position_id
     LEFT JOIN units u ON u.id = ffs.unit_id
     LEFT JOIN unit_types ut ON ut.id = ffs.unit_type_id
     WHERE dff.document_version_id IN (${placeholders})
     ORDER BY dff.document_version_id ASC, ffs.step_order ASC, fr.id ASC`,
    documentVersionIds
  );
  return rows;
};

// getUserOperationalProcessRows se movio a services/users/UserMenuService.js con la Fase D:
// era de uso exclusivo de getUserMenu.

// getCustomTermType / getActiveGeneralDefinition / resolveUserPositionInUnit se movieron a
// services/tasks/GeneralTaskService.js con la Fase D: eran de uso exclusivo de createGeneralTask.

