// Acceso a datos (solo LECTURA) de TaskGenerationService: los lookups que alimentan la
// generación de tareas, la materialización de documentos y los flujos de llenado/firma.
// Extraído en la Fase 3. Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// Todas reciben `connection` explícitamente: no abren conexiones ni tocan el pool. Eso
// las hace trasladables tal cual a un repositorio si algún día se separa la capa.
import { applyRecipientPolicy } from "./primitives.js";


export const getTermById = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT id, term_type_id, start_date, end_date
     FROM terms
     WHERE id = ?
     LIMIT 1`,
    [termId]
  );
  return rows[0] || null;
};

export const getActiveAutomaticDefinitions = async (connection, term) => {
  const [rows] = await connection.query(
    `SELECT ranked.id, ranked.process_id, ranked.variation_key, ranked.definition_version
     FROM (
       SELECT
         pdv.id,
         pdv.process_id,
         pdv.variation_key,
         pdv.definition_version,
         ROW_NUMBER() OVER (
           PARTITION BY pdv.process_id, pdv.variation_key
           ORDER BY pdv.effective_from DESC, pdv.id DESC
         ) AS rn
       FROM process_definition_versions pdv
       WHERE pdv.status = 'active'
         AND pdv.effective_from <= ?
         AND (pdv.effective_to IS NULL OR pdv.effective_to >= ?)
     ) AS ranked
     INNER JOIN process_definition_period_types pdp
       ON pdp.process_definition_id = ranked.id
      AND pdp.is_active = 1
      AND pdp.term_type_id = ?
     WHERE ranked.rn = 1
     ORDER BY ranked.process_id ASC, ranked.variation_key ASC`,
    [term.end_date, term.start_date, term.term_type_id]
  );
  return rows;
};

export const getTargetRulesMap = async (connection, termStart, termEnd) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       process_definition_id,
       unit_scope_type,
       unit_id,
       unit_type_id,
       cargo_id,
       position_id,
       recipient_policy,
       priority
     FROM process_target_rules
     WHERE is_active = 1
       AND (effective_from IS NULL OR effective_from <= ?)
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY process_definition_id, priority ASC, id ASC`,
    [termEnd, termStart]
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, []);
    }
    map.get(row.process_definition_id).push(row);
  });
  return map;
};

export const getExecutableTemplatesMap = async (connection) => {
  const [rows] = await connection.query(
    `SELECT
       pdt.id,
       pdt.process_definition_id,
       pdt.template_artifact_id,
       pdt.sort_order,
       pdt.item_mode
     FROM process_definition_templates pdt
     ORDER BY pdt.process_definition_id ASC, pdt.sort_order ASC, pdt.id ASC`
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, []);
    }
    map.get(row.process_definition_id).push(row);
  });
  return map;
};

export const getExistingAutomaticTasksMap = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT t.id, t.process_definition_id, t.process_run_id,
            t.scope_unit_id AS responsible_unit_id
     FROM tasks t
     WHERE t.term_id = ?`,
    [termId]
  );
  // Map<def_id, Map<unit_id, task>>  (unit_id=0 for legacy tasks with no responsible position)
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, new Map());
    }
    const unitKey = row.responsible_unit_id ?? 0;
    const byUnit = map.get(row.process_definition_id);
    if (!byUnit.has(unitKey)) {
      byUnit.set(unitKey, {
        id: row.id,
        process_run_id: row.process_run_id,
        process_definition_id: row.process_definition_id
      });
    }
  });
  return map;
};

export const getExistingTasksByUnitForDefinition = async (connection, definitionId, termId) => {
  const [rows] = await connection.query(
    `SELECT t.id, t.process_run_id,
            t.scope_unit_id AS responsible_unit_id
     FROM tasks t
     WHERE t.process_definition_id = ? AND t.term_id = ?`,
    [definitionId, termId]
  );
  const byUnit = new Map();
  rows.forEach((row) => {
    const unitKey = row.responsible_unit_id ?? 0;
    if (!byUnit.has(unitKey)) {
      byUnit.set(unitKey, { id: row.id, process_run_id: row.process_run_id });
    }
  });
  return byUnit;
};

export const getActiveRunForDefinitionTerm = async (connection, definitionId, termId) => {
  const [rows] = await connection.query(
    `SELECT id, run_mode
     FROM process_runs
     WHERE process_definition_id = ? AND term_id <=> ? AND status = 'active'
     ORDER BY id DESC
     LIMIT 1`,
    [definitionId, termId]
  );
  return rows?.[0] || null;
};

export const getDocumentVersionFillContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.document_id,
       dv.status AS document_version_status,
       ti.document_status,
       d.task_item_id,
       ti.process_definition_template_id,
       ti.assigned_person_id AS task_item_assigned_person_id,
       ti.responsible_position_id AS task_item_responsible_position_id,
       ti.created_by_person_id AS item_created_by_person_id,
       COALESCE(ti.target_unit_id, up_item.unit_id, t.scope_unit_id) AS scope_unit_id,
       COALESCE(u_target.unit_type_id, u_item.unit_type_id, u_task_scope.unit_type_id) AS scope_unit_type_id
     FROM document_versions dv
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN task_items ti ON ti.id = d.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     LEFT JOIN units u_item ON u_item.id = up_item.unit_id
     LEFT JOIN units u_target ON u_target.id = ti.target_unit_id
     LEFT JOIN units u_task_scope ON u_task_scope.id = t.scope_unit_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] || null;
};

// Tres escalones, por PRIORIDAD y no por «qué columna está rellena». El orden importa porque una
// misma fila puede llevar dos portadores a la vez: el flujo de runtime que escribe
// `materializeRuntimeFlowForTaskItem` (documents.js:248) lleva `process_definition_template_id` Y
// `task_item_id`. Por eso cada escalón exige NULL en los portadores de los escalones anteriores: sin
// ese `IS NULL`, el flujo privado de un envío se le serviría a cualquier otro entregable del mismo
// vínculo. Los escalones:
//   1. del ENTREGABLE   (`task_item_id`)                — flujo definido en runtime
//   2. del VÍNCULO      (`process_definition_template_id`) — flujo autorado para esa configuración
//   3. de la PLANTILLA  (`template_artifact_id`)        — flujo del entregable, compartido por todas
//      las configuraciones donde esté enlazado (§0.8 del plan maestro)
export const getActiveFillFlowTemplateForDefinitionTemplate = async (
  connection,
  processDefinitionTemplateId,
  taskItemId = null
) => {
  // routed: flujo POR INSTANCIA (definido en runtime) tiene prioridad.
  if (taskItemId) {
    const [inst] = await connection.query(
      `SELECT id FROM fill_flow_templates
       WHERE task_item_id = ? AND is_active = 1
       ORDER BY id DESC LIMIT 1`,
      [taskItemId]
    );
    if (inst?.[0]) {
      return inst[0];
    }
  }
  // Flujo autorado del vínculo (single/replicated): excluye los por‑instancia.
  const [rows] = await connection.query(
    `SELECT id
     FROM fill_flow_templates
     WHERE process_definition_template_id = ?
       AND task_item_id IS NULL
       AND is_active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [processDefinitionTemplateId]
  );
  if (rows?.[0]) {
    return rows[0];
  }
  // Flujo de la PLANTILLA que el vínculo enlaza. La subconsulta devuelve NULL si el vínculo no
  // existe o no tiene artifact, y `columna = NULL` no casa con nada: no hace falta guarda extra.
  const [byArtifact] = await connection.query(
    `SELECT id
     FROM fill_flow_templates
     WHERE template_artifact_id = (
             SELECT template_artifact_id
             FROM process_definition_templates
             WHERE id = ?
           )
       AND process_definition_template_id IS NULL
       AND task_item_id IS NULL
       AND is_active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [processDefinitionTemplateId]
  );
  return byArtifact?.[0] || null;
};

export const getFillFlowSteps = async (connection, fillFlowTemplateId) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       step_order,
       resolver_type,
       assigned_person_id,
       unit_scope_type,
       unit_id,
       unit_type_id,
       relation_type_id,
       cargo_id,
       position_id,
       selection_mode
     FROM fill_flow_steps
     WHERE fill_flow_template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [fillFlowTemplateId]
  );
  return rows;
};

export const resolveCurrentPersonsForPosition = async (connection, positionId) => {
  if (!positionId) {
    return [];
  }
  const [rows] = await connection.query(
    `SELECT DISTINCT pa.person_id
     FROM position_assignments pa
     WHERE pa.position_id = ?
       AND pa.is_current = 1
       AND pa.person_id IS NOT NULL
     ORDER BY pa.person_id ASC`,
    [positionId]
  );
  return rows.map((row) => Number(row.person_id)).filter(Boolean);
};

export const getPositionsForRule = async (connection, rule) => {
  const useExactPosition = rule.position_id || rule.recipient_policy === "exact_position";
  if (useExactPosition && !rule.position_id) {
    return [];
  }

  const params = [];
  let query = `
    SELECT DISTINCT
      up.id AS position_id,
      up.unit_id,
      up.is_unit_head,
      pa.person_id,
      up.slot_no
    FROM unit_positions up
    INNER JOIN units u ON u.id = up.unit_id
    LEFT JOIN position_assignments pa
      ON pa.position_id = up.id
     AND pa.is_current = 1
    WHERE up.is_active = 1
      AND u.is_active = 1`;

  if (useExactPosition) {
    query += "\n      AND up.id = ?";
    params.push(rule.position_id);
  } else {
    if (rule.cargo_id) {
      query += "\n      AND up.cargo_id = ?";
      params.push(rule.cargo_id);
    }

    const useSubtree = rule.unit_scope_type === "unit_subtree";

    if (useSubtree) {
      if (!rule.unit_id) {
        return [];
      }
      query = `
        WITH RECURSIVE scoped_units AS (
          SELECT id
          FROM units
          WHERE id = ?
          UNION ALL
          SELECT ur.child_unit_id
          FROM unit_relations ur
          INNER JOIN relation_unit_types rt
            ON rt.id = ur.relation_type_id
           AND rt.code = 'org'
          INNER JOIN scoped_units su ON su.id = ur.parent_unit_id
        )
        ${query}
          AND up.unit_id IN (SELECT id FROM scoped_units)`;
      params.unshift(rule.unit_id);
    } else if (rule.unit_scope_type === "unit_exact") {
      if (!rule.unit_id) {
        return [];
      }
      query += "\n      AND up.unit_id = ?";
      params.push(rule.unit_id);
    } else if (rule.unit_scope_type === "unit_type") {
      if (!rule.unit_type_id) {
        return [];
      }
      query += "\n      AND u.unit_type_id = ?";
      params.push(rule.unit_type_id);
    }
  }

  query += "\n    ORDER BY up.unit_id ASC, up.slot_no ASC, up.id ASC";
  const [rows] = await connection.query(query, params);
  return applyRecipientPolicy(rows, rule.recipient_policy, rule.position_id);
};

export const getExistingTaskItemTemplateIds = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT process_definition_template_id
     FROM task_items
     WHERE task_id = ?
       AND origin_kind = 'process_defined'
       AND responsible_position_id IS NULL`,
    [taskId]
  );
  return new Set(rows.map((row) => Number(row.process_definition_template_id)));
};

export const getExistingTaskItemTargetKeys = async (connection, taskId) => {
  const [rows] = await connection.query(
    // La clave de idempotencia es la MISMA que la identidad del entregable: tarea, plantilla y
    // QUIEN LO PRODUCE. Antes iba por los dos destinos —el receptor—, que es el eje equivocado
    // desde que el dueño decidio «un entregable por persona que lo entrega» (2026-08-23).
    `SELECT
       process_definition_template_id,
       COALESCE(responsible_position_id, 0) AS responsible_position_id
     FROM task_items
     WHERE task_id = ?
       AND origin_kind = 'process_defined'`,
    [taskId]
  );
  return new Set(rows.map((row) => [
    Number(row.process_definition_template_id || 0),
    Number(row.responsible_position_id || 0)
  ].join(":")));
};

// Fila que consume `ensureDocumentForTaskItem`. `responsible_position_id` es el DEL ENTREGABLE
// (`ti.`), no el de la tarea: es lo que `resolveOwnerPersonIdForTaskItem` cree estar leyendo cuando
// busca el ocupante en `task_assignments`. Proyectar `t.responsible_position_id` eclipsaba la
// columna homónima del ítem y le daba el puesto de la TAREA, con lo que todo entregable dirigido a
// un puesto distinto del de su tarea heredaba el dueño equivocado. El otro alimentador del mismo
// resolver (`GeneralTaskService.loadDerivedTaskItemRow`) siempre proyectó `ti.`; esta es la forma
// que los iguala. El respaldo a nivel de tarea ya existe aguas abajo (rama 4 del resolver, y rama 2
// de `resolveOriginUnitIdForTaskItem`), así que aquí no hace falta ningún COALESCE.
export const getTaskItemsForDocumentMaterialization = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT
       ti.id,
       ti.task_id,
       ti.process_definition_template_id,
       ti.template_artifact_id,
       ti.assigned_person_id,
       ti.target_unit_id,
       ti.responsible_position_id,
       tar_dl.display_name AS template_artifact_name
     FROM task_items ti
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     WHERE ti.task_id = ?
     ORDER BY ti.sort_order ASC, ti.id ASC`,
    [taskId]
  );
  return rows;
};

// `getTaskAssignmentTargets` VIVIO AQUI hasta el 2026-08-23. Leia `task_assignments` para devolver
// los puestos que `launch.js` acababa de escribir en ella dos lineas antes. Con la tabla retirada,
// `resolveTaskTargetsForDefinition` devuelve esos mismos puestos sin pasar por la base.
