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

// --- Lectura: EL FLUJO AUTORADO de una plantilla, para reabrirlo en el editor ---------------------
//
// Sub-paso 5 del §0.8: el segundo lector. `getTemplateArtifactSchema`
// (`templateArtifact.js`) reconstruía `fill_workflow`/`signature_workflow` desde el `meta.yaml` de
// MinIO; ahora los reconstruye desde estas filas. Es el lector que faltaba en el plan original: sin
// él, el día que la sección `workflows:` deje de emitirse (sub-paso 8) reabrir una plantilla la
// mostraría SIN flujo, y el siguiente guardado lo borraría.
//
// LO QUE DEVUELVE ES EL DOCUMENTO `workflows:`, NO LA FORMA DEL FORMULARIO, y no es un capricho:
// es la MISMA estructura que produce `buildWorkflowsDocument` (`workflows.js`), que es lo que el
// endpoint ya sabía aplanar. Así el endpoint no cambia ni una línea de su mapeo y la equivalencia
// campo a campo del contrato HTTP —el frontend está fuera de alcance— se sostiene por construcción
// en vez de por promesa. Estas funciones son, literalmente, la INVERSA de `buildStepResolver` +
// `normalizeFillSteps`/`normalizeSignatureSteps`.
//
// ⚠️ POR QUÉ LA INVERSA Y NO LAS COLUMNAS CRUDAS. Medido con un experimento desechable sobre la base
// de dev: volcar la columna tal cual mueve `unit_scope_type` de `context_exact` a `unit_exact` en
// TODO paso cuyo resolutor no sea por cargo —incluida la plantilla de la fixture—, porque
// `normalizeFillSteps` guarda ahí su valor por defecto aunque el ámbito no signifique nada para ese
// resolutor. `buildStepResolver` solo emite `unit_scope_type` para `cargo_in_scope`; emitirlo igual
// aquí devuelve el contrato exacto que el formulario recibe hoy.

// Un resolutor a partir de las columnas de un paso: la inversa exacta de `buildStepResolver`.
// Las claves que aquel no emite tampoco se emiten aquí; el aplanado del endpoint pone su valor por
// defecto, que es de dónde salían antes.
const resolverFromStepColumns = (row = {}) => {
  const type = String(row.resolver_type || "").trim() || "task_assignee";
  const resolver = { type };
  const selectionMode = String(row.selection_mode || "").trim();
  if (selectionMode) resolver.selection_mode = selectionMode;
  if (type === "cargo_in_scope") {
    if (row.cargo_id) resolver.cargo_id = Number(row.cargo_id);
    const scopeType = String(row.unit_scope_type || "").trim();
    if (scopeType) resolver.unit_scope_type = scopeType;
    if (row.unit_id) resolver.unit_id = Number(row.unit_id);
    if (row.unit_type_id) resolver.unit_type_id = Number(row.unit_type_id);
    if (row.relation_type_id) resolver.relation_type_id = Number(row.relation_type_id);
  }
  if (type === "specific_person" && row.assigned_person_id) {
    resolver.person_id = Number(row.assigned_person_id);
  }
  if (type === "position" && row.position_id) {
    resolver.position_id = Number(row.position_id);
  }
  return resolver;
};

// El JSONB `signers` tiene DOS CONVENCIONES VIVAS en la misma columna, y no es teoría: se ve en la
// base de dev recién sembrada.
//   · camelCase — lo escribe este módulo desde `normalizeSignatureSigner` (`workflows.js`):
//     {"resolverType","requiredCargoId","unitScopeType","unitId","assignedPersonId",…}
//   · snake_case — lo escribe `materializeRuntimeFlowForTaskItem` (`generation/documents.js`) con lo
//     que llegó del formulario de runtime: {"type","cargo_id","unit_id","person_id",…}
// Hoy solo la primera puede llegar hasta aquí (la segunda cuelga SIEMPRE de un `task_item_id`, que
// este lector excluye), pero se aceptan las dos por el mismo motivo que `parseStepSigners`
// (`DocumentSignatureWorkflowService.js`) las acepta: el lector no debe depender de qué escritor
// rellenó la fila. Si el §0.8 unifica la convención, aquí no hay nada que tocar.
const resolverFromSigner = (signer = {}) => {
  const type = String(signer.resolverType || signer.type || "").trim() || "cargo_in_scope";
  const resolver = { type };
  const selectionMode = String(signer.selectionMode || signer.selection_mode || "").trim();
  if (selectionMode) resolver.selection_mode = selectionMode;
  const cargoId = Number(signer.requiredCargoId || signer.cargo_id) || null;
  const unitId = Number(signer.unitId || signer.unit_id) || null;
  const unitTypeId = Number(signer.unitTypeId || signer.unit_type_id) || null;
  const personId = Number(signer.assignedPersonId || signer.person_id) || null;
  const positionId = Number(signer.positionId || signer.position_id) || null;
  if (type === "cargo_in_scope") {
    if (cargoId) resolver.cargo_id = cargoId;
    const scopeType = String(signer.unitScopeType || signer.unit_scope_type || "").trim();
    if (scopeType) resolver.unit_scope_type = scopeType;
    if (unitId) resolver.unit_id = unitId;
    if (unitTypeId) resolver.unit_type_id = unitTypeId;
  }
  if (type === "specific_person" && personId) resolver.person_id = personId;
  if (type === "position" && positionId) resolver.position_id = positionId;
  return resolver;
};

const parseSignersColumn = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// DÓNDE VIVE EL FLUJO DE ESTA PLANTILLA: tres portadores, por PRIORIDAD y no por «cuál está relleno».
//   1. `template_artifact_id` — el flujo AUTORADO, uno solo, el que escribe el formulario web.
//   2. `process_definition_template_id` — el que el sync siembra en CADA vínculo desde el
//      `meta.yaml`. Es el mismo conjunto que cuenta `hasFillStepsForArtifact`, y ANDAMIAJE por la
//      misma razón: hoy toda plantilla que no se haya vuelto a guardar por el formulario (las del
//      bootstrap) solo tiene esta copia, y sin ella reabrirlas mostraría el flujo vacío.
//   3. La VERSIÓN PADRE (`parent_version_id`), subiendo por el linaje. También ANDAMIAJE, y este se
//      descubrió EN EL NAVEGADOR verificando este mismo sub-paso: `createTemplateArtifactVersion`
//      copia MinIO en binario y NO crea filas de flujo ni vínculo, así que una versión recién creada
//      no tiene NINGÚN portador propio. Su flujo lo llevaba el `meta.yaml` copiado byte a byte — o
//      sea, el de su padre. Sin este escalón, versionar una plantilla y reabrirla mostraba el flujo
//      VACÍO y el primer guardado lo borraba. Medido en dev: el artifact 11 (v1.2.0 de
//      `tpl_informe_general`) devolvía `steps: []` con su propio meta declarando `owner_fill`.
// Los escalones 2 y 3 MUEREN JUNTOS con los sub-pasos 6, 7 y 8 (cuando versionar copie filas y el
// sync desaparezca): entonces se borran los dos y queda el portador único.
//
// El orden es el CONTRARIO al del resolvedor de runtime (`generation/queries.js`), y a propósito: allí
// el flujo del vínculo es el específico y el de la plantilla el genérico; aquí se está leyendo QUÉ
// AUTORÓ EL USUARIO PARA LA PLANTILLA, y de eso la copia del vínculo es un reflejo. Mientras dure la
// escritura doble las dos son idénticas (salen del mismo objeto), así que el orden solo decide de
// cuál se lee, no qué se lee.
//
// ⚠️ LO QUE DECIDE EL ESCALÓN ES QUE LA CABECERA EXISTA, NO QUE ESTÉ ACTIVA. Una cabecera desactivada
// significa «el autor quitó el flujo de este lado»: así la deja `replaceArtifactFlowSide` y así la
// deja el sync (`workflowSync.js`), en los dos casos sin borrarla. Eso es una RESPUESTA, no un hueco,
// y hay que devolver flujo vacío sin seguir bajando. Con `is_active = 1` en la búsqueda, quitarle
// todos los pasos a una versión y reabrirla los resucitaría desde su padre.
const findFlowSourceHeader = async (connection, table, artifactId) => {
  const [byArtifact] = await connection.query(
    `SELECT id, is_active
     FROM ${table}
     WHERE template_artifact_id = ?
       AND process_definition_template_id IS NULL
       AND task_item_id IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [artifactId]
  );
  if (byArtifact?.[0]) return byArtifact[0];

  const [byLink] = await connection.query(
    `SELECT id, is_active
     FROM ${table}
     WHERE process_definition_template_id IN (
             SELECT pdt.id FROM process_definition_templates pdt WHERE pdt.template_artifact_id = ?
           )
       AND task_item_id IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [artifactId]
  );
  return byLink?.[0] || null;
};

// Tope del ascenso por el linaje. No es una constante de rendimiento: es la guarda contra un
// `parent_version_id` que apunte en círculo, que el esquema no impide.
const MAX_VERSION_ANCESTRY = 10;

const findParentVersionId = async (connection, artifactId) => {
  const [rows] = await connection.query(
    "SELECT parent_version_id FROM template_artifacts WHERE id = ? LIMIT 1",
    [artifactId]
  );
  return rows?.[0]?.parent_version_id ? Number(rows[0].parent_version_id) : null;
};

const findFlowSourceHeaderId = async (connection, table, artifactId) => {
  let currentId = artifactId;
  for (let depth = 0; currentId && depth < MAX_VERSION_ANCESTRY; depth += 1) {
    const header = await findFlowSourceHeader(connection, table, currentId);
    if (header) {
      return Number(header.is_active) === 1 ? Number(header.id) : null;
    }
    currentId = await findParentVersionId(connection, currentId);
  }
  return null;
};


const readFillSteps = async (connection, headerId) => {
  if (!headerId) return [];
  const [rows] = await connection.query(
    `SELECT step_order, code, name, resolver_type, assigned_person_id, unit_scope_type,
            unit_id, unit_type_id, relation_type_id, cargo_id, position_id, selection_mode,
            is_required
     FROM fill_flow_steps
     WHERE fill_flow_template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [headerId]
  );
  return rows.map((row) => {
    const step = { order: Number(row.step_order) || 0 };
    const code = String(row.code || "").trim();
    if (code) step.code = code;
    step.name = String(row.name || "").trim();
    step.resolver = resolverFromStepColumns(row);
    // `field_refs` NO se lee: no tiene columna y NADIE puede darle valor (sub-paso 1-bis). Sale `[]`
    // por el aplanado del endpoint, que es lo mismo que salía del meta.
    step.required = Number(row.is_required) !== 0;
    return step;
  });
};

const readSignatureSteps = async (connection, headerId) => {
  if (!headerId) return [];
  const [rows] = await connection.query(
    `SELECT step_order, code, name, slot, resolver_type, assigned_person_id, unit_scope_type,
            unit_id, unit_type_id, position_id, required_cargo_id, selection_mode,
            approval_mode, required_signers_min, required_signers_max, is_required, signers
     FROM signature_flow_steps
     WHERE template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [headerId]
  );
  return rows.map((row) => {
    const stored = parseSignersColumn(row.signers);
    // Back-compat, espejo del que ya tenía el lector del meta («`signers: [...]` o un `resolver`
    // único»): un paso sin lista se lee como UN firmante con las columnas del propio paso, que es
    // donde `normalizeSignatureSteps` deja el firmante principal.
    const signers = stored.length
      ? stored.map(resolverFromSigner)
      : [resolverFromStepColumns({ ...row, cargo_id: row.required_cargo_id })];
    const step = { order: Number(row.step_order) || 0 };
    const code = String(row.code || "").trim();
    if (code) step.code = code;
    const slot = String(row.slot || "").trim();
    if (slot) step.slot = slot;
    step.name = String(row.name || "").trim();
    step.signers = signers;
    step.approval_mode = String(row.approval_mode || "").trim() || "and";
    if (row.required_signers_min) step.required_signers_min = Number(row.required_signers_min);
    if (row.required_signers_max) step.required_signers_max = Number(row.required_signers_max);
    step.required = Number(row.is_required) !== 0;
    return step;
  });
};

// El flujo autorado de una plantilla, con la forma de `workflowsDocument.workflows`.
//
// LAS DOS BANDERAS `required` NO TIENEN COLUMNA, y se derivan sin inventar nada:
//   · entrega  -> SIEMPRE `true`. Es lo que emite `buildWorkflowsDocument` para todo lo que pasa por
//     el formulario (`required !== false`, y el formulario fija `true`), y es el valor que el propio
//     endpoint ya devolvía por defecto cuando no había meta que leer.
//   · firma    -> `hay pasos`. Equivale EXACTAMENTE al `sig.required === true` que se leía del meta:
//     las filas solo existen si el escritor vio `required` verdadero
//     (`isArtifactSignatureWorkflowSyncEnabled`), así que «hay filas» y «estaba marcado» son el mismo
//     hecho.
//
// SIN `catch`: un fallo de base SUBE, igual que en el sub-paso 4. Tragarlo aquí es peor que en los
// gates —y allí ya bloqueaba publicaciones por una razón falsa—: este lector es lo que rellena el
// editor, así que un «flujo vacío» inventado se convierte en BORRADO del flujo en cuanto el usuario
// guarda. Y sería incoherente: la lectura del propio artifact, dos líneas antes en el endpoint, ya
// propaga.
export const readAuthoredFlowForArtifact = async (connection, artifactId) => {
  const id = Number(artifactId);
  if (!id) {
    return { fill: { required: true, steps: [] }, signatures: { required: false, steps: [] } };
  }
  const [fillHeaderId, signatureHeaderId] = await Promise.all([
    findFlowSourceHeaderId(connection, "fill_flow_templates", id),
    findFlowSourceHeaderId(connection, "signature_flow_templates", id),
  ]);
  const [fillSteps, signatureSteps] = await Promise.all([
    readFillSteps(connection, fillHeaderId),
    readSignatureSteps(connection, signatureHeaderId),
  ]);
  return {
    fill: { required: true, steps: fillSteps },
    signatures: { required: signatureSteps.length > 0, steps: signatureSteps },
  };
};
