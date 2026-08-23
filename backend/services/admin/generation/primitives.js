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

// Recorta la lista de posiciones candidatas según la política de destinatarios de la regla:
// todas, sólo la jefatura de cada unidad, o un puesto nombrado.
//
// ── Por qué `one_per_unit` ya no existe (2026-08-23) ──────────────────────────────────────
// Prometía dos cosas distintas según la pantalla —«Un puesto por unidad» en el panel de reglas
// y «Jefatura de la unidad» en el organigrama— y no cumplía ninguna: se quedaba con la PRIMERA
// fila de cada unidad, y las filas vienen ordenadas por `slot_no`. O sea, «el puesto de menor
// número de ranura», que no es una regla de negocio: es la misma arbitrariedad que se retiró de
// `tasks.responsible_position_id`.
//
// De las dos etiquetas, una sí nombraba un concepto real —la jefatura— y la base ya sabe
// expresarlo (`unit_positions.is_unit_head`). Así que el valor se sustituye por `unit_head`, con
// nombre nuevo A PROPÓSITO: una regla que dijera `one_per_unit` deja de ser válida y hay que
// migrarla a mano, mirando cuál de las dos promesas quería. Cambiarle el significado al valor
// viejo habría movido el comportamiento de las reglas existentes en silencio.
export const applyRecipientPolicy = (rows, recipientPolicy, exactPositionId = null) => {
  if (!rows.length) {
    return [];
  }
  if (recipientPolicy === "exact_position" || exactPositionId) {
    return rows.slice(0, 1);
  }
  if (recipientPolicy === "unit_head") {
    // Una unidad puede no tener jefatura —hoy pasa en 2 de 13—, y entonces NO se inventa un
    // sustituto: la unidad se queda fuera del alcance de la regla. Elegir «el primero» es
    // exactamente el fallo que este cambio viene a cerrar.
    return rows.filter((row) => Number(row.is_unit_head) === 1);
  }
  return rows;
};
