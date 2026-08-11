// Escritura de las FILAS de flujo (entrega y firma). Es el ÚNICO sitio del dominio de plantillas que
// inserta pasos en `fill_flow_steps` / `signature_flow_steps`.
//
// POR QUÉ EXISTE (sub-paso 3 del §0.8 del plan maestro). Estos dos INSERT vivían dentro de
// `WorkflowSyncService` (`workflowSync.js:246` y `:304`), que los alimenta desde el `meta.yaml` de
// MinIO. La inversión de la dirección del flujo va a añadir un SEGUNDO escritor —el formulario web,
// que escribirá directo en la base— y los dos tienen que producir la MISMA fila, columna por
// columna. Con dos copias del INSERT eso sería una promesa; con una sola es una propiedad.
// `WorkflowSyncService` delega aquí; cuando el sync desaparezca (sub-paso 8) este módulo se queda.
//
// NO DEPENDE DE this.pool NI DE NINGÚN SERVICIO: recibe la `connection` por parámetro, así que el
// llamador decide si va suelto o dentro de una transacción. `saveTemplateArtifactDraft` lo llama
// dentro de la suya.

// --- Pasos --------------------------------------------------------------------------------------
//
// DELETE + INSERT, no UPSERT: el flujo es una LISTA ORDENADA y un paso no tiene identidad propia
// (su clave es `(plantilla, step_order)`). Reconciliar por paso obligaría a decidir qué es "el mismo
// paso" cuando el usuario reordena, y no hay respuesta.

export const replaceFillFlowSteps = async (connection, fillFlowTemplateId, steps = []) => {
  await connection.query(
    "DELETE FROM fill_flow_steps WHERE fill_flow_template_id = ?",
    [fillFlowTemplateId]
  );

  for (const step of steps) {
    await connection.query(
      `INSERT INTO fill_flow_steps (
         fill_flow_template_id,
         step_order,
         resolver_type,
         assigned_person_id,
         unit_scope_type,
         unit_id,
         unit_type_id,
         relation_type_id,
         cargo_id,
         position_id,
         selection_mode,
         is_required,
         can_reject
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fillFlowTemplateId,
        step.stepOrder,
        step.resolverType,
        step.assignedPersonId,
        step.unitScopeType,
        step.unitId,
        step.unitTypeId,
        step.relationTypeId ?? null,
        step.cargoId,
        step.positionId,
        step.selectionMode,
        step.isRequired,
        step.canReject
      ]
    );
  }
};

export const replaceSignatureFlowSteps = async (connection, signatureFlowTemplateId, steps = []) => {
  await connection.query(
    "DELETE FROM signature_flow_steps WHERE template_id = ?",
    [signatureFlowTemplateId]
  );

  for (const step of steps) {
    await connection.query(
      `INSERT INTO signature_flow_steps (
         template_id,
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
         anchor_refs,
         signers
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        signatureFlowTemplateId,
        step.stepOrder,
        step.code,
        step.name,
        step.slot,
        step.resolverType,
        step.assignedPersonId,
        step.unitScopeType,
        step.unitId,
        step.unitTypeId,
        step.positionId,
        step.requiredCargoId,
        step.selectionMode,
        step.approvalMode,
        step.requiredSignersMin,
        step.requiredSignersMax,
        step.isRequired,
        JSON.stringify(Array.isArray(step.anchorRefs) ? step.anchorRefs : []),
        JSON.stringify(Array.isArray(step.signers) ? step.signers : [])
      ]
    );
  }
};
