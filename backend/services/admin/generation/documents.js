// DOCUMENTOS y FLUJO DE LLENADO de una tarea: materializar el documento de un
// task_item, resolver su propietario/unidad de origen y montar el flujo de llenado.
// Extraído de TaskGenerationService en la Fase 3. Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// `ensureSignatureFlowForDocumentVersion` es hoy un delegador de una línea a
// DocumentSignatureWorkflowService: la firma se movió allí, aquí solo queda el punto de
// entrada que conservan los consumidores.
import { transitionDocumentVersionState } from "../../documents/DocumentStateService.js";
import { ensureSignatureFlowForDocumentVersion as ensureDocumentSignatureWorkflowForDocumentVersion } from "../../documents/DocumentSignatureWorkflowService.js";
import {
  getDocumentVersionFillContext,
  getActiveFillFlowTemplateForDefinitionTemplate,
  getFillFlowSteps,
  getTaskItemsForDocumentMaterialization
} from "./queries.js";
import {
  resolveFillStepAssignees,
  repairFillRequestsForFlow
} from "./assignees.js";

export const ensureSignatureFlowForDocumentVersion = async (connection, documentVersionId) => {
  return ensureDocumentSignatureWorkflowForDocumentVersion(connection, documentVersionId);
};
export const ensureFillFlowForDocumentVersion = async (connection, documentVersionId) => {
  const context = await getDocumentVersionFillContext(connection, documentVersionId);
  if (!context?.process_definition_template_id) {
    return null;
  }

  const existingFlow = await connection.query(
    `SELECT id
     FROM document_fill_flows
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  if (existingFlow?.[0]?.length) {
    const flowId = Number(existingFlow[0][0].id);
    const fillFlowTemplate = await getActiveFillFlowTemplateForDefinitionTemplate(
      connection,
      context.process_definition_template_id,
      context.task_item_id
    );
    if (fillFlowTemplate?.id) {
      const steps = await getFillFlowSteps(connection, fillFlowTemplate.id);
      await repairFillRequestsForFlow(connection, flowId, steps, context);
    }
    await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
    return flowId;
  }

  const fillFlowTemplate = await getActiveFillFlowTemplateForDefinitionTemplate(
    connection,
    context.process_definition_template_id,
    context.task_item_id
  );

  if (!fillFlowTemplate?.id) {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Listo para firma");
    await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
    return null;
  }

  const steps = await getFillFlowSteps(connection, fillFlowTemplate.id);
  const firstStepOrder = steps.length ? Number(steps[0].step_order) : null;

  const [insertFlowResult] = await connection.query(
    `INSERT INTO document_fill_flows (
       fill_flow_template_id,
       document_version_id,
       status,
       current_step_order
     ) VALUES (?, ?, ?, ?)`,
    [
      fillFlowTemplate.id,
      documentVersionId,
      "pending",
      firstStepOrder
    ]
  );

  const documentFillFlowId = Number(insertFlowResult.insertId);

  for (const step of steps) {
    const assignees = await resolveFillStepAssignees(connection, step, context);
    if (!assignees.length) {
      await connection.query(
        `INSERT INTO fill_requests (
           document_fill_flow_id,
           fill_flow_step_id,
           assigned_person_id,
           status,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [documentFillFlowId, step.id, null, "pending", 1]
      );
      continue;
    }

    for (const assignedPersonId of assignees) {
      await connection.query(
        `INSERT INTO fill_requests (
           document_fill_flow_id,
           fill_flow_step_id,
           assigned_person_id,
           status,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [documentFillFlowId, step.id, assignedPersonId, "pending", 0]
      );
    }
  }

  await transitionDocumentVersionState(connection, Number(documentVersionId), "Pendiente de llenado");
  await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);

  return documentFillFlowId;
};
// `resolveOwnerPersonIdForTaskItem` VIVIO AQUI hasta el 2026-08-23, y su historia entera cabe en un
// parrafo: empezo siendo una cascada de CUATRO escalones —el «Para:», el puesto del entregable, el
// puesto de la tarea y «el primer asignado de la tarea por id»—, se le fueron cayendo tres al
// medirlos (uno era el destinatario, dos leian una foto que nadie refrescaba y el ultimo era una
// loteria) y lo que quedaba era `return taskItem.assigned_person_id`.
//
// Una funcion que devuelve un campo no es una funcion, es un campo. Y `documents.owner_person_id`
// tampoco era un hecho: era una copia de ese mismo campo, tomada al crear el documento y
// refrescada por UNO de los cuatro caminos de relevo, asi que a partir del primer relevo automatico
// el documento seguia figurando a nombre de quien se fue.
//
// Quien responde de un documento es quien responde de su entregable, y eso vive en su tenencia.
export const resolveOriginUnitIdForTaskItem = async (connection, taskItem, responsiblePersonId = null) => {
  if (taskItem?.target_unit_id) {
    return Number(taskItem.target_unit_id);
  }

  // 1. Posición explícita del task_item (más específica)
  if (taskItem?.responsible_position_id) {
    const [rows] = await connection.query(
      `SELECT unit_id FROM unit_positions WHERE id = ? AND unit_id IS NOT NULL LIMIT 1`,
      [taskItem.responsible_position_id]
    );
    if (rows?.[0]?.unit_id) return Number(rows[0].unit_id);
  }

  // 2. Posición del task padre (contexto de la unidad que generó el task)
  if (taskItem?.task_id) {
    const [rows] = await connection.query(
      `SELECT t.scope_unit_id AS unit_id
       FROM tasks t
       WHERE t.id = ? AND t.scope_unit_id IS NOT NULL
       LIMIT 1`,
      [taskItem.task_id]
    );
    if (rows?.[0]?.unit_id) return Number(rows[0].unit_id);
  }

  // 3. Última opción: primera posición activa de QUIEN RESPONDE (sólo cuando no hay contexto de
  // task). Antes se le pasaba el «dueño» del documento; es la misma persona, leída del sitio bueno.
  const normalizedResponsibleId = Number(responsiblePersonId || 0) || null;
  if (normalizedResponsibleId) {
    const [ownerRows] = await connection.query(
      `SELECT up.unit_id
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND up.unit_id IS NOT NULL
       ORDER BY pa.id ASC, up.id ASC
       LIMIT 1`,
      [normalizedResponsibleId]
    );
    if (ownerRows?.[0]?.unit_id) return Number(ownerRows[0].unit_id);
  }

  return null;
};
export const materializeRuntimeFlowForTaskItem = async (
  connection,
  { taskItemId, processDefinitionTemplateId, flow }
) => {
  const APPROVALS = new Set(["and", "or", "at_least"]);
  // Firmante/responsable → forma que consumen parseStepSigners / resolveFillStepAssignees.
  const normSigner = (raw) => {
    if (raw && raw.cargo_id) {
      const unitId = raw.unit_id ? Number(raw.unit_id) : null;
      const unitTypeId = raw.unit_type_id ? Number(raw.unit_type_id) : null;
      return {
        type: "cargo_in_scope",
        cargo_id: Number(raw.cargo_id),
        unit_id: unitId,
        unit_type_id: unitTypeId,
        unit_scope_type: raw.unit_scope_type || (unitId ? "unit_exact" : unitTypeId ? "unit_type" : "all_units"),
      };
    }
    const pid = Number(raw?.person_id ?? raw) || null;
    return pid ? { type: "specific_person", person_id: pid } : null;
  };
  // Paso de firma → { signers:[...], approval_mode, required_min }. Acepta { signers:[...] } o un signer suelto.
  const normFirmaStep = (raw) => {
    const rawSigners = Array.isArray(raw?.signers) ? raw.signers : [raw];
    const signers = rawSigners.map(normSigner).filter(Boolean);
    if (!signers.length) return null;
    const approval = APPROVALS.has(raw?.approval_mode) ? raw.approval_mode : "and";
    return {
      signers,
      approval_mode: signers.length > 1 ? approval : "and",
      required_min: signers.length > 1 && approval === "at_least" ? (Number(raw?.required_min) || 1) : null,
    };
  };

  const entrega = (Array.isArray(flow?.entrega) ? flow.entrega : []).map(normSigner).filter(Boolean);
  const firma = (Array.isArray(flow?.firma) ? flow.firma : []).map(normFirmaStep).filter(Boolean);
  let fillSteps = 0;
  let signatureSteps = 0;

  if (entrega.length) {
    const [ft] = await connection.query(
      `INSERT INTO fill_flow_templates (process_definition_template_id, task_item_id, name, is_active)
       VALUES (?, ?, 'Entrega (definida al enviar)', 1)`,
      [processDefinitionTemplateId, taskItemId]
    );
    const fillTplId = Number(ft.insertId);
    let order = 1;
    for (const s of entrega) {
      const canReject = order > 1 ? 1 : 0;
      if (s.type === "cargo_in_scope") {
        await connection.query(
          `INSERT INTO fill_flow_steps
             (fill_flow_template_id, step_order, resolver_type, unit_scope_type, unit_id, unit_type_id, cargo_id, selection_mode, is_required, can_reject)
           VALUES (?, ?, 'cargo_in_scope', ?, ?, ?, ?, 'auto_one', 1, ?)`,
          [fillTplId, order, s.unit_scope_type, s.unit_id, s.unit_type_id, s.cargo_id, canReject]
        );
      } else {
        await connection.query(
          `INSERT INTO fill_flow_steps
             (fill_flow_template_id, step_order, resolver_type, assigned_person_id, selection_mode, is_required, can_reject)
           VALUES (?, ?, 'specific_person', ?, 'auto_one', 1, ?)`,
          [fillTplId, order, s.person_id, canReject]
        );
      }
      order += 1;
      fillSteps += 1;
    }
  }

  if (firma.length) {
    const [st] = await connection.query(
      `INSERT INTO signature_flow_templates (process_definition_template_id, task_item_id, name, is_active)
       VALUES (?, ?, 'Firma (definida al enviar)', 1)`,
      [processDefinitionTemplateId, taskItemId]
    );
    const sigTplId = Number(st.insertId);
    let order = 1;
    for (const step of firma) {
      const code = `firma_${order}`;
      const primary = step.signers[0]; // columnas de resolutor = fallback; el flujo usa `signers` cuando existe.
      await connection.query(
        `INSERT INTO signature_flow_steps
           (template_id, step_order, code, name, slot, resolver_type, assigned_person_id, required_cargo_id, unit_scope_type, unit_id, unit_type_id, selection_mode, approval_mode, required_signers_min, signers, is_required)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_all', ?, ?, ?, 1)`,
        [
          sigTplId, order, code, `Firma ${order}`, code,
          primary.type,
          primary.type === "specific_person" ? primary.person_id : null,
          primary.type === "cargo_in_scope" ? primary.cargo_id : null,
          primary.type === "cargo_in_scope" ? primary.unit_scope_type : "context_exact",
          primary.type === "cargo_in_scope" ? primary.unit_id : null,
          primary.type === "cargo_in_scope" ? primary.unit_type_id : null,
          step.approval_mode,
          step.required_min,
          JSON.stringify(step.signers),
        ]
      );
      order += 1;
      signatureSteps += 1;
    }
  }

  return { fillSteps, signatureSteps };
};
export const ensureDocumentForTaskItem = async (connection, taskItem) => {
  const originUnitId = await resolveOriginUnitIdForTaskItem(connection, taskItem, taskItem?.assigned_person_id ?? null);

  // LA MESA DE EN MEDIO DESAPARECIO (2026-08-23). Aqui se buscaba —y si no, se creaba— una fila en
  // `documents` de la que colgar las versiones. Esa tabla era 1:1 estricta con el entregable y no
  // tenia ni un hecho propio, asi que las versiones cuelgan ya del entregable y esta funcion hace
  // dos cosas en vez de cuatro: sellar la unidad de origen y asegurar la version inicial.
  //
  // El nombre se conserva —lo llaman cinco sitios— pero lo que asegura es la PRIMERA VERSION.
  //
  // La unidad de origen lleva `COALESCE` porque materializar es idempotente: se llama en cada
  // lanzamiento y una vez resuelta no se recalcula.
  if (originUnitId) {
    await connection.query(
      `UPDATE task_items
       SET origin_unit_id = COALESCE(origin_unit_id, ?)
       WHERE id = ?`,
      [originUnitId, taskItem.id]
    );
  }

  const [versionRows] = await connection.query(
    `SELECT id
     FROM document_versions
     WHERE task_item_id = ?
     ORDER BY version ASC, id ASC
     LIMIT 1`,
    [taskItem.id]
  );

  if (!versionRows?.length) {
    const [insertResult] = await connection.query(
      `INSERT INTO document_versions (
         task_item_id,
         version,
         template_artifact_id,
         status
       ) VALUES (?, ?, ?, ?)`,
      [
        taskItem.id,
        0.1,
        taskItem.template_artifact_id ?? null,
        "Borrador"
      ]
    );
    await ensureFillFlowForDocumentVersion(connection, Number(insertResult.insertId));
  } else {
    await ensureFillFlowForDocumentVersion(connection, Number(versionRows[0].id));
  }

  // Devuelve el ENTREGABLE, que es lo que ahora identifica al documento. Antes devolvia el id de la
  // fila de `documents`, y ningun llamador lo usaba para otra cosa que saber que hubo documento.
  return taskItem.id;
};
export const ensureDocumentsForTask = async (connection, taskId) => {
  const taskItems = await getTaskItemsForDocumentMaterialization(connection, taskId);
  let createdOrEnsured = 0;
  for (const taskItem of taskItems) {
    await ensureDocumentForTaskItem(connection, taskItem);
    createdOrEnsured += 1;
  }
  return createdOrEnsured;
};
