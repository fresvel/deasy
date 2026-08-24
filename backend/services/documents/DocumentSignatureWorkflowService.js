import {
  normalizeDocumentVersionStatus,
  transitionDocumentVersionState,
} from "./DocumentStateService.js";
import { addDocumentObservation } from "./DocumentObservationService.js";
import {
  SIGNATURE_REQUEST_STATUS,
  SIGNATURE_STATUS,
  getSignatureStatusIdByCode,
  getSignatureRequestStatusIdByCode,
} from "./DocumentWorkflowCatalog.js";

const normalizeCode = (value) => String(value || "").trim().toLowerCase();
const SIGN_ACTIVE = new Set([SIGNATURE_REQUEST_STATUS.IN_PROGRESS]);
const SIGN_APPROVED = new Set([SIGNATURE_REQUEST_STATUS.COMPLETED]);
const SIGN_REJECTED = new Set([SIGNATURE_REQUEST_STATUS.REJECTED, SIGNATURE_REQUEST_STATUS.CANCELLED]);
const DOC_SIGNATURE_SUCCESS = new Set([SIGNATURE_STATUS.SIGNED]);
const SIGNATURE_APPROVAL_AND = "and";
const SIGNATURE_APPROVAL_OR = "or";
const SIGNATURE_APPROVAL_AT_LEAST = "at_least";

const getDocumentVersionSignatureContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.status AS document_version_status,
       dv.working_file_path,
       dv.task_item_id,
       ti.task_id,
       ti.assigned_person_id AS task_item_assigned_person_id,
       ti.process_definition_template_id,
       ti.responsible_position_id AS task_item_responsible_position_id,
       t.process_definition_id,
       ti.created_by_person_id AS item_created_by_person_id,
       COALESCE(up_item.unit_id, t.scope_unit_id) AS scope_unit_id,
       COALESCE(u_item.unit_type_id, u_task_scope.unit_type_id) AS scope_unit_type_id
     FROM document_versions dv
     LEFT JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     LEFT JOIN template_artifacts tar ON tar.id = dv.template_artifact_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     LEFT JOIN units u_item ON u_item.id = up_item.unit_id
     LEFT JOIN units u_task_scope ON u_task_scope.id = t.scope_unit_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] || null;
};

const shouldInferSignatureFlowForContext = (context) => {
  if (!context?.process_definition_template_id) {
    return false;
  }

  // usage_role attachment/support y artifact_origin deprecados como gate: toda plantilla de proceso
  // (siempre usage_role='primary') puede tener flujo de firma. Las adjunciones ad-hoc van por
  // document_attachments y no llegan aquí (no crean task_items con process_definition_template_id).
  return true;
};

// Gemelo de `getActiveFillFlowTemplateForDefinitionTemplate` (generation/queries.js): tres escalones
// por PRIORIDAD, no por «qué columna está rellena». Una misma fila puede llevar dos portadores a la
// vez —el flujo de runtime que escribe `materializeRuntimeFlowForTaskItem` (generation/documents.js:278)
// lleva `process_definition_template_id` Y `task_item_id`—, así que cada escalón exige NULL en los
// portadores de los anteriores. Los escalones:
//   1. del ENTREGABLE   (`task_item_id`)                   — flujo definido en runtime
//   2. del VÍNCULO      (`process_definition_template_id`) — flujo autorado para esa configuración
//   3. de la PLANTILLA  (`template_artifact_id`)           — flujo del entregable, compartido por
//      todas las configuraciones donde esté enlazado (§0.8 del plan maestro)
// Se exporta solo para poder probar la prioridad con un unitario; el consumidor real es de aquí.
export const getActiveSignatureFlowTemplateForDefinitionTemplate = async (
  connection,
  processDefinitionTemplateId,
  taskItemId = null
) => {
  // routed: flujo POR INSTANCIA tiene prioridad.
  if (taskItemId) {
    const [inst] = await connection.query(
      `SELECT id FROM signature_flow_templates
       WHERE task_item_id = ? AND is_active = 1
       ORDER BY id DESC LIMIT 1`,
      [taskItemId]
    );
    if (inst?.[0]) {
      return inst[0];
    }
  }
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_flow_templates
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
     FROM signature_flow_templates
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

// Normaliza la lista de firmantes (columna JSON `signers`) a la forma camelCase que consumen los resolutores.
// Mantiene `selection_mode` (snake) además de `selectionMode` porque la resolución por cargo lo lee así.
//
// ⚠️ ESTE ES EL AGUJERO DEL CATÁLOGO, y explica por qué este fichero conserva resolutores que su
// gemela de entrega (`admin/generation/assignees.js`) ya retiró. `normaliza` aquí significa cambiar
// de convención de nombres, NO validar: `resolverType` y `unitScopeType` salen del JSONB tal cual
// vengan, sin pasar por `SIGNATURE_RESOLVER_TYPES` ni `SIGNATURE_UNIT_SCOPE_TYPES`.
//
// El `CHECK` del sub-paso 8 del §0.8 cierra las COLUMNAS `resolver_type` y `unit_scope_type`, y una
// columna JSONB no la cubre ningún `CHECK`. Además, `copySignatureFlowSteps` (`templates/flowRows.js`)
// copia `signers` VERBATIM al versionar, así que un valor retirado que ya viviera en una base
// desplegada no lo para el arranque —el `ADD CONSTRAINT` solo valida las columnas— y se propaga solo
// a cada versión nueva. Por eso `document_owner`, `position` y los ámbitos `context_subtree` /
// `context_ancestor_type` siguen resolviéndose más abajo: ahí NO son ramas muertas.
//
// Ningún productor VIVO puede emitirlos: los tres escritores de `signers` son `normalizeSignatureSteps`
// (que sí filtra contra `SIGNATURE_RESOLVER_TYPES`), `materializeRuntimeFlowForTaskItem` (solo emite
// `cargo_in_scope` y `specific_person`) y la copia de versionado. Lo que queda vivo es el legado.
//
// QUÉ CERRARÍA EL AGUJERO —y permitiría entonces recortar los `case`—: filtrar aquí contra los dos
// catálogos de `templates/workflows.js`, y una migración que reescriba el JSONB de las filas ya
// desplegadas. Las dos cosas, y en ese orden; solo el filtro dejaría pasos legítimos sin firmante.
const parseStepSigners = (value) => {
  let arr = value;
  if (typeof value === "string") {
    try { arr = JSON.parse(value); } catch { arr = null; }
  }
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr.map((s) => {
    const selectionMode = String(s?.selectionMode || s?.selection_mode || "auto_all").trim() || "auto_all";
    return {
      resolverType: String(s?.resolverType || s?.type || "cargo_in_scope").trim() || "cargo_in_scope",
      assignedPersonId: s?.assignedPersonId || s?.person_id ? Number(s.assignedPersonId || s.person_id) : null,
      unitScopeType: String(s?.unitScopeType || s?.unit_scope_type || "context_exact").trim() || "context_exact",
      unitId: s?.unitId || s?.unit_id ? Number(s.unitId || s.unit_id) : null,
      unitTypeId: s?.unitTypeId || s?.unit_type_id ? Number(s.unitTypeId || s.unit_type_id) : null,
      positionId: s?.positionId || s?.position_id ? Number(s.positionId || s.position_id) : null,
      requiredCargoId: s?.requiredCargoId || s?.cargo_id ? Number(s.requiredCargoId || s.cargo_id) : null,
      selectionMode,
      selection_mode: selectionMode
    };
  });
};

// Construye un firmante a partir de las columnas de resolutor del propio paso (pasos legacy sin lista signers).
const signerFromStepColumns = (step) => ({
  resolverType: step.resolverType,
  assignedPersonId: step.assignedPersonId,
  unitScopeType: step.unitScopeType,
  unitId: step.unitId,
  unitTypeId: step.unitTypeId,
  positionId: step.positionId,
  requiredCargoId: step.requiredCargoId,
  selectionMode: step.selectionMode,
  selection_mode: step.selectionMode
});

// `anchor_refs` NO se selecciona, y no es un olvido (§0.6, cierre del censo de fósiles). Era el
// predecesor muerto de `slot`: se escribe siempre `[]`, y lo que aquí se leía sólo servía para
// rellenar un campo `anchorRefs` del paso que NADIE aguas abajo consultaba —medido: cero lectores en
// todo el backend—. Quien coloca hoy la firma es `slot`, vía `{{ signatures.<slot>.token }}`.
//
// La COLUMNA sigue en `signature_flow_steps` a propósito: está expuesta en el CRUD genérico
// (`config/sqlTables.js`) y su nombre aparece en los goldens de `admin_crud`, así que soltarla es un
// cambio de contrato —y de esquema— y no la retirada de una rama muerta. Lo que la mataría: quitarla
// de `sqlTables.js`, recapturar esos goldens y un `ALTER TABLE ... DROP COLUMN IF EXISTS` idempotente,
// porque un `DROP COLUMN` no se reaplica con `CREATE TABLE IF NOT EXISTS`.
const getSignatureFlowSteps = async (connection, signatureFlowTemplateId) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       step_order,
       code,
       name,
       slot,
       resolver_type,
       assigned_person_id,
       unit_scope_type,
       unit_id,
       unit_type_id,
       position_id,
       required_cargo_id,
       selection_mode,
       approval_mode,
       required_signers_min,
       required_signers_max,
       is_required,
       signers
     FROM signature_flow_steps
     WHERE template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [signatureFlowTemplateId]
  );
  return rows.map((row) => {
    const step = {
      id: row.id,
      stepOrder: Number(row.step_order || 0),
      code: String(row.code || "").trim() || null,
      name: String(row.name || "").trim() || null,
      slot: String(row.slot || "").trim() || null,
      resolverType: String(row.resolver_type || "cargo_in_scope").trim() || "cargo_in_scope",
      assignedPersonId: row.assigned_person_id ? Number(row.assigned_person_id) : null,
      unitScopeType: String(row.unit_scope_type || "context_exact").trim() || "context_exact",
      unitId: row.unit_id ? Number(row.unit_id) : null,
      unitTypeId: row.unit_type_id ? Number(row.unit_type_id) : null,
      positionId: row.position_id ? Number(row.position_id) : null,
      requiredCargoId: row.required_cargo_id ? Number(row.required_cargo_id) : null,
      selectionMode: String(row.selection_mode || "auto_all").trim() || "auto_all",
      approvalMode: String(row.approval_mode || SIGNATURE_APPROVAL_AND).trim().toLowerCase() || SIGNATURE_APPROVAL_AND,
      requiredSignersMin: row.required_signers_min !== null && row.required_signers_min !== undefined
        ? Number(row.required_signers_min)
        : null,
      requiredSignersMax: row.required_signers_max !== null && row.required_signers_max !== undefined
        ? Number(row.required_signers_max)
        : null,
      isRequired: row.is_required ? Number(row.is_required) : 0
    };
    // Multi-firmante: lista de resolutores. Fallback (pasos legacy sin `signers`): el propio paso = 1 firmante.
    const parsed = parseStepSigners(row.signers);
    step.signers = parsed.length ? parsed : [signerFromStepColumns(step)];
    return step;
  });
};

const resolveSignatureTemplateStepsForContext = async (connection, signatureFlowTemplateId, context) => {
  const steps = await getSignatureFlowSteps(connection, signatureFlowTemplateId);
  if (!steps.length) {
    return {
      steps: [],
      unresolvedRequiredSteps: [],
    };
  }

  const unresolvedRequiredSteps = [];
  const resolvedSteps = [];
  for (const step of steps) {
    const resolverType = String(step.resolverType || "cargo_in_scope").trim();
    const assignees = await resolveSignatureStepAssignees(connection, step, context);
    if (
      Number(step.isRequired) === 1
      && !assignees.length
      && resolverType !== "manual_pick"
      && resolverType !== "manual"
    ) {
      unresolvedRequiredSteps.push({
        stepOrder: Number(step.stepOrder),
        resolverType,
        reason: "no_assignees",
      });
    }
    resolvedSteps.push({
      ...step,
      step_order: Number(step.stepOrder || 0),
      selection_mode: step.selectionMode || null,
      resolverType,
      assignees,
    });
  }

  return {
    steps: resolvedSteps,
    unresolvedRequiredSteps,
  };
};

const getSignaturePendingStatusId = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_request_statuses
     WHERE LOWER(code) = ?
     ORDER BY id ASC
     LIMIT 1`,
    [SIGNATURE_REQUEST_STATUS.PENDING]
  );
  return rows?.[0] ? Number(rows[0].id) : null;
};

const resolveScopeForStep = (step, context) => {
  const unitScopeType = String(step?.unitScopeType || "context_exact");
  const contextUnitId = context?.scope_unit_id ? Number(context.scope_unit_id) : null;
  const contextUnitTypeId = context?.scope_unit_type_id ? Number(context.scope_unit_type_id) : null;
  const explicitUnitId = step?.unitId ? Number(step.unitId) : null;
  const explicitUnitTypeId = step?.unitTypeId ? Number(step.unitTypeId) : null;

  return {
    unitScopeType,
    unitId:
      explicitUnitId
      || (unitScopeType === "context_exact" || unitScopeType === "context_subtree" || unitScopeType === "context_ancestor_type"
        ? contextUnitId
        : null),
    unitTypeId:
      explicitUnitTypeId
      || (unitScopeType === "unit_type" ? contextUnitTypeId : null),
    cargoId: step?.requiredCargoId ? Number(step.requiredCargoId) : null,
  };
};

const resolveCurrentPersonsForPosition = async (connection, positionId) => {
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

// Se exporta solo para poder probar el ORDEN de los parámetros con un unitario, mismo criterio que
// `getActiveSignatureFlowTemplateForDefinitionTemplate`; el consumidor real es de aquí. Y hace falta:
// el `CHECK` de `signature_flow_steps.unit_scope_type` no admite `context_ancestor_type`, así que la
// caracterización **no puede sembrar esa rama por CRUD** — un unitario es su único guardián posible.
export const resolvePersonsForCargoInScope = async (connection, step, context = null) => {
  const scope = resolveScopeForStep(step, context);
  if (!scope.cargoId) {
    return [];
  }

  const params = [scope.cargoId];
  let query = `
    SELECT DISTINCT pa.person_id
    FROM unit_positions up
    INNER JOIN units u ON u.id = up.unit_id
    INNER JOIN position_assignments pa
      ON pa.position_id = up.id
     AND pa.is_current = 1
    WHERE up.is_active = 1
      AND pa.person_id IS NOT NULL
      AND up.cargo_id = ?`;

  if (scope.unitScopeType === "unit_subtree") {
    if (!scope.unitId) {
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
    params.unshift(scope.unitId);
  } else if (scope.unitScopeType === "unit_exact") {
    if (!scope.unitId) {
      return [];
    }
    query += "\n      AND up.unit_id = ?";
    params.push(scope.unitId);
  } else if (scope.unitScopeType === "unit_type") {
    if (!scope.unitTypeId) {
      return [];
    }
    query += "\n      AND u.unit_type_id = ?";
    params.push(scope.unitTypeId);
  } else if (scope.unitScopeType === "context_subtree") {
    if (!scope.unitId) {
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
    params.unshift(scope.unitId);
  } else if (scope.unitScopeType === "context_ancestor_type") {
    if (!scope.unitId || !scope.unitTypeId) {
      return [];
    }
    query = `
      WITH RECURSIVE ancestor_units AS (
        SELECT id, unit_type_id
        FROM units
        WHERE id = ?
        UNION ALL
        SELECT parent_u.id, parent_u.unit_type_id
        FROM unit_relations ur
        INNER JOIN relation_unit_types rt
          ON rt.id = ur.relation_type_id
         AND rt.code = 'org'
        INNER JOIN ancestor_units au ON au.id = ur.child_unit_id
        INNER JOIN units parent_u ON parent_u.id = ur.parent_unit_id
      )
      ${query}
        AND up.unit_id IN (
          SELECT id
          FROM ancestor_units
          WHERE unit_type_id = ?
        )`;
    // El orden importa y aquí estaba CRUZADO (defecto 1.16): los dos `unshift` dejaban
    // `[unitId, unitTypeId, cargoId]`, así que `up.cargo_id` recibía el tipo de unidad y
    // `unit_type_id` recibía el cargo. Resolvía firmantes equivocados, o ninguno, EN SILENCIO —
    // `bindParams` no puede verlo porque la CANTIDAD cuadra (3 y 3), solo el orden está mal.
    //
    // Los `?` salen así: (1) el del CTE, que va DELANTE de la consulta base; (2) el `up.cargo_id`
    // de la base; (3) el del `IN` final, que va DETRÁS. Por eso el de cabeza se paga con `unshift`
    // y el de cola con `push`. Ésta es la única rama del backend que antepone Y añade a la vez
    // (censo del 2026-08-14: 6 `unshift` en total, y los otros 5 solo anteponen), que es
    // exactamente por lo que aquí se rompió y en los demás no.
    params.unshift(scope.unitId);
    params.push(scope.unitTypeId);
  } else if (scope.unitScopeType === "context_exact") {
    if (!scope.unitId) {
      return [];
    }
    query += "\n      AND up.unit_id = ?";
    params.push(scope.unitId);
  }

  query += "\n    ORDER BY pa.person_id ASC";

  const [rows] = await connection.query(query, params);
  const people = rows.map((row) => Number(row.person_id)).filter(Boolean);
  if (String(step.selection_mode || "auto_all") === "auto_one") {
    return people.slice(0, 1);
  }
  return people;
};

const collectAssignees = (...sources) => {
  const seen = new Set();
  const result = [];
  for (const id of sources.flat()) {
    const candidate = Number(id || 0);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    result.push(candidate);
  }
  return result;
};

const readRequestStatusCode = (row) =>
  normalizeCode(row?.request_status_code ?? row?.requestStatusCode);

const readSignatureStatusCode = (row) =>
  normalizeCode(row?.signature_status_code ?? row?.signatureStatusCode);

const readStepOrder = (row) => Number(row?.step_order ?? row?.stepOrder);

const readApprovalMode = (row) =>
  String(row?.approval_mode ?? row?.approvalMode ?? SIGNATURE_APPROVAL_AND)
    .trim()
    .toLowerCase();

const readRequiredSignersMin = (row) => {
  const value = row?.required_signers_min ?? row?.requiredSignersMin;
  return value !== null && value !== undefined ? Number(value) : null;
};

const resolveSpecificPersonAssignees = (step) => {
  if (!step?.assignedPersonId) {
    return [];
  }
  return [Number(step.assignedPersonId)];
};


const resolveTaskAssignee = (context) => {
  const assignees = [];
  if (context?.task_item_assigned_person_id) {
    assignees.push(Number(context.task_item_assigned_person_id));
  }
  // Misma reserva que en el flujo de entrega, y por el mismo motivo: `tasks.created_by_user_id`
  // se retiro el 2026-08-23 y su equivalente vive en el entregable.
  if (context?.item_created_by_person_id) {
    assignees.push(Number(context.item_created_by_person_id));
  }
  return assignees;
};

// `document_owner` y `task_assignee` resuelven LO MISMO desde el 2026-08-23, y no es un descuido:
// `documents.owner_person_id` era una copia de `task_items.assigned_person_id` tomada al crear el
// documento, refrescada por UNO de los cuatro caminos de relevo. Retirada la copia, «el dueño del
// documento» y «quien responde del entregable» son la misma persona — que es lo que siempre
// quisieron decir los dos nombres.
//
// El `case` se conserva (ver el comentario de `resolveSingleSignerAssignees`): un paso legado puede
// traer este resolutor por el JSONB `signers`, y quitarlo lo dejaria cayendo al `default` sin cargo,
// o sea SIN FIRMANTE y en silencio. Ahora al menos resuelve a alguien correcto.
const resolveDocumentOwnerAssignee = (context) => resolveTaskAssignee(context);

const resolvePositionAssignees = async (connection, step, context) => {
  return resolveCurrentPersonsForPosition(
    connection,
    // El puesto responsable de la TAREA se retiro el 2026-08-23 (era un puesto arbitrario de la
    // unidad, no un responsable). Queda el del ENTREGABLE, que es el que responde por el.
    Number(step?.positionId || context?.task_item_responsible_position_id)
  );
};

// Resuelve los firmantes de UN solo resolutor (firmante) del paso.
//
// `document_owner` y `position` SE CONSERVAN aunque salieran del `CHECK` en el sub-paso 8 del §0.8, y
// aunque su gemela de entrega los haya retirado (`admin/generation/assignees.js`). El motivo está
// arriba, en `parseStepSigners`: el `signer` que llega aquí puede venir del JSONB `signers`, que
// ningún `CHECK` cubre, que la copia de versionado propaga verbatim y que nadie filtra contra
// catálogo. Borrar estos dos `case` dejaría a un paso legado resolviéndose por el `default` —cargo en
// ámbito— con `requiredCargoId` a null: no firmaría NADIE, y en silencio.
// Lo que los mataría: cerrar el agujero de `parseStepSigners` (filtro + migración del JSONB).
const resolveSingleSignerAssignees = async (connection, signer, context) => {
  if (!signer || String(signer.selectionMode || signer.selection_mode || "auto_all") === "manual") {
    return [];
  }
  const resolverType = String(signer.resolverType || "cargo_in_scope").trim();
  switch (resolverType) {
    case "specific_person":
      return resolveSpecificPersonAssignees(signer);
    case "document_owner":
      return resolveDocumentOwnerAssignee(context);
    case "task_assignee":
      return resolveTaskAssignee(context);
    case "position":
      return resolvePositionAssignees(connection, signer, context);
    case "cargo_in_scope":
    default:
      return resolvePersonsForCargoInScope(connection, signer, context);
  }
};

// Multi-firmante: une (sin duplicados) las personas resueltas por cada firmante del paso. El cupo entre ellas
// (todas / cualquiera / mínimo N) lo evalúa approval_mode más adelante en el flujo.
const resolveSignatureStepAssignees = async (connection, step, context) => {
  if (!step) {
    return [];
  }
  const signers = Array.isArray(step.signers) && step.signers.length
    ? step.signers
    : [signerFromStepColumns(step)];
  const resolved = [];
  for (const signer of signers) {
    resolved.push(await resolveSingleSignerAssignees(connection, signer, context));
  }
  return collectAssignees(...resolved);
};

const deriveSignatureStatusCode = (result) => {
  const validation = result?.validation || {};
  if (validation?.warningAccepted === true) {
    return SIGNATURE_STATUS.SIGNED;
  }
  if (validation?.performed && validation?.bottomLine === true) {
    return SIGNATURE_STATUS.SIGNED;
  }
  if (validation?.performed && validation?.bottomLine === false) {
    return SIGNATURE_STATUS.INVALID;
  }
  return SIGNATURE_STATUS.FAILED;
};

const deriveSignatureRequestStatusCode = (signatureStatusCode) =>
  signatureStatusCode === SIGNATURE_STATUS.SIGNED
    ? SIGNATURE_REQUEST_STATUS.COMPLETED
    : SIGNATURE_REQUEST_STATUS.PENDING;

const truncateNote = (value, max = 255) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, max) : null;
};

export const getSignatureRequestContext = async (connection, signatureRequestId) => {
  const [rows] = await connection.query(
    `SELECT
       sr.id,
       sr.assigned_person_id,
       sr.instance_id,
       sr.step_id,
       sfi.document_version_id,
       sfs.step_order
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     WHERE sr.id = ?
     LIMIT 1`,
    [signatureRequestId]
  );
  return rows?.[0] || null;
};

export const assertSignatureRequestCanBeSigned = async ({ connection, context }) => {
  if (!context?.signatureRequestId) {
    return null;
  }

  const signatureRequest = await getSignatureRequestContext(connection, Number(context.signatureRequestId));
  if (!signatureRequest) {
    throw new Error("La solicitud de firma indicada no existe.");
  }
  if (Number(signatureRequest.assigned_person_id || 0) !== Number(context.user?.id || 0)) {
    throw new Error("No puedes registrar una firma para una solicitud asignada a otro usuario.");
  }
  if (
    context.documentVersionId
    && Number(signatureRequest.document_version_id) !== Number(context.documentVersionId)
  ) {
    throw new Error("La solicitud de firma no pertenece a la versión documental indicada.");
  }

  const currentStep = await resolveCurrentSignatureStep(connection, Number(signatureRequest.document_version_id));
  if (currentStep && Number(currentStep.stepOrder || 0) !== Number(signatureRequest.step_order || 0)) {
    throw new Error("La solicitud de firma no pertenece al paso actual del flujo.");
  }

  return signatureRequest;
};

const getExistingSignatureFlowInstance = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_flow_instances
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] ? Number(rows[0].id) : null;
};

const summarizeSignatureRequests = (rows) => {
  const byStep = new Map();
  for (const row of rows) {
    const stepOrder = readStepOrder(row);
    if (!byStep.has(stepOrder)) {
      const approvalMode = readApprovalMode(row);
      const requiredSignersMin = readRequiredSignersMin(row);
      byStep.set(stepOrder, {
        stepOrder,
        approvalMode,
        requiredSignersMin,
        total: 0,
        approvedCount: 0,
        rejectedCount: 0,
        activeCount: 0,
        pendingCount: 0,
      });
    }
    const summary = byStep.get(stepOrder);
    summary.total += 1;
    const code = readRequestStatusCode(row);
    const signatureCode = readSignatureStatusCode(row);
    if (SIGN_APPROVED.has(code)) {
      if (signatureCode && !DOC_SIGNATURE_SUCCESS.has(signatureCode)) summary.rejectedCount += 1;
      else summary.approvedCount += 1;
    } else if (SIGN_REJECTED.has(code)) summary.rejectedCount += 1;
    else if (SIGN_ACTIVE.has(code)) summary.activeCount += 1;
    else summary.pendingCount += 1;
  }
  return Array.from(byStep.values())
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((item) => ({
      ...item,
      approved: isSignatureStepApproved(item),
      hasRejected: item.rejectedCount > 0,
      hasActive: item.activeCount > 0,
      hasPending: item.pendingCount > 0,
    }));
};

const isSignatureStepApproved = (summary) => {
  if (!summary || summary.total < 1) {
    return false;
  }
  switch (summary.approvalMode) {
    case SIGNATURE_APPROVAL_OR:
      return summary.approvedCount > 0;
    case SIGNATURE_APPROVAL_AT_LEAST: {
      const min = Number(summary.requiredSignersMin || 0);
      const effectiveMin = min > 0 ? min : 1;
      return summary.approvedCount >= effectiveMin;
    }
    case SIGNATURE_APPROVAL_AND:
    default:
      return summary.approvedCount === summary.total;
  }
};

export const inspectDocumentVersionSignatureReadiness = async (connection, documentVersionId) => {
  const context = await getDocumentVersionSignatureContext(connection, documentVersionId);
  if (!context) {
    return { ok: false, reason: "document_version_not_found" };
  }
  if (!shouldInferSignatureFlowForContext(context)) {
    return { ok: false, reason: "signature_flow_not_applicable", context };
  }

  const currentStatus = normalizeDocumentVersionStatus(context.document_version_status);
  if (currentStatus !== "Listo para firma") {
    return { ok: false, reason: "document_not_ready_for_signature", context, currentStatus };
  }

  const workingPath = String(context.working_file_path || "").trim().toLowerCase();
  if (!workingPath.endsWith(".pdf")) {
    return { ok: false, reason: "working_pdf_missing", context, currentStatus };
  }

  const signatureFlowTemplate = await getActiveSignatureFlowTemplateForDefinitionTemplate(
    connection,
    context.process_definition_template_id,
    context.task_item_id
  );
  if (!signatureFlowTemplate?.id) {
    return { ok: false, reason: "signature_template_missing", context, currentStatus };
  }

  const resolvedTemplate = await resolveSignatureTemplateStepsForContext(
    connection,
    signatureFlowTemplate.id,
    context
  );
  if (!resolvedTemplate.steps.length) {
    return { ok: false, reason: "signature_steps_missing", context, currentStatus, signatureFlowTemplate };
  }

  if (resolvedTemplate.unresolvedRequiredSteps.length) {
      return {
        ok: false,
        reason: "required_signers_unresolved",
        context,
        currentStatus,
        signatureFlowTemplate,
        steps: resolvedTemplate.steps,
        unresolvedRequiredSteps: resolvedTemplate.unresolvedRequiredSteps,
      };
  }

  return {
    ok: true,
    context,
    currentStatus,
    signatureFlowTemplate,
    steps: resolvedTemplate.steps,
  };
};

export const resolveCurrentSignatureStep = async (connection, documentVersionId) => {
  const instanceId = await getExistingSignatureFlowInstance(connection, documentVersionId);
  if (!instanceId) {
    return null;
  }

  const [rows] = await connection.query(
    `SELECT
       sfs.step_order,
       sfs.approval_mode,
       sfs.required_signers_min,
       srs.code AS request_status_code,
       ss.code AS signature_status_code
     FROM signature_requests sr
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN (
       SELECT ds1.signature_request_id, ds1.signature_status_id
       FROM document_signatures ds1
       INNER JOIN (
         SELECT signature_request_id, MAX(id) AS max_id
         FROM document_signatures
         WHERE signature_request_id IS NOT NULL
         GROUP BY signature_request_id
       ) latest ON latest.max_id = ds1.id
     ) latest_ds ON latest_ds.signature_request_id = sr.id
     LEFT JOIN signature_statuses ss ON ss.id = latest_ds.signature_status_id
     WHERE sr.instance_id = ?
     ORDER BY sfs.step_order ASC, sr.id ASC`,
    [instanceId]
  );

  const stepSummaries = summarizeSignatureRequests(rows);
  return stepSummaries.find((row) => !row.approved && !row.hasRejected)
    || stepSummaries.find((row) => !row.approved)
    || null;
};

export const ensureSignatureFlowForDocumentVersion = async (connection, documentVersionId) => {
  const existingInstanceId = await getExistingSignatureFlowInstance(connection, documentVersionId);
  if (existingInstanceId) {
    return {
      ok: true,
      alreadyExists: true,
      signatureFlowInstanceId: existingInstanceId,
    };
  }

  const readiness = await inspectDocumentVersionSignatureReadiness(connection, documentVersionId);
  if (!readiness.ok) {
    return {
      ok: false,
      reason: readiness.reason,
      readiness,
    };
  }

  const pendingStatusId = await getSignaturePendingStatusId(connection);
  if (!pendingStatusId) {
    throw new Error("No existe el estado Pendiente en signature_request_statuses.");
  }

  const [insertInstanceResult] = await connection.query(
    `INSERT INTO signature_flow_instances (
       template_id,
       document_version_id,
       status_id
     ) VALUES (?, ?, ?)`,
    [readiness.signatureFlowTemplate.id, documentVersionId, pendingStatusId]
  );
  const signatureFlowInstanceId = Number(insertInstanceResult.insertId);

  for (const step of readiness.steps) {
    if (!step.assignees.length) {
      await connection.query(
        `INSERT INTO signature_requests (
           instance_id,
           step_id,
           assigned_person_id,
           status_id,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [signatureFlowInstanceId, step.id, null, pendingStatusId, 1]
      );
      continue;
    }

    for (const assignedPersonId of step.assignees) {
      await connection.query(
        `INSERT INTO signature_requests (
           instance_id,
           step_id,
           assigned_person_id,
           status_id,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [signatureFlowInstanceId, step.id, assignedPersonId, pendingStatusId, 0]
      );
    }
  }

  await transitionDocumentVersionState(connection, Number(documentVersionId), "Pendiente de firma");
  return {
    ok: true,
    signatureFlowInstanceId,
    readiness,
  };
};

export const registerSignatureEvidence = async ({ connection, context, result }) => {
  if (!context?.user?.id) {
    throw new Error("Usuario autenticado inválido para registrar la firma.");
  }

  const signatureRequest = await assertSignatureRequestCanBeSigned({ connection, context });

  const documentVersionId = Number(
    context.documentVersionId || signatureRequest?.document_version_id || 0
  );
  if (!documentVersionId) {
    throw new Error("No se pudo determinar la versión documental firmada.");
  }

  const persistedSignedPath = String(
    result?.signedPath
    || result?.finalPath
    || ""
  ).trim() || null;

  const signatureStatusCode = deriveSignatureStatusCode(result);
  const signatureStatusId = await getSignatureStatusIdByCode(connection, signatureStatusCode);
  if (!signatureStatusId) {
    throw new Error(`No existe el estado técnico de firma '${signatureStatusCode}'.`);
  }

  if (persistedSignedPath) {
    await connection.query(
      `UPDATE document_versions
       SET working_file_path = ?
       WHERE id = ?`,
      [persistedSignedPath, documentVersionId]
    );
  }

  if (signatureRequest?.id) {
    const requestStatusCode = deriveSignatureRequestStatusCode(signatureStatusCode);
    const requestStatusId = await getSignatureRequestStatusIdByCode(connection, requestStatusCode);
    if (!requestStatusId) {
      throw new Error(`No existe el estado de solicitud de firma '${requestStatusCode}'.`);
    }
    const shouldMarkRequestAsResponded = requestStatusCode === SIGNATURE_REQUEST_STATUS.COMPLETED;
    await connection.query(
      `UPDATE signature_requests
       SET status_id = ?,
           responded_at = ?
       WHERE id = ?`,
      [requestStatusId, shouldMarkRequestAsResponded ? new Date() : null, Number(signatureRequest.id)]
    );
  }

  const noteShort = truncateNote(
    result?.validation?.warning
    || result?.validation?.details
    || result?.message
  );

  const [insertResult] = await connection.query(
    `INSERT INTO document_signatures (
       signature_request_id,
       document_version_id,
       signer_user_id,
       signature_status_id,
       note_short,
       signed_file_path,
       signed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      signatureRequest?.id ? Number(signatureRequest.id) : null,
      documentVersionId,
      Number(context.user.id),
      Number(signatureStatusId),
      noteShort,
      persistedSignedPath,
      new Date(),
    ]
  );

  await syncDocumentProgressFromDocumentSignature(connection, Number(insertResult.insertId));

  // Auto-captura: un rechazo de firma queda como observación del hilo (fase 'signature').
  if (!DOC_SIGNATURE_SUCCESS.has(signatureStatusCode)) {
    await addDocumentObservation(connection, {
      documentVersionId,
      signatureRequestId: signatureRequest?.id ? Number(signatureRequest.id) : null,
      phase: "signature",
      kind: "rejection_reason",
      message: noteShort || "Firma rechazada.",
      authorPersonId: context.user.id
    });
  }

  return {
    documentSignatureId: Number(insertResult.insertId),
    documentVersionId,
    signatureRequestId: signatureRequest?.id ? Number(signatureRequest.id) : null,
    signatureStatusCode,
  };
};

export const getSignatureFlowSnapshot = async ({ connection, documentVersionId, userId }) => {
  const context = await getDocumentVersionSignatureContext(connection, documentVersionId);
  const currentStatus = normalizeDocumentVersionStatus(context?.document_version_status);
  const readiness = context
    ? {
      ok: false,
      context,
      currentStatus,
      steps: [],
    }
    : await inspectDocumentVersionSignatureReadiness(connection, documentVersionId);
  const snapshot = {
    documentVersionId,
    readiness,
    signatureFlow: null,
    signatureSteps: readiness.steps || [],
    signatureRequests: [],
    currentSignatureStepOrder: null,
    responsableActual: null,
    canOperate: false,
    currentStatus: readiness.currentStatus || currentStatus || null,
  };

  const [instanceRows] = await connection.query(
    `SELECT
       sfi.id,
       sfi.template_id,
       srs.code AS status_code,
       sfi.created_at
     FROM signature_flow_instances sfi
     INNER JOIN signature_request_statuses srs ON srs.id = sfi.status_id
     WHERE sfi.document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  if (!instanceRows.length) {
    return snapshot;
  }

  const instance = instanceRows[0];
  snapshot.signatureFlow = {
    id: Number(instance.id),
    templateId: Number(instance.template_id),
    statusCode: instance.status_code,
    createdAt: instance.created_at,
  };

  if (context && instance.template_id) {
    const resolvedTemplate = await resolveSignatureTemplateStepsForContext(
      connection,
      Number(instance.template_id),
      context
    );
    snapshot.signatureSteps = resolvedTemplate.steps;
    snapshot.readiness = {
      ok: true,
      context,
      currentStatus,
      signatureFlowTemplate: { id: Number(instance.template_id) },
      steps: resolvedTemplate.steps,
      unresolvedRequiredSteps: resolvedTemplate.unresolvedRequiredSteps,
      source: "active_instance",
    };
  } else if (!snapshot.readiness?.reason) {
    snapshot.readiness = await inspectDocumentVersionSignatureReadiness(connection, documentVersionId);
    snapshot.signatureSteps = snapshot.readiness?.steps || [];
    snapshot.currentStatus = snapshot.readiness?.currentStatus || snapshot.currentStatus;
  }

  const [requestRows] = await connection.query(
    `SELECT
       sr.id,
       sr.assigned_person_id,
       sr.is_manual,
       sr.requested_at,
       sr.responded_at,
       sfs.id AS step_id,
       sfs.step_order,
       sfs.approval_mode,
       sfs.required_signers_min,
       sfs.required_cargo_id,
       srs.code AS request_status_code,
       ss.code AS signature_status_code,
       p.first_name,
       p.last_name,
       c.name AS cargo_name
     FROM signature_requests sr
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN (
       SELECT ds1.signature_request_id, ds1.signature_status_id
       FROM document_signatures ds1
       INNER JOIN (
         SELECT signature_request_id, MAX(id) AS max_id
         FROM document_signatures
         WHERE signature_request_id IS NOT NULL
         GROUP BY signature_request_id
       ) latest ON latest.max_id = ds1.id
     ) latest_ds ON latest_ds.signature_request_id = sr.id
     LEFT JOIN signature_statuses ss ON ss.id = latest_ds.signature_status_id
     LEFT JOIN persons p ON p.id = sr.assigned_person_id
     LEFT JOIN cargos c ON c.id = sfs.required_cargo_id
     WHERE sr.instance_id = ?
     ORDER BY sfs.step_order ASC, sr.id ASC`,
    [Number(instance.id)]
  );

  const pendingStatusCodes = new Set([
    SIGNATURE_REQUEST_STATUS.PENDING,
    SIGNATURE_REQUEST_STATUS.IN_PROGRESS,
  ]);
  const completedStatusCode = SIGNATURE_REQUEST_STATUS.COMPLETED;

  for (const row of requestRows) {
    const assignedPersonId = Number(row.assigned_person_id || 0);
    const assignedPerson = assignedPersonId
      ? {
        id: assignedPersonId,
        firstName: String(row.first_name || "").trim() || null,
        lastName: String(row.last_name || "").trim() || null,
      }
      : null;
    const requestStatusCode = String(row.request_status_code || "").trim().toLowerCase();
    snapshot.signatureRequests.push({
      id: Number(row.id),
      stepId: Number(row.step_id),
      stepOrder: Number(row.step_order),
      approvalMode: String(row.approval_mode || SIGNATURE_APPROVAL_AND).trim().toLowerCase(),
      requiredSignersMin: row.required_signers_min !== null && row.required_signers_min !== undefined
        ? Number(row.required_signers_min)
        : null,
      requestStatusCode,
      signatureStatusCode: String(row.signature_status_code || "").trim() || null,
      isManual: Boolean(Number(row.is_manual || 0)),
      assignedPerson,
      cargoName: String(row.cargo_name || "").trim() || null,
      requestedAt: row.requested_at,
      respondedAt: row.responded_at,
    });

  }

  const stepSummaries = summarizeSignatureRequests(snapshot.signatureRequests);
  const currentStep = stepSummaries.find((item) => !item.approved && !item.hasRejected)
    || stepSummaries.find((item) => !item.approved)
    || null;
  snapshot.currentSignatureStepOrder = currentStep ? Number(currentStep.stepOrder) : null;

  for (const request of snapshot.signatureRequests) {
    if (Number(request.stepOrder) !== Number(snapshot.currentSignatureStepOrder || 0)) {
      continue;
    }
    if (!snapshot.responsableActual && pendingStatusCodes.has(request.requestStatusCode) && request.assignedPerson) {
      snapshot.responsableActual = request.assignedPerson;
    }
    if (
      pendingStatusCodes.has(request.requestStatusCode)
      && Number(userId || 0) === Number(request.assignedPerson?.id || 0)
    ) {
      snapshot.canOperate = true;
    }
  }

  return snapshot;
};

export const syncDocumentProgressFromSignatureRequest = async (connection, signatureRequestId) => {
  const [contextRows] = await connection.query(
    `SELECT
       sr.id,
       sr.instance_id,
       sfi.document_version_id
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     WHERE sr.id = ?
     LIMIT 1`,
    [signatureRequestId]
  );
  const context = contextRows?.[0];
  if (!context) return null;

  const [rows] = await connection.query(
    `SELECT
       sr.id,
       sfs.step_order,
       sfs.approval_mode,
       sfs.required_signers_min,
       srs.code AS request_status_code,
       ss.code AS signature_status_code
     FROM signature_requests sr
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN (
       SELECT ds1.signature_request_id, ds1.signature_status_id
       FROM document_signatures ds1
       INNER JOIN (
         SELECT signature_request_id, MAX(id) AS max_id
         FROM document_signatures
         WHERE signature_request_id IS NOT NULL
         GROUP BY signature_request_id
       ) latest ON latest.max_id = ds1.id
     ) latest_ds ON latest_ds.signature_request_id = sr.id
     LEFT JOIN signature_statuses ss ON ss.id = latest_ds.signature_status_id
     WHERE sr.instance_id = ?
     ORDER BY sfs.step_order ASC, sr.id ASC`,
    [context.instance_id]
  );
  if (!rows.length) return null;

  const stepSummaries = summarizeSignatureRequests(rows);
  const anyRejected = stepSummaries.some((item) => item.hasRejected);
  const allApproved = stepSummaries.length > 0 && stepSummaries.every((item) => item.approved);
  const anyApproved = stepSummaries.some((item) => item.approved);
  const anyActive = stepSummaries.some((item) => item.hasActive);

  let instanceStatusCode = SIGNATURE_REQUEST_STATUS.PENDING;
  if (allApproved) instanceStatusCode = SIGNATURE_REQUEST_STATUS.COMPLETED;
  else if (anyActive || anyApproved) instanceStatusCode = SIGNATURE_REQUEST_STATUS.IN_PROGRESS;
  else if (anyRejected) instanceStatusCode = SIGNATURE_REQUEST_STATUS.REJECTED;

  const [statusRows] = await connection.query(
    `SELECT id
     FROM signature_request_statuses
     WHERE LOWER(code) = ?
     ORDER BY id ASC
     LIMIT 1`,
    [normalizeCode(instanceStatusCode)]
  );
  if (statusRows?.[0]?.id) {
    await connection.query(
      `UPDATE signature_flow_instances
       SET status_id = ?
       WHERE id = ?`,
      [Number(statusRows[0].id), context.instance_id]
    );
  }

  if (allApproved) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Firmado completo");
    await finalizeDocumentVersionIfComplete(connection, Number(context.document_version_id));
  } else if (anyApproved || anyActive) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Firmado parcial");
  } else {
    const current = await getDocumentVersionCurrentStatus(connection, Number(context.document_version_id));
    if (current === "Listo para firma") {
      await transitionDocumentVersionState(connection, Number(context.document_version_id), "Pendiente de firma");
    }
  }

  return {
    documentVersionId: Number(context.document_version_id),
    signatureFlowInstanceId: Number(context.instance_id),
    instanceStatusCode,
  };
};

const getDocumentVersionCurrentStatus = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT status
     FROM document_versions
     WHERE id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return normalizeDocumentVersionStatus(rows?.[0]?.status);
};

const finalizeDocumentVersionIfComplete = async (connection, documentVersionId) => {
  const currentStatus = await getDocumentVersionCurrentStatus(connection, documentVersionId);
  if (currentStatus === "Firmado completo") {
    await connection.query(
      `UPDATE document_versions
       SET final_file_path = working_file_path
       WHERE id = ?`,
      [Number(documentVersionId)]
    );
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Final");
    return true;
  }
  return false;
};

export const syncDocumentProgressFromDocumentVersionSignatureSummary = async (connection, documentVersionId) => {
  const currentStatus = await getDocumentVersionCurrentStatus(connection, Number(documentVersionId));
  if (currentStatus === "Final") {
    return {
      documentVersionId: Number(documentVersionId),
      successCount: null,
      totalRequests: null,
      skipped: "already_final",
    };
  }

  const [rows] = await connection.query(
    `SELECT
       ds.id,
       ss.code AS signature_status_code
     FROM document_signatures ds
     LEFT JOIN signature_statuses ss ON ss.id = ds.signature_status_id
     WHERE ds.document_version_id = ?
     ORDER BY ds.id ASC`,
    [documentVersionId]
  );

  const successCount = rows.filter((row) => DOC_SIGNATURE_SUCCESS.has(normalizeCode(row.signature_status_code))).length;
  if (!successCount) {
    return null;
  }

  const [requestRows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     WHERE sfi.document_version_id = ?`,
    [documentVersionId]
  );
  const totalRequests = Number(requestRows?.[0]?.total || 0);

  if (totalRequests > 0 && successCount >= totalRequests) {
    const refreshedStatus = await getDocumentVersionCurrentStatus(connection, Number(documentVersionId));
    if (refreshedStatus !== "Firmado completo" && refreshedStatus !== "Final") {
      await transitionDocumentVersionState(connection, Number(documentVersionId), "Firmado completo");
    }
    await finalizeDocumentVersionIfComplete(connection, Number(documentVersionId));
  } else {
    const refreshedStatus = await getDocumentVersionCurrentStatus(connection, Number(documentVersionId));
    if (refreshedStatus !== "Firmado parcial" && refreshedStatus !== "Final") {
      await transitionDocumentVersionState(connection, Number(documentVersionId), "Firmado parcial");
    }
  }

  return {
    documentVersionId: Number(documentVersionId),
    successCount,
    totalRequests,
  };
};

export const syncDocumentProgressFromDocumentSignature = async (connection, documentSignatureId) => {
  const [rows] = await connection.query(
    `SELECT
       ds.id,
       ds.document_version_id,
       ds.signature_request_id,
       ss.code AS signature_status_code
     FROM document_signatures ds
     LEFT JOIN signature_statuses ss ON ss.id = ds.signature_status_id
     WHERE ds.id = ?
     LIMIT 1`,
    [documentSignatureId]
  );
  const signature = rows?.[0];
  if (!signature) return null;

  if (signature.signature_request_id) {
    await syncDocumentProgressFromSignatureRequest(connection, Number(signature.signature_request_id));
  }

  if (DOC_SIGNATURE_SUCCESS.has(normalizeCode(signature.signature_status_code))) {
    await syncDocumentProgressFromDocumentVersionSignatureSummary(connection, Number(signature.document_version_id));
  }

  return {
    documentVersionId: Number(signature.document_version_id),
    signatureRequestId: signature.signature_request_id ? Number(signature.signature_request_id) : null,
  };
};
