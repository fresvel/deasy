// Helpers puros de TaskGenerationService (sin `connection`, sin estado de módulo).
// Extraídos en la Fase 3. Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// Son las tres decisiones "de política" del motor de generación: qué ámbito de unidad
// aplica a un paso, si un contexto debe inferir flujo de firma, y cómo se recorta la
// lista de destinatarios según la política de la regla.

// Resuelve el ÁMBITO de un participante del recorrido: de qué unidad se saca a la gente.
// `context_exact` hereda la del documento; `unit_exact` la trae escrita; `all_units` no acota.
//
// SOLO QUEDA UN `context_*`, y no es un recorte estético: `context_subtree` y `context_ancestor_type`
// salieron del `CHECK` de la columna en el sub-paso 8 del §0.8, así que la base RECHAZA la fila, y
// nombrarlos aquí era heredar la unidad para un valor imposible.
//
// ⚠️ Y YA NO DEVUELVE `unitTypeId`. Lo leía la rama `unit_type` del resolutor por cargo, y ese ámbito
// murió con el JSONB `signers` en el paso 3b de la fase 4 del frente 24: era el único sitio por donde
// podía llegar sin pasar por un `CHECK`. Hoy el vocabulario del participante son TRES ámbitos
// (`unit_exact`, `context_exact`, `all_units`) y ninguno mira el tipo de unidad — por eso
// `scope_unit_type_id` salió también de los dos contextos que lo traían.
//
// Su gemela de firma vivía en `DocumentSignatureWorkflowService.js`, con seis ámbitos. Ya no hay
// gemela: el resolutor es uno (`generation/assignees.js`) y esta función es la suya.
export const resolveScopeForStep = (step, context) => {
  const unitScopeType = String(step?.unit_scope_type || "context_exact");
  return {
    unitScopeType,
    unitId:
      (step?.unit_id ? Number(step.unit_id) : null)
      || (unitScopeType === "context_exact"
        ? (context?.scope_unit_id ? Number(context.scope_unit_id) : null)
        : null)
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
