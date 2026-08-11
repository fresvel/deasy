// Las FILAS de flujo (entrega y firma) de una plantilla: quién las escribe y quién las cuenta. Es el
// ÚNICO sitio del dominio de plantillas que inserta pasos en `fill_flow_steps` /
// `signature_flow_steps`, y desde el sub-paso 4 también el único que los cuenta.
//
// POR QUÉ EXISTE (sub-paso 3 del §0.8 del plan maestro). Estos dos INSERT vivían dentro de
// `WorkflowSyncService` (`workflowSync.js:246` y `:304`), que los alimenta desde el `meta.yaml` de
// MinIO. La inversión de la dirección del flujo añade un SEGUNDO escritor —el formulario web, que
// escribe directo en la base— y los dos tienen que producir la MISMA fila, columna por columna. Con
// dos copias del INSERT eso sería una promesa; con una sola es una propiedad. `WorkflowSyncService`
// delega aquí; cuando el sync desaparezca (sub-paso 8) este módulo se queda.
//
// NO DEPENDE DE this.pool NI DE NINGÚN SERVICIO: recibe la `connection` por parámetro, así que el
// llamador decide si va suelto o dentro de una transacción. `saveTemplateArtifactDraft` lo llama
// dentro de la suya.

// --- Pasos --------------------------------------------------------------------------------------
//
// DELETE + INSERT, no UPSERT: el flujo es una LISTA ORDENADA y un paso no tiene identidad propia
// (su clave es `(plantilla, step_order)`). Reconciliar por paso obligaría a decidir qué es "el mismo
// paso" cuando el usuario reordena, y no hay respuesta.

// `code` y `name` entran en el INSERT con el sub-paso 3. Existían como columnas desde el 1-bis pero
// nadie las escribía: el nombre que el usuario pone a cada paso de ENTREGA vivía solo dentro del
// `meta.yaml`, y la inversión lo habría perdido. El lado de la firma ya los escribía desde siempre.
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
         code,
         name,
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fillFlowTemplateId,
        step.stepOrder,
        step.code ?? null,
        step.name ?? null,
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

// --- Cabeceras colgadas de la PLANTILLA ---------------------------------------------------------
//
// El portador es `template_artifact_id`, con `process_definition_template_id` y `task_item_id` a
// NULL. Esa forma no es una convención: es LITERALMENTE la que exige el escalón 3 del resolvedor
// (`generation/queries.js`), que además pide `is_active = 1`. Cambiarla aquí deja el flujo escrito y
// no leído por nadie.
//
// Hay UNA cabecera por artifact y lado, y se reutiliza entre guardados. No lleva el marcador
// `artifact_sync_*` de las del vínculo porque no lo necesita: el vínculo tiene N flujos y hay que
// distinguir el que puso el sync, mientras que la plantilla tiene el suyo y se localiza por su
// portador.
//
// SIN GUARDA DE USO EN RUNTIME, a diferencia del sync (`hasFillFlowTemplateRuntimeUsage`), y es
// deliberado: durante la escritura doble el escalón 2 (el flujo del vínculo, que el sync siembra
// para TODOS los vínculos) tapa siempre al 3, así que ninguna instancia en curso puede apuntar a
// esta cabecera. Y `saveTemplateArtifactDraft` solo corre sobre artifacts en `draft`: una versión
// publicada es inmutable. Cuando el sync desaparezca (sub-paso 8), la invariante que queda es esa
// inmutabilidad, tal como dice §0.8 «Riesgos».
const HEADER_TABLES = {
  fill: { table: "fill_flow_templates", stepsTable: "fill_flow_steps", stepsKey: "fill_flow_template_id" },
  signature: { table: "signature_flow_templates", stepsTable: "signature_flow_steps", stepsKey: "template_id" },
};

const findArtifactFlowHeaderId = async (connection, table, artifactId) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM ${table}
     WHERE template_artifact_id = ?
       AND process_definition_template_id IS NULL
       AND task_item_id IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [artifactId]
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
};

// Deja la cabecera de un lado (entrega o firma) reflejando exactamente `steps`:
//   · con pasos  -> crea o reactiva la cabecera y reescribe sus pasos;
//   · sin pasos  -> desactiva la cabecera y borra sus pasos, para que no quede un flujo fantasma que
//     el escalón 3 pudiera servir el día que el del vínculo deje de existir.
// Devuelve `{ flowTemplateId, steps }` (o `null` si no había nada que hacer), que es lo que el
// llamador informa en la respuesta.
const replaceArtifactFlowSide = async (connection, side, { artifactId, name, steps, writeSteps }) => {
  const { table, stepsTable, stepsKey } = HEADER_TABLES[side];
  let headerId = await findArtifactFlowHeaderId(connection, table, artifactId);

  if (!steps.length) {
    if (!headerId) {
      return null;
    }
    await connection.query(`DELETE FROM ${stepsTable} WHERE ${stepsKey} = ?`, [headerId]);
    await connection.query(`UPDATE ${table} SET is_active = 0, name = ? WHERE id = ?`, [name, headerId]);
    return { flowTemplateId: headerId, steps: 0 };
  }

  if (headerId) {
    await connection.query(`UPDATE ${table} SET name = ?, is_active = 1 WHERE id = ?`, [name, headerId]);
  } else {
    const [inserted] = await connection.query(
      `INSERT INTO ${table} (template_artifact_id, name, is_active)
       VALUES (?, ?, 1)`,
      [artifactId, name]
    );
    headerId = Number(inserted.insertId);
  }

  await writeSteps(connection, headerId, steps);
  return { flowTemplateId: headerId, steps: steps.length };
};

// Escribe en la base el flujo AUTORADO de una plantilla, colgando de `template_artifact_id`.
// `fillSteps`/`signatureSteps` llegan ya normalizados (misma forma que consume el sync), porque la
// normalización necesita los catálogos de cargos y tipos de unidad y este módulo no toca servicios.
export const replaceAuthoredFlowForArtifact = async (
  connection,
  { artifactId, displayName = "", fillSteps = [], signatureSteps = [] } = {}
) => {
  const id = Number(artifactId);
  if (!id) {
    throw new Error("replaceAuthoredFlowForArtifact requiere el id del template_artifact.");
  }
  const label = String(displayName || "").trim();

  const fill = await replaceArtifactFlowSide(connection, "fill", {
    artifactId: id,
    name: `Flujo de entrega - ${label}`,
    steps: fillSteps,
    writeSteps: replaceFillFlowSteps,
  });
  const signature = await replaceArtifactFlowSide(connection, "signature", {
    artifactId: id,
    name: `Flujo de firma - ${label}`,
    steps: signatureSteps,
    writeSteps: replaceSignatureFlowSteps,
  });

  return { fill, signatures: signature };
};

// --- Lectura: ¿esta plantilla define flujo de ENTREGA? -------------------------------------------
//
// La usan los CUATRO gates de publicación (`templateArtifact.setTemplateArtifactActive` y
// `.publishTemplateArtifact`; `templateLifecycle.publishDraftTemplatesForDefinition` y
// `.finishTemplateUpdate`). Hasta el sub-paso 4 del §0.8 los cuatro leían el `meta.yaml` de MinIO
// envueltos en un `catch {}` mudo que traducía CUALQUIER fallo —MinIO caído, objeto ausente, YAML
// ilegible— a "esta plantilla no define flujo de entrega", y bloqueaba la publicación por una razón
// falsa. Aquí no hay `catch`: un error de base se PROPAGA. Es el motivo real de la mudanza.
//
// POR QUÉ CUENTA POR LOS DOS PORTADORES, y por qué es ANDAMIAJE y no diseño final. Tras el sub-paso
// 3 el flujo de una plantilla puede estar en dos sitios, y hoy hay plantillas reales en cada uno:
//
//   · `template_artifact_id`            -> lo escribe el formulario web (sub-paso 3). Lo NUEVO.
//   · `process_definition_template_id`  -> lo siembra el sync desde el `meta.yaml`, para CADA vínculo.
//
// Medido en la base de dev recién sembrada: las dos plantillas de la fixture tienen 0 pasos por
// artifact y 1 por vínculo. Es decir, TODO lo que existe hoy llegó por el sync — el bootstrap
// siembra `BASE_META_YAML` (sub-paso 7) y `createTemplateArtifactVersion` copia MinIO en binario sin
// copiar filas (sub-paso 6). Contar solo por artifact rechazaría toda plantilla que no se haya
// vuelto a guardar por el formulario, incluida la que produce el update guiado: medido con un
// experimento desechable, deja `zz_template_lifecycle :: guided_update_finish` en 400 "No se puede
// publicar…". Contar por los dos es exactamente el conjunto que hoy pasa el gate leyendo el YAML.
//
// El segundo término MUERE SOLO: el sub-paso 6 hace que versionar copie filas, el 7 quita
// `BASE_META_YAML` y el 8 vacía las filas del vínculo que sembró el sync. Cuando esa rama del OR
// quede vacía, se borra y queda el portador único.
//
// Las dos guardas del WHERE no son adorno:
//   · `f.task_item_id IS NULL` excluye el flujo de RUNTIME, que lleva vínculo Y entregable. Sin
//     ella, un `routed` "definiría flujo de entrega" en cuanto alguien enviara un entregable.
//   · `f.is_active = 1` excluye las cabeceras que el sync DESACTIVA sin borrarles los pasos
//     (`workflowSync.js:322-334`): sus filas siguen ahí y contarían un flujo retirado.
export const hasFillStepsForArtifact = async (connection, artifactId) => {
  const id = Number(artifactId);
  if (!id) return false;
  const [rows] = await connection.query(
    `SELECT EXISTS(
       SELECT 1
       FROM fill_flow_steps s
       JOIN fill_flow_templates f ON f.id = s.fill_flow_template_id
       WHERE f.is_active = 1
         AND f.task_item_id IS NULL
         AND (
           (f.template_artifact_id = ? AND f.process_definition_template_id IS NULL)
           OR f.process_definition_template_id IN (
             SELECT pdt.id FROM process_definition_templates pdt WHERE pdt.template_artifact_id = ?
           )
         )
       LIMIT 1
     ) AS has_steps`,
    [id, id]
  );
  return Boolean(Number(rows?.[0]?.has_steps || 0));
};
