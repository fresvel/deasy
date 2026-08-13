// Helpers puros de TaskGenerationService (sin `connection`, sin estado de módulo).
// Extraídos en la Fase 3. Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// Son las tres decisiones "de política" del motor de generación: qué ámbito de unidad
// aplica a un paso, si un contexto debe inferir flujo de firma, y cómo se recorta la
// lista de destinatarios según la política de la regla.

// Resuelve el ámbito (unidad / tipo de unidad) de un paso de flujo. `context_exact` hereda la unidad
// del contexto del documento; el resto se declaran en el paso.
//
// SOLO QUEDA UN `context_*`, y no es un recorte estético: `context_subtree` y `context_ancestor_type`
// salieron del `CHECK` de `fill_flow_steps.unit_scope_type` en el sub-paso 8 del §0.8, así que la base
// RECHAZA la fila. Esta función solo la alimenta `assignees.js` con pasos leídos de esa columna
// (`getFillFlowSteps`), de modo que nombrarlos aquí era heredar la unidad para un valor imposible.
// Su gemela de firma (`DocumentSignatureWorkflowService.js`) SÍ los conserva, y tampoco es olvido:
// allí el ámbito puede llegar por el JSONB `signers`, que ningún `CHECK` cubre.
export const resolveScopeForStep = (step, context) => {
  const unitScopeType = String(step?.unit_scope_type || "context_exact");
  return {
    unitScopeType,
    unitId:
      (step?.unit_id ? Number(step.unit_id) : null)
      || (unitScopeType === "context_exact"
        ? (context?.scope_unit_id ? Number(context.scope_unit_id) : null)
        : null),
    unitTypeId:
      (step?.unit_type_id ? Number(step.unit_type_id) : null)
      || (unitScopeType === "unit_type" ? (context?.scope_unit_type_id ? Number(context.scope_unit_type_id) : null) : null)
  };
};

// Recorta la lista de posiciones candidatas según la política de destinatarios de la
// regla: una sola persona (posición exacta), una por unidad, o todas.
export const applyRecipientPolicy = (rows, recipientPolicy, exactPositionId = null) => {
  if (!rows.length) {
    return [];
  }
  if (recipientPolicy === "exact_position" || exactPositionId) {
    return rows.slice(0, 1);
  }
  if (recipientPolicy === "one_per_unit") {
    const seen = new Set();
    return rows.filter((row) => {
      if (seen.has(row.unit_id)) {
        return false;
      }
      seen.add(row.unit_id);
      return true;
    });
  }
  return rows;
};
