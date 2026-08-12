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
// UN SOLO PORTADOR, desde el sub-paso 8. El sub-paso 4 dejó aquí un `OR` sobre DOS portadores y lo
// declaró andamiaje en su propio comentario:
//
//   · `template_artifact_id`            -> lo escribe el formulario web. El bueno.
//   · `process_definition_template_id`  -> lo sembraba el sync desde el `meta.yaml`, uno por vínculo.
//
// El segundo término hacía falta HOY, y estaba medido: toda plantilla que no se hubiera vuelto a
// guardar por el formulario tenía su flujo solo ahí, así que contar solo por artifact la habría
// dejado inpublicable. Los sub-pasos 6, 7 y 8 le quitaron sus tres fuentes —el versionado copia
// filas, `BASE_META_YAML` se retiró, y el sync ya no existe—, y con eso la rama se quedó vacía. Se
// borra aquí, medida antes de borrarla: con el segundo término anulado a mano, `test:char:run` da
// 281/281.
//
// Las dos guardas del WHERE no son adorno:
//   · `f.task_item_id IS NULL` excluye el flujo de RUNTIME, que lleva vínculo Y entregable. Sin
//     ella, un `routed` "definiría flujo de entrega" en cuanto alguien enviara un entregable.
//   · `f.is_active = 1` excluye las cabeceras que `replaceArtifactFlowSide` DESACTIVA sin borrarlas
//     cuando el autor quita el flujo de un lado: contarían un flujo retirado.
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
         AND f.template_artifact_id = ?
         AND f.process_definition_template_id IS NULL
       LIMIT 1
     ) AS has_steps`,
    [id]
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

// DÓNDE VIVE EL FLUJO DE ESTA PLANTILLA: en su propio portador, `template_artifact_id`, y en ningún
// otro sitio. Es lo que el sub-paso 8 viene a dejar.
//
// AQUÍ HUBO TRES ESCALONES, y los dos últimos eran andamiaje declarado:
//   2. `process_definition_template_id` — el que el sync sembraba en CADA vínculo desde el
//      `meta.yaml`. Hacía falta mientras el bootstrap y las versiones antiguas tuvieran su flujo
//      solo ahí. Sin sync no hay quien lo escriba.
//   3. La VERSIÓN PADRE (`parent_version_id`), subiendo por el linaje. Existió porque
//      `createTemplateArtifactVersion` copiaba MinIO en binario y NO creaba filas, así que una
//      versión recién creada no tenía portador propio y reabrirla mostraba el flujo VACÍO — y el
//      primer guardado lo borraba. Desde el sub-paso 6 el versionado copia FILAS, así que la hija
//      nace con portador propio y entra por el escalón 1.
//
// LOS DOS, MEDIDOS ANTES DE BORRARLOS, cada uno por separado y luego juntos: `test:char:run` da
// 281/281 en los tres casos, incluido «una VERSION recien creada hereda el flujo de su padre», que
// es el que el escalón 3 existía para sostener. Ahora lo sostiene la copia de filas.
//
// ⚠️ LO QUE SOBREVIVE Y NO ES OBVIO: lo que decide la respuesta es que la cabecera EXISTA, no que
// esté activa. Una cabecera desactivada significa «el autor quitó el flujo de este lado» —así la
// deja `replaceArtifactFlowSide`, sin borrarla— y eso es una RESPUESTA (flujo vacío), no un hueco.
// Ya no hay a dónde seguir bajando, pero la distinción se conserva porque es la que hace que quitar
// todos los pasos de un lado se lea como «no hay flujo» y no como «no encontré nada».
const findFlowSourceHeaderId = async (connection, table, artifactId) => {
  const [rows] = await connection.query(
    `SELECT id, is_active
     FROM ${table}
     WHERE template_artifact_id = ?
       AND process_definition_template_id IS NULL
       AND task_item_id IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [artifactId]
  );
  const header = rows?.[0];
  if (!header) return null;
  return Number(header.is_active) === 1 ? Number(header.id) : null;
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

// --- Copia: el flujo del PADRE pasa a colgar de la HIJA ------------------------------------------
//
// Sub-paso 6 del §0.8. `createTemplateArtifactVersion` (`templateArtifact.js`) y
// `forkDeliverableForConfig` (`templateLifecycle.js`) copian los objetos de MinIO EN BINARIO y no
// creaban ni una fila de flujo. Mientras el flujo vivía dentro del `meta.yaml` eso bastaba —el
// paquete llevaba el flujo dentro— y por eso nadie lo notó; desde que el flujo vive en la base, una
// versión nueva nacía SIN FLUJO. Dos consecuencias medidas:
//   · publicarla respondía 400 «la plantilla debe definir al menos un paso de flujo de entrega»,
//     porque el gate del sub-paso 4 cuenta FILAS;
//   · y el lector del editor necesitó un tercer escalón (subir al padre por `parent_version_id`)
//     para no enseñar el flujo vacío.
// Copiando las filas, las dos dejan de ser necesarias por la vía del parche.
//
// QUÉ SE COPIA, Y POR QUÉ ESA Y NO OTRA. El origen se busca con `findFlowSourceHeaderId`, o sea con
// LA MISMA BÚSQUEDA QUE HACE EL EDITOR. No es reutilización por comodidad: la propiedad que se
// quiere es «la hija nace con el flujo que el editor mostraba para el padre». Cualquier otro
// criterio haría que versionar CAMBIE el flujo.
//   · Del ARTIFACT (`template_artifact_id`): el flujo autorado. Es el único caso desde el sub-paso 8;
//     antes había dos escalones más —el vínculo y la versión padre— y su motivo está en el
//     comentario de `findFlowSourceHeaderId`.
//   · Del TASK_ITEM (`task_item_id`): **NUNCA**, y no por precaución. Esa cabecera es el flujo que
//     un usuario definió al enviar UN entregable concreto en modo `routed`
//     (`materializeRuntimeFlowForTaskItem`): copiarla a una plantilla convertiría la decisión de un
//     envío en la definición de todas las versiones futuras. La consulta ya exige
//     `task_item_id IS NULL`, así que la exclusión es estructural, no un filtro añadido aquí.
//     El grupo de control `runtime_*` del characterization es lo que lo vigila.
//
// `is_active`: la hija nace con cabecera ACTIVA si hay pasos que copiar, y SIN NINGUNA CABECERA si
// no los hay. El caso interesante es el del padre con la cabecera DESACTIVADA, que significa «el
// autor quitó el flujo de este lado» (así la deja `replaceArtifactFlowSide`, sin borrarla): la
// búsqueda devuelve `null`, no se copia nada, y la hija —que se queda sin ninguna cabecera— responde
// lo mismo que el padre, flujo vacío. Crear una cabecera desactivada y vacía daría el mismo
// comportamiento con una fila fantasma de más.
//
// POR QUÉ NO UN `INSERT ... SELECT`, que sería la copia literal: sería un SEGUNDO escritor de
// `fill_flow_steps` / `signature_flow_steps` con su propia lista de columnas, y este módulo existe
// precisamente para que haya UNO. Se leen las columnas y se vuelven a escribir por el escritor de
// siempre; si mañana se añade una columna al INSERT, la copia la arrastra sola.
//
// Y POR QUÉ NO SE REUSA `readFillSteps`/`readSignatureSteps`: esos devuelven el DOCUMENTO, que es
// una proyección con pérdida —no lleva `can_reject`, ni `anchor_refs`, ni `required_signers_max`, ni
// el `unit_scope_type` de los pasos que no son por cargo, y traduce el JSONB `signers`—. Reconstruir
// la fila desde ahí exigiría volver a normalizar con los catálogos de cargos y tipos de unidad, que
// este módulo no tiene. La copia lee las MISMAS columnas que el INSERT escribe, ni una más.

const readFillStepsForCopy = async (connection, headerId) => {
  if (!headerId) return [];
  const [rows] = await connection.query(
    `SELECT step_order, code, name, resolver_type, assigned_person_id, unit_scope_type,
            unit_id, unit_type_id, relation_type_id, cargo_id, position_id, selection_mode,
            is_required, can_reject
     FROM fill_flow_steps
     WHERE fill_flow_template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [headerId]
  );
  return rows.map((row) => ({
    stepOrder: Number(row.step_order) || 0,
    code: row.code ?? null,
    name: row.name ?? null,
    resolverType: row.resolver_type ?? null,
    assignedPersonId: row.assigned_person_id ?? null,
    unitScopeType: row.unit_scope_type ?? null,
    unitId: row.unit_id ?? null,
    unitTypeId: row.unit_type_id ?? null,
    relationTypeId: row.relation_type_id ?? null,
    cargoId: row.cargo_id ?? null,
    positionId: row.position_id ?? null,
    selectionMode: row.selection_mode ?? null,
    isRequired: row.is_required,
    canReject: row.can_reject,
  }));
};

const readSignatureStepsForCopy = async (connection, headerId) => {
  if (!headerId) return [];
  const [rows] = await connection.query(
    `SELECT step_order, code, name, slot, resolver_type, assigned_person_id, unit_scope_type,
            unit_id, unit_type_id, position_id, required_cargo_id, selection_mode, approval_mode,
            required_signers_min, required_signers_max, is_required, anchor_refs, signers
     FROM signature_flow_steps
     WHERE template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [headerId]
  );
  // `signers` y `anchor_refs` se releen TAL CUAL y el escritor los vuelve a serializar. No se
  // traduce la convención de nombres del JSONB (ver `resolverFromSigner`): una copia que
  // reinterpretara el contenido dejaría de ser una copia.
  return rows.map((row) => ({
    stepOrder: Number(row.step_order) || 0,
    code: row.code ?? null,
    name: row.name ?? null,
    slot: row.slot ?? null,
    resolverType: row.resolver_type ?? null,
    assignedPersonId: row.assigned_person_id ?? null,
    unitScopeType: row.unit_scope_type ?? null,
    unitId: row.unit_id ?? null,
    unitTypeId: row.unit_type_id ?? null,
    positionId: row.position_id ?? null,
    requiredCargoId: row.required_cargo_id ?? null,
    selectionMode: row.selection_mode ?? null,
    approvalMode: row.approval_mode ?? null,
    requiredSignersMin: row.required_signers_min ?? null,
    requiredSignersMax: row.required_signers_max ?? null,
    isRequired: row.is_required,
    anchorRefs: parseSignersColumn(row.anchor_refs),
    signers: parseSignersColumn(row.signers),
  }));
};

// Deja colgando de `targetArtifactId` el mismo flujo (entrega y firma) que hoy define
// `sourceArtifactId`. Ids nuevos, contenido idéntico.
//
// SECUENCIAL A PROPÓSITO, sin `Promise.all`: a diferencia del lector —que corre contra el pool—
// esto se llama DENTRO de una transacción, y una conexión sola no atiende dos consultas a la vez.
export const copyAuthoredFlowToArtifact = async (
  connection,
  { sourceArtifactId, targetArtifactId, displayName = "" } = {}
) => {
  const source = Number(sourceArtifactId);
  const target = Number(targetArtifactId);
  if (!source || !target) {
    throw new Error("copyAuthoredFlowToArtifact requiere el id de origen y el de destino.");
  }
  const fillHeaderId = await findFlowSourceHeaderId(connection, "fill_flow_templates", source);
  const signatureHeaderId = await findFlowSourceHeaderId(connection, "signature_flow_templates", source);
  const fillSteps = await readFillStepsForCopy(connection, fillHeaderId);
  const signatureSteps = await readSignatureStepsForCopy(connection, signatureHeaderId);
  return replaceAuthoredFlowForArtifact(connection, {
    artifactId: target,
    displayName,
    fillSteps,
    signatureSteps,
  });
};
