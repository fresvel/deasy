// Flujos de llenado y firma: normalización y validación de autoría.
//
// Extraído de SqlAdminService.js. Son funciones PURAS: no tocan la base de datos ni
// el sistema de ficheros; reciben por parámetro todo lo que necesitan (mapas de
// cargos, ids de referencia, alcance del proceso).
//
// Es el corazón del contrato de firma. Dos comportamientos que conviene tener presentes
// y que los tests fijan:
//   - `normalizeSignatureSteps` DESCARTA en silencio los firmantes `cargo_in_scope` sin
//     cargo resoluble, y los pasos que se quedan sin firmantes válidos.
//   - `collectAuthoredWorkflowIssues` distingue `errors` (bloquean) de `warnings` (no):
//     un cargo que hoy no tiene ocupante en la unidad es un aviso, no un error, porque
//     el resolver es de enlace tardío.

import {
  slugify,
  normalizeNumericId,
  normalizeBooleanFlag,
} from "../kernel/primitives.js";

// --- Catálogos de tipos permitidos -------------------------------------------

// LOS SEIS RETIRADOS (decisión 1 del §0.8, sub-paso 8). Criterio del dueño: **lo que la web no
// autora, no existe**. El `meta.yaml` era el único sitio del que podían salir `document_owner`,
// `position`, `manual_pick`, `context_subtree`, `context_ancestor_type` y `specific_person` en
// plantillas *official*; retirado el YAML se quedaron sin productor.
//
// `specific_person` NO sale de este catálogo, y no es una excepción: su retirada era «en plantillas
// *official*», y eso ya lo decide `WEB_FILL_RESOLVER_TYPES_BY_SCOPE`, que solo lo admite en *ad_hoc*
// —donde sí se autora desde la web y desde el editor de runtime—.
//
// ⚠️ EL ORDEN DE ESTA RETIRADA IMPORTA y por eso llega la última: mientras hubiera un productor,
// quitar un tipo del catálogo NO habría fallado, habría DEGRADADO el paso en silencio (ver el
// fallback de `normalizeFillSteps`, ahora convertido en error).
export const FILL_RESOLVER_TYPES = new Set([
  "task_assignee",
  "specific_person",
  "cargo_in_scope"
]);

export const WEB_FILL_RESOLVER_TYPES_BY_SCOPE = {
  official: new Set(["task_assignee", "cargo_in_scope"]),
  ad_hoc: new Set(["task_assignee", "cargo_in_scope", "specific_person"])
};

export const WEB_FILL_UNIT_SCOPE_TYPES_BY_SCOPE = {
  official: new Set(["context_exact", "unit_exact", "unit_type"]),
  ad_hoc: new Set(["context_exact", "unit_exact"])
};

export const webFillResolverTypesForScope = (scope) =>
  WEB_FILL_RESOLVER_TYPES_BY_SCOPE[scope === "ad_hoc" ? "ad_hoc" : "official"];

export const webFillUnitScopeTypesForScope = (scope) =>
  WEB_FILL_UNIT_SCOPE_TYPES_BY_SCOPE[scope === "ad_hoc" ? "ad_hoc" : "official"];

// `context_subtree` y `context_ancestor_type` salen con los seis retirados: solo el `meta.yaml`
// podía escribirlos. `unit_subtree` y `all_units` SE QUEDAN aunque el formulario tampoco los ofrezca,
// porque tienen otro productor vivo: `materializeRuntimeFlowForTaskItem` deriva `all_units` cuando el
// firmante de runtime va por cargo sin unidad ni tipo (`generation/documents.js`).
export const FILL_UNIT_SCOPE_TYPES = new Set([
  "unit_exact",
  "unit_subtree",
  "unit_type",
  "all_units",
  // Ámbito relativo al contexto del proceso (la unidad se resuelve en runtime, sin fijarla en autoría).
  "context_exact"
]);

export const FILL_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);

export const WEB_FILL_SELECTION_MODES = new Set(["auto_one", "auto_all"]);

export const SIGNATURE_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);

// Espejo de `FILL_RESOLVER_TYPES`: los mismos tres retirados, por el mismo motivo.
export const SIGNATURE_RESOLVER_TYPES = new Set([
  "task_assignee",
  "specific_person",
  "cargo_in_scope"
]);

export const SIGNATURE_UNIT_SCOPE_TYPES = new Set([
  "unit_exact",
  "unit_subtree",
  "unit_type",
  "all_units",
  "context_exact"
]);

export const SIGNATURE_APPROVAL_MODES = new Set(["and", "or", "at_least"]);

export const CARGO_CODE_ALIASES = new Map([
  ["coordinador_carrera", "coordinador"],
  ["director_escuela", "director"],
  ["director_docencia", "director"],
  ["responsable_aseguramiento_calidad", "responsable"],
  ["responsable_financiero", "responsable"],
  ["jefe_talento_humano", "jefe"]
]);


// --- Serialización y normalización -------------------------------------------

// Resolver compartido (mismo modelo "Quién hace/firma el paso" para llenado y firmas): quién resuelve el paso.
// Los flujos autorados llegan del formulario web: o ya como objeto, o como cadena JSON si el
// formulario viaja en multipart. `null` ante JSON invalido, que aguas arriba se trata igual que
// "no llego flujo". PURA: no toca base de datos ni ficheros.
export const parseWorkflowPayload = (value) => {
  if (typeof value !== "string") {
    return value ?? null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// Un flujo "tiene pasos" si es un objeto con `steps` no vacio. Se usa tanto para el fail-fast de
// creacion como para decidir si hay que validar la autoria.
export const workflowHasSteps = (workflow) =>
  Boolean(workflow && Array.isArray(workflow.steps) && workflow.steps.length);

// ¿Este lado del documento define un flujo que haya que ESCRIBIR? Marcado como requerido y con al
// menos un paso.
//
// SUSTITUYE A `isArtifactFillWorkflowSyncEnabled`/`isArtifactSignatureWorkflowSyncEnabled`
// (`artifacts.js`), que pedían además `sync_mode === "artifact_to_db"`. Ese tercer término era del
// `meta.yaml`: decía «este YAML autoriza a proyectarse a la base», y lo emitía siempre
// `buildWorkflowsDocument` con ese valor fijo. Retirado el YAML (sub-paso 8 del §0.8) la clave no
// existe, y dejar el predicado como estaba haría que el escritor directo NUNCA viera flujo que
// escribir — en silencio. Los otros dos términos se conservan literalmente, así que sobre el mismo
// documento este predicado responde exactamente lo mismo que los dos que reemplaza.
export const authoredWorkflowHasSteps = (workflow = {}) =>
  normalizeBooleanFlag(workflow?.required, false)
  && Array.isArray(workflow?.steps)
  && workflow.steps.length > 0;

export const buildStepResolver = (step) => {
  const resolver = {
    type: step?.resolver_type || "task_assignee",
    selection_mode: step?.selection_mode || "auto_one",
  };
  if (step?.resolver_type === "cargo_in_scope") {
    // El cargo se referencia por id (controlado contra la DB); se conserva cargo_code legible si viene.
    if (step?.cargo_id) resolver.cargo_id = Number(step.cargo_id);
    if (step?.cargo_code) resolver.cargo_code = step.cargo_code;
    const scopeType = step?.unit_scope_type || "context_exact";
    resolver.unit_scope_type = scopeType;
    // Ámbitos estáticos requieren fijar la unidad/tipo; los context_* la derivan del proceso en runtime.
    if ((scopeType === "unit_exact" || scopeType === "unit_subtree") && step?.unit_id) {
      resolver.unit_id = Number(step.unit_id);
    }
    if (scopeType === "unit_type" && step?.unit_type_id) {
      resolver.unit_type_id = Number(step.unit_type_id);
    }
  }
  if (step?.resolver_type === "specific_person" && step?.person_id) {
    resolver.person_id = Number(step.person_id);
  }
  return resolver;
};

// --- El SLOT de un paso de firma: identidad, no posición ----------------------
//
// EL SLOT ES LA IDENTIDAD DEL PASO, y es lo único que lo es. `flowRows.js` lo dice en su propia
// cabecera: un paso de flujo no tiene identidad propia, se escribe con DELETE + INSERT, y por eso
// «reconciliar por paso obligaría a decidir qué es *el mismo paso* cuando el usuario reordena, y no
// hay respuesta». La hay, y no está en el servidor: **la identidad viaja en la carga útil**. El
// lector la devuelve (`readSignatureSteps` -> `code`), el endpoint la publica
// (`getTemplateArtifactSchema` -> `code`) y el editor la reenvía tal cual
// (`useAdminDraftArtifactFlow.js:226`, que serializa el objeto entero). Medido de extremo a extremo:
// reordenar los pasos conservando su `code` mueve los `step_order` y NO mueve los slots.
//
// LO QUE ERA POSICIONAL —y el defecto que cierra el S7— era la ACUÑACIÓN de un slot nuevo:
// `firma_${order}`. Un paso nuevo tomaba el nombre de la posición que ocupaba, así que insertarlo en
// medio le daba el slot que otro firmante ya tenía. Medido contra la base: insertar un paso en el
// orden 2 de una plantilla con tres pasos deja DOS filas con `slot = firma_2` y responde **200** —
// dos firmantes distintos compartiendo el mismo token, en silencio y con valor legal.
//
// Se acuña contra los slots YA RECLAMADOS por el documento, no contra la posición: el primer
// `firma_N` que nadie use. Con los pasos recién creados (ninguno trae slot) da exactamente la misma
// secuencia que antes —`firma_1`, `firma_2`, `firma_3`—, así que ningún golden se mueve; la
// diferencia solo aparece cuando ya hay slots que respetar, que es justo el caso que rompía.
//
// La UNICIDAD tiene dos capas y las dos hacen falta: `checkSignatureStepSlots` la valida en autoría
// (mensaje legible, 422, junto al de orden duplicado) y `uq_signature_flow_steps_slot` la impone en
// la base (cubre a los otros escritores —el runtime y la copia de versionado— y a los que vengan).
const readDeclaredSignatureSlot = (step) => String(step?.code || step?.slot || "").trim();

const createSignatureSlotMinter = (steps = []) => {
  const claimed = new Set(
    (Array.isArray(steps) ? steps : []).map(readDeclaredSignatureSlot).filter(Boolean)
  );
  let sequence = 0;
  return () => {
    let candidate = "";
    do {
      sequence += 1;
      candidate = `firma_${sequence}`;
    } while (claimed.has(candidate));
    claimed.add(candidate);
    return candidate;
  };
};

// Construye el DOCUMENTO del flujo (fill + signatures) a partir de lo que llega del editor web.
// Devuelve el objeto; ya no se serializa a ningún sitio.
//
// SOBREVIVE AL SUB-PASO 8 y su gemelo `buildWorkflowsYaml` no, aunque el plan los listaba juntos:
// desde que el sub-paso 3 partió la función en dos, el objeto dejó de ser un paso intermedio hacia
// el YAML y pasó a ser LA ENTRADA DEL ESCRITOR DIRECTO — `_persistAuthoredFlow` normaliza
// justamente esto y lo inserta en las tablas de flujo. Lo que muere es la serialización.
//
// La estructura es la que consumen normalizeFillSteps/normalizeSignatureSteps.
export const buildWorkflowsDocument = ({ fillWorkflow, signatureWorkflow } = {}) => {
  // ── Fill ──
  const fillSteps = Array.isArray(fillWorkflow?.steps) ? fillWorkflow.steps : [];
  const fill = {
    required: fillWorkflow?.required !== false,
    steps: fillSteps.map((step, index) => {
      const order = Number(step?.order) || index + 1;
      const resolver = buildStepResolver(step);
      const out = { order };
      if (step?.code) out.code = step.code;
      out.name = step?.name || `Paso ${order}`;
      out.resolver = resolver;
      // `field_refs` YA NO SE EMITE (§0.6, cierre del censo de fósiles). Este documento dejó de ser
      // un paso hacia el `meta.yaml` en el sub-paso 3 del §0.8 y hoy tiene un único consumidor:
      // `_persistAuthoredFlow` → `normalizeFillSteps`, que no lo lee y no tiene columna donde
      // ponerlo (ver la nota de `fill_flow_steps` en `postgres_schema.sql`). Emitirlo era escribir
      // una clave que se descartaba en la línea siguiente. Tampoco tenía de dónde venir: el
      // formulario no tiene control que lo escriba.
      // Lo que lo devolvería a la vida: darle columna y que `normalizeFillSteps` la escriba — y eso
      // es modelar los campos del formulario, que el §0.8 dejó fuera de alcance a propósito
      // (decisión 3: no tienen tabla, viven en el `schema.json` de MinIO).
      out.required = step?.required !== false;
      // La capacidad de devolver se deriva del orden: solo a partir del 2º paso hay un paso previo
      // al que regresar. El 1º (entrega del dueño) nunca puede devolver.
      out.can_reject = order > 1;
      return out;
    }),
  };

  // ── Signatures ── Mismo modelo que llenado (resolver "Quién firma"). Sin anclas: cada paso lleva su SLOT de
  // token (= su code); el jinja generado embebe ahí el token del firmante resuelto (`{{ signatures.<slot>.token }}`).
  // Pasos SECUENCIALES entre sí; dentro de un paso, varios firmantes en paralelo según approval_mode (and/or/at_least).
  const sigSteps = Array.isArray(signatureWorkflow?.steps) ? signatureWorkflow.steps : [];
  const signatures = {
    required: signatureWorkflow?.required === true && sigSteps.length > 0,
  };
  const mintSignatureSlot = createSignatureSlotMinter(sigSteps);
  signatures.steps = sigSteps.map((step, index) => {
    const order = Number(step?.order) || index + 1;
    const slot = readDeclaredSignatureSlot(step) || mintSignatureSlot();
    const out = { order, code: slot, slot };
    out.name = step?.name || `Firma ${order}`;
    // Multi-firmante: cada paso lleva una lista de firmantes, cada uno con su propio resolutor. Back-compat:
    // si llega un resolutor inline sin lista, se envuelve como un único firmante.
    const signerSources = Array.isArray(step?.signers) && step.signers.length ? step.signers : [step];
    out.signers = signerSources.map((signer) =>
      buildStepResolver({ ...signer, selection_mode: signer?.selection_mode || "auto_all" })
    );
    out.approval_mode = ["and", "or", "at_least"].includes(String(step?.approval_mode)) ? step.approval_mode : "and";
    out.required_signers_min = Number(step?.required_signers_min) || 1;
    if (Number(step?.required_signers_max)) out.required_signers_max = Number(step.required_signers_max);
    out.required = step?.required !== false;
    return out;
  });

  // `dependencies: { templates: [], data: [] }` salía de aquí y era exclusivo del `meta.yaml`
  // —siempre vacío, sin productor ni consumidor—. Se va con la serialización.
  return { workflows: { fill, signatures } };
};

export const normalizeSignatureStepAnchorRefs = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

// ANTES ESTO ERA UN FALLBACK SILENCIOSO A `manual_pick`, y `manual_pick` resuelve a NADIE. Un tipo
// desconocido no producía un error: producía un paso que nunca se asignaba a nadie, sin decirlo.
// Retirado `manual_pick` del catálogo (sub-paso 8 del §0.8), mantener el fallback habría hecho algo
// peor todavía: el `INSERT` reventaría contra el `CHECK` de la tabla, en tiempo de ejecución y con un
// mensaje de PostgreSQL.
//
// Se convierte en un error de AUTORÍA, con el nombre del tipo dentro. En la práctica es inalcanzable
// desde el formulario —`collectAuthoredWorkflowIssues` rechaza antes cualquier tipo fuera de
// `webFillResolverTypesForScope`— y esa es justo la razón de que deba fallar fuerte si alguna vez se
// alcanza: significaría que hay un camino de escritura sin validar.
const assertFillResolverType = (resolverType) => {
  if (!FILL_RESOLVER_TYPES.has(resolverType)) {
    throw new Error(`Responsable de paso no soportado: "${resolverType}".`);
  }
  return resolverType;
};

export const normalizeFillSteps = (workflow = {}, { cargoCodeMap = new Map() } = {}) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  return rawSteps
    .filter((step) => step && typeof step === "object")
    .map((step, index) => {
      const resolverType = String(step?.resolver?.type || "task_assignee");
      const unitScopeType = String(step?.resolver?.unit_scope_type || "unit_exact");
      const selectionMode = String(step?.resolver?.selection_mode || "auto_one");
      const rawCargoCode = String(step?.resolver?.cargo_code || "").trim().toLowerCase();
      const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
      const stepOrder = Number(step.order) || index + 1;
      return {
        stepOrder,
        // El código y el NOMBRE del paso, leídos igual que en `normalizeSignatureSteps` (que los
        // propaga desde siempre). Hasta el sub-paso 3 del §0.8 este normalizador los descartaba: el
        // nombre que el usuario escribe en cada paso de entrega viajaba en el `meta.yaml` y se
        // perdía al proyectarlo a la base. Con las columnas del 1-bis puestas pero sin esto, la
        // inversión de la dirección del flujo lo habría perdido para siempre.
        code: String(step?.code || "").trim() || null,
        name: String(step?.name || "").trim() || null,
        resolverType: assertFillResolverType(resolverType),
        assignedPersonId: normalizeNumericId(step?.resolver?.person_id),
        unitScopeType: FILL_UNIT_SCOPE_TYPES.has(unitScopeType) ? unitScopeType : "unit_exact",
        unitId: normalizeNumericId(step?.resolver?.unit_id),
        unitTypeId: normalizeNumericId(step?.resolver?.unit_type_id),
        relationTypeId: normalizeNumericId(step?.resolver?.relation_type_id),
        cargoId: normalizeNumericId(step?.resolver?.cargo_id) || cargoCodeMap.get(normalizedCargoCode) || null,
        positionId: normalizeNumericId(step?.resolver?.position_id),
        selectionMode: FILL_SELECTION_MODES.has(selectionMode) ? selectionMode : "manual",
        isRequired: normalizeBooleanFlag(step?.required, true) ? 1 : 0,
        // Capacidad de devolver derivada del orden (solo desde el 2º paso); no se lee del input.
        canReject: stepOrder > 1 ? 1 : 0
      };
    })
    .sort((left, right) => left.stepOrder - right.stepOrder);
};

// Normaliza UN firmante (resolutor) de un paso de firma. `resolver` tiene la forma que produce buildStepResolver
// ({ type, selection_mode, cargo_id, cargo_code, unit_scope_type, unit_id, unit_type_id, person_id, position_id }).
export const normalizeSignatureSigner = (
  resolver = {},
  { cargoCodeMap = new Map(), unitTypeNameMap = new Map() } = {}
) => {
  const rawCargoCode = String(resolver?.cargo_code || resolver?.required_cargo_code || "").trim().toLowerCase();
  const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
  const resolverType = String(resolver?.type || resolver?.resolver_type || "cargo_in_scope").trim();
  const unitScopeType = String(resolver?.unit_scope_type || "context_exact").trim();
  const selectionMode = String(resolver?.selection_mode || "auto_all").trim();
  const rawUnitTypeName = String(resolver?.unit_type_name || "").trim().toLowerCase();
  return {
    resolverType: SIGNATURE_RESOLVER_TYPES.has(resolverType) ? resolverType : "cargo_in_scope",
    assignedPersonId: normalizeNumericId(resolver?.person_id),
    unitScopeType: SIGNATURE_UNIT_SCOPE_TYPES.has(unitScopeType) ? unitScopeType : "context_exact",
    unitId: normalizeNumericId(resolver?.unit_id),
    unitTypeId: normalizeNumericId(resolver?.unit_type_id) || unitTypeNameMap.get(rawUnitTypeName) || null,
    positionId: normalizeNumericId(resolver?.position_id),
    requiredCargoId: normalizeNumericId(resolver?.cargo_id) || cargoCodeMap.get(normalizedCargoCode) || null,
    selectionMode: SIGNATURE_SELECTION_MODES.has(selectionMode) ? selectionMode : "auto_all"
  };
};

export const normalizeSignatureSteps = (
  workflow = {},
  { cargoCodeMap = new Map(), unitTypeNameMap = new Map() } = {}
) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  return rawSteps
    .filter((step) => step && typeof step === "object")
    .map((step, index) => {
      const normalizedSlot = String(step.slot || "").trim() || null;
      const stepCode = String(step.code || "").trim() || null;
      const stepName = String(step.name || "").trim() || null;
      const anchorRefs = normalizeSignatureStepAnchorRefs(step.anchor_refs);
      const approvalMode = String(step.approval_mode || "and").trim().toLowerCase();
      // Back-compat: meta antigua con un único `resolver`; nueva con `signers: [...]`.
      const rawSigners = Array.isArray(step.signers) && step.signers.length
        ? step.signers
        : (step.resolver ? [step.resolver] : []);
      const signers = rawSigners
        .filter((s) => s && typeof s === "object")
        .map((s) => normalizeSignatureSigner(s, { cargoCodeMap, unitTypeNameMap }))
        // Un firmante "por cargo" sin cargo resoluble no aporta; se descarta.
        .filter((s) => s.resolverType !== "cargo_in_scope" || s.requiredCargoId);
      const primary = signers[0] || null;
      return {
        stepOrder: Number(step.order) || index + 1,
        code: stepCode,
        name: stepName,
        slot: normalizedSlot,
        // Firmante principal (mirror del primero) en las columnas del paso: fallback runtime + integridad FK.
        resolverType: primary?.resolverType || "cargo_in_scope",
        assignedPersonId: primary?.assignedPersonId || null,
        unitScopeType: primary?.unitScopeType || "context_exact",
        unitId: primary?.unitId || null,
        unitTypeId: primary?.unitTypeId || null,
        positionId: primary?.positionId || null,
        requiredCargoId: primary?.requiredCargoId || null,
        selectionMode: primary?.selectionMode || "auto_all",
        approvalMode: SIGNATURE_APPROVAL_MODES.has(approvalMode) ? approvalMode : "and",
        requiredSignersMin: normalizeNumericId(step.required_signers_min),
        requiredSignersMax: normalizeNumericId(step.required_signers_max),
        isRequired: normalizeBooleanFlag(step.required, true) ? 1 : 0,
        anchorRefs,
        signers
      };
    })
    // Un paso sin firmantes válidos no se materializa.
    .filter((step) => step.signers.length > 0)
    .sort((left, right) => left.stepOrder - right.stepOrder);
};

export const collectSignatureWorkflowNormalizationIssues = (
  workflow = {},
  { cargoCodeMap = new Map(), unitTypeNameMap = new Map() } = {}
) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  const issues = [];
  for (const [index, step] of rawSteps.entries()) {
    if (!step || typeof step !== "object") {
      continue;
    }

    const stepOrder = Number(step.order) || index + 1;
    const stepCode = String(step.code || "").trim() || `step_${stepOrder}`;

    // Misma lectura que normalizeSignatureSteps: firmantes en `signers[]` (o el `resolver` único legacy).
    const rawSigners = Array.isArray(step.signers) && step.signers.length
      ? step.signers
      : (step.resolver ? [step.resolver] : []);
    const declaredSigners = rawSigners.filter((s) => s && typeof s === "object");
    if (!declaredSigners.length) {
      continue; // sin firmantes declarados: no es un problema de resolución de cargo
    }

    // Un firmante por-cargo sin cargo resoluble (ni cargo_id ni cargo_code) lo descarta el normalizador. Solo es
    // un error si el paso se queda SIN ningún firmante válido (otros tipos —task_assignee, etc.— no necesitan cargo).
    const validSigners = declaredSigners
      .map((signer) => normalizeSignatureSigner(signer, { cargoCodeMap, unitTypeNameMap }))
      .filter((signer) => signer.resolverType !== "cargo_in_scope" || signer.requiredCargoId);
    if (!validSigners.length) {
      const badCargos = declaredSigners
        .map((signer) => String(signer.cargo_code || signer.required_cargo_code || signer.cargo_id || "").trim())
        .filter(Boolean);
      issues.push(`Paso ${stepOrder} (${stepCode}): cargo no resuelto (${badCargos.join(", ") || "vacío"}).`);
    }
  }
  return issues;
};

// Resuelve un cargo del paso (por id o por código/alias) contra el catálogo, para validar referencias.
export const resolveStepCargoId = (resolver = {}, fallbackCode = "", cargoCodeMap = new Map()) => {
  const direct = normalizeNumericId(resolver?.cargo_id);
  if (direct) {
    return direct;
  }
  const rawCode = String(resolver?.cargo_code || fallbackCode || "").trim().toLowerCase();
  if (!rawCode) {
    return null;
  }
  const normalized = slugify(CARGO_CODE_ALIASES.get(rawCode) || rawCode);
  return cargoCodeMap.get(normalized) || null;
};

// Validación de contrato de flujo EN AUTORÍA (al guardar la plantilla), no solo al vincular: detecta
// errores que de otro modo se "tragarían" silenciosamente en la normalización del sync (orden inválido/
// duplicado, responsable/firmante desconocido, referencias faltantes). Devuelve lista de problemas.
// --- Validación de flujos autorados -----------------------------------------------------------
// `collectAuthoredWorkflowIssues` era una función de 216 líneas (la peor de este módulo según
// Sonar) que mezclaba cuatro cosas: normalizar el contexto de referencia, acumular hallazgos,
// validar el responsable de un paso y recorrer los pasos de entrega y de firma. Se parte en esas
// cuatro, sin cambiar ni un mensaje.

// issues = errores que ABORTAN el guardado (imposibilidades estructurales). warnings = avisos que NO
// bloquean: el cargo no tiene HOY un puesto en la ubicación, pero el modelo es late-binding (el
// ocupante se enlaza después) y los puestos son mutables: el paso quedará pendiente y se resolverá
// cuando exista el puesto/ocupante (el runtime ya reconcilia huérfanos). Bloquear aquí impediría
// modelar puestos temporalmente vacantes.
const createIssueCollector = () => {
  const errors = [];
  const warnings = [];
  return {
    errors,
    warnings,
    error: (message) => errors.push(message),
    warn: (message) => warnings.push(message),
  };
};

const asSet = (value) => (value instanceof Set ? value : new Set());

const normalizeAuthoringContext = ({
  cargoCodeMap,
  referenceIds,
  processScope,
  resolvableCargoIds,
  templateScope,
}) => ({
  cargoCodeMap: cargoCodeMap instanceof Map ? cargoCodeMap : new Map(),
  personIds: asSet(referenceIds?.personIds),
  unitIds: asSet(referenceIds?.unitIds),
  unitTypeIds: asSet(referenceIds?.unitTypeIds),
  // Ámbito resoluble del proceso vinculado (reglas objetivo). Si no se pasó, no se aplican estas reglas.
  scopeHasRules: processScope && typeof processScope === "object" ? Boolean(processScope.has_rules) : null,
  // Cargos resolubles (con titular vigente) por ubicación: ctx = unión del alcance del proceso (para
  // "misma unidad"); byUnit = mapa unidad→Set de cargos (para "unidad específica"). Si no se pasan, no se valida.
  resolvableCtxCargoIds: resolvableCargoIds?.ctx instanceof Set ? resolvableCargoIds.ctx : null,
  resolvableCargoIdsByUnit: resolvableCargoIds?.byUnit instanceof Map ? resolvableCargoIds.byUnit : null,
  templateScope,
});

const checkStepOrders = (collector, steps, label) => {
  const seen = new Set();
  steps.forEach((step, index) => {
    const order = Number(step?.order);
    if (!Number.isInteger(order) || order < 1) {
      collector.error(`${label} ${index + 1}: el orden debe ser un entero ≥ 1.`);
    } else if (seen.has(order)) {
      collector.error(`${label}: orden duplicado (${order}).`);
    } else {
      seen.add(order);
    }
  });
};

// El formulario web envía los campos del responsable de forma PLANA (step.resolver_type, step.person_id…),
// igual que los lee buildWorkflowsYaml; se admite también la forma anidada (step.resolver.*) por robustez.
const readStepResolver = (step) => {
  const nested = (step && typeof step.resolver === "object" && step.resolver) ? step.resolver : {};
  return {
    type: step?.resolver_type || nested.type,
    person_id: step?.person_id ?? nested.person_id,
    position_id: step?.position_id ?? nested.position_id,
    cargo_id: step?.cargo_id ?? nested.cargo_id,
    cargo_code: step?.cargo_code ?? nested.cargo_code,
    unit_scope_type: step?.unit_scope_type ?? nested.unit_scope_type,
    unit_id: step?.unit_id ?? nested.unit_id,
    unit_type_id: step?.unit_type_id ?? nested.unit_type_id,
    relation_type_id: step?.relation_type_id ?? nested.relation_type_id,
    selection_mode: step?.selection_mode ?? nested.selection_mode,
  };
};

// Comprueba el ámbito de un responsable "cargo_in_scope": qué unidad resuelve y si es alcanzable.
const checkCargoScope = (collector, context, resolver, label, resolvedCargoId) => {
  const scope = String(resolver?.unit_scope_type || "context_exact");

  // Aviso (no bloqueante): el cargo no tiene HOY un puesto en la ubicación. Por late-binding el paso queda
  // pendiente y se resolverá cuando el puesto/ocupante exista (puesto temporalmente vacante o aún por crear).
  if (resolvedCargoId && scope === "context_exact" && context.resolvableCtxCargoIds && !context.resolvableCtxCargoIds.has(resolvedCargoId)) {
    collector.warn(`${label}: el cargo seleccionado aún no tiene un puesto en el alcance del proceso; el paso quedará pendiente y se resolverá cuando exista el puesto/ocupante.`);
  }
  if (resolvedCargoId && scope === "unit_exact" && context.resolvableCargoIdsByUnit) {
    const stepUnitId = normalizeNumericId(resolver?.unit_id);
    const unitCargoSet = stepUnitId ? context.resolvableCargoIdsByUnit.get(stepUnitId) : null;
    if (stepUnitId && (!unitCargoSet || !unitCargoSet.has(resolvedCargoId))) {
      collector.warn(`${label}: el cargo seleccionado aún no tiene un puesto en la unidad indicada; el paso quedará pendiente y se resolverá cuando exista el puesto/ocupante.`);
    }
  }

  if (scope === "context_exact") {
    // El ámbito de contexto resuelve la unidad del proceso vía la posición responsable; si el
    // proceso no tiene reglas objetivo, no se genera posición responsable → resolución null garantizada.
    if (context.scopeHasRules === false) {
      collector.error(`${label}: el ámbito de contexto no resolvería porque el proceso vinculado no tiene reglas objetivo.`);
    }
  }
  if (scope === "unit_exact" || scope === "unit_subtree") {
    // Unidad fija = ruteo a una oficina concreta (revisión/firma). Esa oficina puede estar FUERA del
    // alcance del proceso (p. ej. una dirección superior), así que solo se exige que exista y esté activa.
    const unitId = normalizeNumericId(resolver?.unit_id);
    if (!unitId) {
      collector.error(`${label}: el ámbito de unidad específica requiere seleccionar una unidad.`);
    } else if (context.unitIds.size && !context.unitIds.has(unitId)) {
      collector.error(`${label}: la unidad seleccionada (${unitId}) no existe o está inactiva.`);
    }
  }
  if (scope === "unit_type") {
    const unitTypeId = normalizeNumericId(resolver?.unit_type_id);
    if (!unitTypeId) {
      collector.error(`${label}: el ámbito "tipo de unidad" requiere seleccionar un tipo de unidad.`);
    } else if (context.unitTypeIds.size && !context.unitTypeIds.has(unitTypeId)) {
      collector.error(`${label}: el tipo de unidad seleccionado (${unitTypeId}) no existe o está inactivo.`);
    }
  }
};

// Valida existencia contra la DB solo si el set correspondiente está poblado (si no se pudo cargar,
// no se inventan falsos negativos; las FKs siguen siendo el último backstop al materializar).
const checkResolverRefs = (collector, context, resolver, type, label, fallbackCargoCode = "") => {
  if (type === "specific_person") {
    const personId = normalizeNumericId(resolver?.person_id);
    if (!personId) {
      collector.error(`${label}: "Persona específica" requiere seleccionar una persona.`);
    } else if (context.personIds.size && !context.personIds.has(personId)) {
      collector.error(`${label}: la persona seleccionada (${personId}) no existe o está inactiva.`);
    }
  }
  if (type === "cargo_in_scope") {
    const resolvedCargoId = resolveStepCargoId(resolver, fallbackCargoCode, context.cargoCodeMap);
    if (!resolvedCargoId) {
      collector.error(`${label}: "Cargo en ámbito" requiere seleccionar un cargo válido.`);
    }
    checkCargoScope(collector, context, resolver, label, resolvedCargoId);
  }
};

const collectFillStepIssues = (collector, context, fillSteps) => {
  checkStepOrders(collector, fillSteps, "Paso de entrega");
  const allowedResolverTypes = webFillResolverTypesForScope(context.templateScope);
  const allowedUnitScopeTypes = webFillUnitScopeTypesForScope(context.templateScope);
  const isAdHocScope = String(context.templateScope) === "ad_hoc";

  fillSteps.forEach((step, index) => {
    const label = `Paso de entrega ${index + 1}`;
    const resolver = readStepResolver(step);
    const type = String(resolver.type || "task_assignee");
    if (!allowedResolverTypes.has(type)) {
      const allowed = isAdHocScope
        ? '"Responsable del entregable", "Por cargo" o "Persona concreta"'
        : '"Responsable del entregable" o "Por cargo"';
      collector.error(`${label}: responsable no permitido para este tipo de plantilla. Usa ${allowed}.`);
      return;
    }
    // La revisión no usa subárbol ni "todas las unidades" (eso es distribución, vive en las reglas).
    if (type === "cargo_in_scope") {
      const scope = String(resolver.unit_scope_type || "context_exact");
      if (!allowedUnitScopeTypes.has(scope)) {
        const allowed = isAdHocScope
          ? "la unidad del entregable o una unidad específica"
          : "la unidad del entregable, una unidad específica o un tipo de unidad";
        collector.error(`${label}: ámbito no permitido para este tipo de plantilla. Usa ${allowed}.`);
        return;
      }
    }
    checkResolverRefs(collector, context, resolver, type, label);
    const selection = resolver.selection_mode;
    // En autoría de ENTREGA solo "uno cualquiera" / "todas". 'manual' no está implementado en entrega (el
    // resolvedor lo trata como 'todas') → se rechaza para no engañar. (Firmas sí soporta 'manual' aparte.)
    if (selection && !WEB_FILL_SELECTION_MODES.has(String(selection))) {
      collector.error(`${label}: modo no permitido en entrega. Usa "Uno cualquiera" o "Todas".`);
    }
  });
};

// Gemelo de `checkStepOrders` para la OTRA clave del paso de firma. El orden dice dónde va el paso;
// el slot dice a quién nombra el `.tex`, y dos pasos con el mismo slot es un token compartido entre
// firmantes distintos — el fallo que el S7 cierra. La acuñación ya no puede producirlo
// (`createSignatureSlotMinter`), así que un duplicado solo llega si el cliente manda dos pasos con el
// mismo `code`; se rechaza aquí para que el usuario lea un error de autoría y no la violación del
// índice único de PostgreSQL. Solo mira los slots DECLARADOS: los acuñados son únicos por construcción.
const checkSignatureStepSlots = (collector, steps) => {
  const seen = new Set();
  for (const step of steps) {
    const slot = readDeclaredSignatureSlot(step);
    if (!slot) continue;
    if (seen.has(slot)) {
      collector.error(`Paso de firma: slot duplicado (${slot}).`);
    } else {
      seen.add(slot);
    }
  }
};

const collectSignatureStepIssues = (collector, context, signatureSteps) => {
  checkStepOrders(collector, signatureSteps, "Paso de firma");
  checkSignatureStepSlots(collector, signatureSteps);
  // Mismo gating por tipo de plantilla que llenado (official: +tipo de unidad, sin persona; ad_hoc: +persona).
  const allowedResolverTypes = webFillResolverTypesForScope(context.templateScope);
  const allowedUnitScopeTypes = webFillUnitScopeTypesForScope(context.templateScope);

  signatureSteps.forEach((step, index) => {
    const label = `Paso de firma ${index + 1}`;
    const approval = String(step.approval_mode || "and");
    if (!SIGNATURE_APPROVAL_MODES.has(approval)) {
      collector.error(`${label}: modo de aprobación inválido (${approval}).`);
    }
    // Multi-firmante: valida cada firmante del paso. Back-compat: si no hay lista, el paso es un firmante.
    const signers = Array.isArray(step.signers) && step.signers.length ? step.signers : [step];
    if (!signers.length) {
      collector.error(`${label}: define al menos un firmante.`);
      return;
    }
    signers.forEach((signer, signerIndex) => {
      const signerLabel = signers.length > 1 ? `${label} · firmante ${signerIndex + 1}` : label;
      const resolver = readStepResolver(signer);
      const type = String(resolver.type || "cargo_in_scope");
      if (!allowedResolverTypes.has(type)) {
        collector.error(`${signerLabel}: firmante no permitido para este tipo de plantilla.`);
        return;
      }
      if (type === "cargo_in_scope") {
        const scope = String(resolver.unit_scope_type || "context_exact");
        if (!allowedUnitScopeTypes.has(scope)) {
          collector.error(`${signerLabel}: ámbito no permitido para este tipo de plantilla.`);
          return;
        }
      }
      checkResolverRefs(collector, context, resolver, type, signerLabel, signer.required_cargo_code);
    });
  });
};

const authoredSteps = (workflow) =>
  (Array.isArray(workflow?.steps) ? workflow.steps.filter((step) => step && typeof step === "object") : []);

export const collectAuthoredWorkflowIssues = ({
  fillWorkflow,
  signatureWorkflow,
  cargoCodeMap = new Map(),
  referenceIds = {},
  processScope = null,
  resolvableCargoIds = null,
  templateScope = "official"
} = {}) => {
  const collector = createIssueCollector();
  const context = normalizeAuthoringContext({
    cargoCodeMap,
    referenceIds,
    processScope,
    resolvableCargoIds,
    templateScope,
  });

  const fillSteps = authoredSteps(fillWorkflow);
  if (fillSteps.length) {
    collectFillStepIssues(collector, context, fillSteps);
  }

  const signatureSteps = authoredSteps(signatureWorkflow);
  if (signatureSteps.length) {
    collectSignatureStepIssues(collector, context, signatureSteps);
  }

  return { errors: collector.errors, warnings: collector.warnings };
};

