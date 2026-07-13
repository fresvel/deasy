// Helpers puros de TaskGenerationService (sin `connection`, sin estado de módulo).
// Extraídos en la Fase 3. Ver docs/auditoria-refactor-2026-07.md
//
// Son las tres decisiones "de política" del motor de generación: qué ámbito de unidad
// aplica a un paso, si un contexto debe inferir flujo de firma, y cómo se recorta la
// lista de destinatarios según la política de la regla.

// Resuelve el ámbito (unidad / tipo de unidad) de un paso de flujo. Los ámbitos
// `context_*` heredan del contexto del documento; el resto se declaran en el paso.
export const resolveScopeForStep = (step, context) => {
  const unitScopeType = String(step?.unit_scope_type || "context_exact");
  return {
    unitScopeType,
    unitId:
      (step?.unit_id ? Number(step.unit_id) : null)
      || (unitScopeType === "context_exact" || unitScopeType === "context_subtree" || unitScopeType === "context_ancestor_type"
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
