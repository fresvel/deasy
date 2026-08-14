// Resolución de RESPONSABLES de los pasos de flujo, y reparación de las solicitudes de
// llenado cuando el flujo cambia. Extraído de TaskGenerationService en la Fase 3.
// Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// Es el "quién hace el paso": traduce la declaración de un paso (cargo en tal ámbito,
// responsable de la tarea, persona concreta) a personas de carne y hueso. Si esto se
// equivoca, la tarea le llega a quien no toca.
//
// ── LO QUE YA NO ESTÁ, y por qué (§0.6, cierre del censo de fósiles) ─────────────────────────────
// Este fichero resuelve SOLO pasos de ENTREGA, y todos le llegan de una única consulta —
// `getFillFlowSteps` (`queries.js`)—, que lee `fill_flow_steps` columna a columna. Sus dos columnas
// de política están cerradas por un `CHECK` desde el sub-paso 8 del §0.8:
//
//   resolver_type    IN (task_assignee, specific_person, cargo_in_scope)
//   unit_scope_type  IN (unit_exact, unit_subtree, unit_type, all_units, context_exact)
//
// Así que los `case` de `document_owner`, `position` y `manual_pick`, y las ramas de ámbito
// `context_subtree` y `context_ancestor_type`, no eran «poco usados»: eran INALCANZABLES —ninguna
// fila puede llevar ese valor—. Medido antes de retirarlos: `test:char:run` en 281/281 y **ningún
// golden movido**, que es la prueba de que estaban muertos.
//
// QUÉ LOS RESUCITARÍA: ampliar el `CHECK` de `fill_flow_steps` (bloque `DO $$` de
// `postgres_schema.sql`) y volver a admitir el tipo en `FILL_RESOLVER_TYPES` /
// `FILL_UNIT_SCOPE_TYPES` (`templates/workflows.js`). Mientras esas dos puertas sigan cerradas,
// añadir aquí un `case` es escribir código que nadie puede ejecutar.
//
// ⚠️ NO COPIES ESTE RECORTE A `DocumentSignatureWorkflowService.js`. Su gemela de FIRMA conserva
// `document_owner`, `position` y los dos `context_*` a propósito: allí el resolutor no siempre viene
// de la columna, puede venir del JSONB `signers`, que ningún `CHECK` cubre y que `parseStepSigners`
// no filtra contra catálogo. Ver la nota en ese fichero.
import { resolveScopeForStep } from "./primitives.js";

export const resolvePersonsForCargoInScope = async (connection, step, context = null) => {
  if (!step?.cargo_id) {
    return [];
  }

  const scope = resolveScopeForStep(step, context);
  const params = [step.cargo_id];
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
  if (step.selection_mode === "auto_one") {
    return people.slice(0, 1);
  }
  return people;
};

export const resolveFillStepAssignees = async (connection, step, context) => {
  if (!step || !context) {
    return [];
  }

  switch (step.resolver_type) {
    case "specific_person":
      return step.assigned_person_id ? [Number(step.assigned_person_id)] : [];
    case "task_assignee": {
      const assignee = context.task_item_assigned_person_id || context.task_created_by_user_id;
      return assignee ? [Number(assignee)] : [];
    }
    case "cargo_in_scope":
      return resolvePersonsForCargoInScope(connection, step, context);
    default:
      return [];
  }
};

export const repairFillRequestsForFlow = async (connection, documentFillFlowId, steps, context) => {
  const [existingRows] = await connection.query(
    `SELECT
       fr.id,
       fr.fill_flow_step_id,
       fr.assigned_person_id,
       fr.status,
       fr.is_manual
     FROM fill_requests fr
     WHERE fr.document_fill_flow_id = ?
     ORDER BY fr.fill_flow_step_id ASC, fr.id ASC`,
    [documentFillFlowId]
  );

  const existingByStepId = new Map();
  existingRows.forEach((row) => {
    const key = Number(row.fill_flow_step_id);
    if (!existingByStepId.has(key)) {
      existingByStepId.set(key, []);
    }
    existingByStepId.get(key).push(row);
  });

  for (const step of steps) {
    const stepId = Number(step.id);
    const existingForStep = existingByStepId.get(stepId) || [];
    const manualRows = existingForStep.filter((row) => Number(row.is_manual) === 1);
    const resolvedRows = existingForStep.filter((row) => Number(row.assigned_person_id) > 0);
    const assignees = [...new Set((await resolveFillStepAssignees(connection, step, context)).map(Number).filter(Boolean))];

    if (!assignees.length) {
      if (!existingForStep.length) {
        await connection.query(
          `INSERT INTO fill_requests (
             document_fill_flow_id,
             fill_flow_step_id,
             assigned_person_id,
             status,
             is_manual
           ) VALUES (?, ?, ?, ?, ?)`,
          [documentFillFlowId, stepId, null, "pending", 1]
        );
      }
      continue;
    }

    const existingAssignedIds = new Set(resolvedRows.map((row) => Number(row.assigned_person_id)).filter(Boolean));
    const replaceableRows = [
      ...manualRows,
      ...resolvedRows.filter((row) => !assignees.includes(Number(row.assigned_person_id))),
    ];
    const usedReplaceableIds = new Set();

    for (const assignedPersonId of assignees) {
      if (existingAssignedIds.has(assignedPersonId)) {
        continue;
      }
      const rowToPromote = replaceableRows.find((row) => !usedReplaceableIds.has(Number(row.id)));
      if (rowToPromote) {
        usedReplaceableIds.add(Number(rowToPromote.id));
        await connection.query(
          `UPDATE fill_requests
           SET assigned_person_id = ?,
               is_manual = 0,
               status = 'pending',
               responded_at = NULL,
               response_note = NULL
           WHERE id = ?`,
          [assignedPersonId, Number(rowToPromote.id)]
        );
      } else {
        await connection.query(
          `INSERT INTO fill_requests (
             document_fill_flow_id,
             fill_flow_step_id,
             assigned_person_id,
             status,
             is_manual
           ) VALUES (?, ?, ?, ?, ?)`,
          [documentFillFlowId, stepId, assignedPersonId, "pending", 0]
        );
      }
    }

    if (assignees.length > 0) {
      const [currentRows] = await connection.query(
        `SELECT id, assigned_person_id, is_manual
         FROM fill_requests
         WHERE document_fill_flow_id = ?
           AND fill_flow_step_id = ?`,
        [documentFillFlowId, stepId]
      );

      const staleIds = currentRows
        .filter((row) => {
          const assignedPersonId = Number(row.assigned_person_id || 0);
          const isManual = Number(row.is_manual) === 1;
          if (!isManual) {
            return false;
          }
          if (!assignedPersonId) {
            return true;
          }
          return !assignees.includes(assignedPersonId);
        })
        .map((row) => Number(row.id))
        .filter(Boolean);

      if (staleIds.length) {
        await connection.query(
          `DELETE FROM fill_requests
           WHERE id IN (${staleIds.map(() => "?").join(", ")})`,
          staleIds
        );
      }
    }
  }
};
