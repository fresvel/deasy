// Flujos de llenado y firma: normalización, serialización a YAML y validación de autoría.
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

import yaml from "js-yaml";

import {
  slugify,
  normalizeNumericId,
  normalizeBooleanFlag,
} from "./SqlAdminService.primitives.js";

// --- Catálogos de tipos permitidos -------------------------------------------

export const FILL_RESOLVER_TYPES = new Set([
  "task_assignee",
  "document_owner",
  "specific_person",
  "position",
  "cargo_in_scope",
  "manual_pick"
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

export const FILL_UNIT_SCOPE_TYPES = new Set([
  "unit_exact",
  "unit_subtree",
  "unit_type",
  "all_units",
  // Ámbitos relativos al contexto del proceso (la unidad se resuelve en runtime, sin fijarla en autoría).
  "context_exact",
  "context_subtree",
  "context_ancestor_type"
]);

export const FILL_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);

export const WEB_FILL_SELECTION_MODES = new Set(["auto_one", "auto_all"]);

export const SIGNATURE_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);

export const SIGNATURE_RESOLVER_TYPES = new Set([
  "task_assignee",
  "document_owner",
  "specific_person",
  "position",
  "cargo_in_scope",
  "manual_pick"
]);

export const SIGNATURE_UNIT_SCOPE_TYPES = new Set([
  "unit_exact",
  "unit_subtree",
  "unit_type",
  "all_units",
  "context_exact",
  "context_subtree",
  "context_ancestor_type"
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
    // Ancestro: sube por el grafo de la relación (NULL = 'org'); el tipo de unidad es el tope opcional.
    if (scopeType === "context_ancestor_type") {
      if (step?.unit_type_id) resolver.unit_type_id = Number(step.unit_type_id);
      if (step?.relation_type_id) resolver.relation_type_id = Number(step.relation_type_id);
    }
  }
  if (step?.resolver_type === "specific_person" && step?.person_id) {
    resolver.person_id = Number(step.person_id);
  }
  if (step?.resolver_type === "position" && step?.position_id) {
    resolver.position_id = Number(step.position_id);
  }
  return resolver;
};

// Genera el bloque `workflows:` (fill + signatures) + `dependencies:` a partir de los flujos definidos en
// el editor web. Construye un objeto y lo serializa con yaml.dump (maneja saltos de línea/comillas/caracteres
// especiales de forma segura). Produce la misma estructura que consumen normalizeFillSteps/normalizeSignatureSteps.
export const buildWorkflowsYaml = ({ fillWorkflow, signatureWorkflow } = {}) => {
  // ── Fill ──
  const fillSteps = Array.isArray(fillWorkflow?.steps) ? fillWorkflow.steps : [];
  const fill = {
    required: fillWorkflow?.required !== false,
    source: "artifact",
    sync_mode: "artifact_to_db",
    steps: fillSteps.map((step, index) => {
      const order = Number(step?.order) || index + 1;
      const resolver = buildStepResolver(step);
      const out = { order };
      if (step?.code) out.code = step.code;
      out.name = step?.name || `Paso ${order}`;
      out.resolver = resolver;
      const fieldRefs = Array.isArray(step?.field_refs) ? step.field_refs.filter(Boolean) : [];
      if (fieldRefs.length) out.field_refs = fieldRefs;
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
    source: "artifact",
    sync_mode: "artifact_to_db",
  };
  signatures.steps = sigSteps.map((step, index) => {
    const order = Number(step?.order) || index + 1;
    const slot = String(step?.code || step?.slot || `firma_${order}`);
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

  const doc = {
    workflows: { fill, signatures },
    dependencies: { templates: [], data: [] },
  };
  return yaml.dump(doc, { lineWidth: -1, noRefs: true });
};

export const normalizeSignatureStepAnchorRefs = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
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
        resolverType: FILL_RESOLVER_TYPES.has(resolverType) ? resolverType : "manual_pick",
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
export const collectAuthoredWorkflowIssues = ({
  fillWorkflow,
  signatureWorkflow,
  cargoCodeMap = new Map(),
  referenceIds = {},
  processScope = null,
  resolvableCargoIds = null,
  templateScope = "official"
} = {}) => {
  const personIds = referenceIds?.personIds instanceof Set ? referenceIds.personIds : new Set();
  const positionIds = referenceIds?.positionIds instanceof Set ? referenceIds.positionIds : new Set();
  const unitIds = referenceIds?.unitIds instanceof Set ? referenceIds.unitIds : new Set();
  const unitTypeIds = referenceIds?.unitTypeIds instanceof Set ? referenceIds.unitTypeIds : new Set();
  // Ámbito resoluble del proceso vinculado (reglas objetivo). Si no se pasó, no se aplican estas reglas.
  const hasProcessScope = processScope && typeof processScope === "object";
  const scopeHasRules = hasProcessScope ? Boolean(processScope.has_rules) : null;
  const scopeAllUnits = hasProcessScope ? Boolean(processScope.all_units) : false;
  const scopeUnitIds = hasProcessScope && Array.isArray(processScope.unit_ids)
    ? new Set(processScope.unit_ids.map((id) => Number(id)))
    : new Set();
  // Cargos resolubles (con titular vigente) por ubicación: ctx = unión del alcance del proceso (para
  // "misma unidad"); byUnit = mapa unidad→Set de cargos (para "unidad específica"). Si no se pasan, no se valida.
  const resolvableCtxCargoIds = resolvableCargoIds?.ctx instanceof Set ? resolvableCargoIds.ctx : null;
  const resolvableCargoIdsByUnit = resolvableCargoIds?.byUnit instanceof Map ? resolvableCargoIds.byUnit : null;
  // issues = errores que ABORTAN el guardado (imposibilidades estructurales). warnings = avisos que NO bloquean:
  // el cargo no tiene HOY un puesto en la ubicación, pero el modelo es late-binding (el ocupante se enlaza
  // después) y los puestos son mutables: el paso quedará pendiente y se resolverá cuando exista el puesto/ocupante
  // (el runtime ya reconcilia huérfanos). Bloquear aquí impediría modelar puestos temporalmente vacantes.
  const issues = [];
  const warnings = [];
  const checkOrders = (steps, label) => {
    const seen = new Set();
    steps.forEach((step, index) => {
      const order = Number(step?.order);
      if (!Number.isInteger(order) || order < 1) {
        issues.push(`${label} ${index + 1}: el orden debe ser un entero ≥ 1.`);
      } else if (seen.has(order)) {
        issues.push(`${label}: orden duplicado (${order}).`);
      } else {
        seen.add(order);
      }
    });
  };
  // El formulario web envía los campos del responsable de forma PLANA (step.resolver_type, step.person_id…),
  // igual que los lee buildWorkflowsYaml; se admite también la forma anidada (step.resolver.*) por robustez.
  const getStepResolver = (step) => {
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
      selection_mode: step?.selection_mode ?? nested.selection_mode
    };
  };
  // Valida existencia contra la DB solo si el set correspondiente está poblado (si no se pudo cargar,
  // no se inventan falsos negativos; las FKs siguen siendo el último backstop al materializar).
  const checkResolverRefs = (resolver, type, label, fallbackCargoCode = "") => {
    if (type === "specific_person") {
      const personId = normalizeNumericId(resolver?.person_id);
      if (!personId) {
        issues.push(`${label}: "Persona específica" requiere seleccionar una persona.`);
      } else if (personIds.size && !personIds.has(personId)) {
        issues.push(`${label}: la persona seleccionada (${personId}) no existe o está inactiva.`);
      }
    }
    if (type === "position") {
      const positionId = normalizeNumericId(resolver?.position_id);
      if (!positionId) {
        issues.push(`${label}: "Posición" requiere seleccionar una posición.`);
      } else if (positionIds.size && !positionIds.has(positionId)) {
        issues.push(`${label}: la posición seleccionada (${positionId}) no existe o está inactiva.`);
      }
    }
    if (type === "cargo_in_scope") {
      const resolvedCargoId = resolveStepCargoId(resolver, fallbackCargoCode, cargoCodeMap);
      if (!resolvedCargoId) {
        issues.push(`${label}: "Cargo en ámbito" requiere seleccionar un cargo válido.`);
      }
      const scope = String(resolver?.unit_scope_type || "context_exact");
      // Aviso (no bloqueante): el cargo no tiene HOY un puesto en la ubicación. Por late-binding el paso queda
      // pendiente y se resolverá cuando el puesto/ocupante exista (puesto temporalmente vacante o aún por crear).
      if (resolvedCargoId && scope === "context_exact" && resolvableCtxCargoIds && !resolvableCtxCargoIds.has(resolvedCargoId)) {
        warnings.push(`${label}: el cargo seleccionado aún no tiene un puesto en el alcance del proceso; el paso quedará pendiente y se resolverá cuando exista el puesto/ocupante.`);
      }
      if (resolvedCargoId && scope === "unit_exact" && resolvableCargoIdsByUnit) {
        const stepUnitId = normalizeNumericId(resolver?.unit_id);
        const unitCargoSet = stepUnitId ? resolvableCargoIdsByUnit.get(stepUnitId) : null;
        if (stepUnitId && (!unitCargoSet || !unitCargoSet.has(resolvedCargoId))) {
          warnings.push(`${label}: el cargo seleccionado aún no tiene un puesto en la unidad indicada; el paso quedará pendiente y se resolverá cuando exista el puesto/ocupante.`);
        }
      }
      if (scope === "context_exact" || scope === "context_subtree") {
        // Los ámbitos de contexto resuelven la unidad del proceso vía la posición responsable; si el
        // proceso no tiene reglas objetivo, no se genera posición responsable → resolución null garantizada.
        if (scopeHasRules === false) {
          issues.push(`${label}: el ámbito de contexto no resolvería porque el proceso vinculado no tiene reglas objetivo.`);
        }
      }
      if (scope === "unit_exact" || scope === "unit_subtree") {
        // Unidad fija = ruteo a una oficina concreta (revisión/firma). Esa oficina puede estar FUERA del
        // alcance del proceso (p. ej. una dirección superior), así que solo se exige que exista y esté activa.
        const unitId = normalizeNumericId(resolver?.unit_id);
        if (!unitId) {
          issues.push(`${label}: el ámbito de unidad específica requiere seleccionar una unidad.`);
        } else if (unitIds.size && !unitIds.has(unitId)) {
          issues.push(`${label}: la unidad seleccionada (${unitId}) no existe o está inactiva.`);
        }
      }
      if (scope === "unit_type") {
        const unitTypeId = normalizeNumericId(resolver?.unit_type_id);
        if (!unitTypeId) {
          issues.push(`${label}: el ámbito "tipo de unidad" requiere seleccionar un tipo de unidad.`);
        } else if (unitTypeIds.size && !unitTypeIds.has(unitTypeId)) {
          issues.push(`${label}: el tipo de unidad seleccionado (${unitTypeId}) no existe o está inactivo.`);
        }
      }
      if (scope === "context_ancestor_type") {
        // Sube por el grafo de la relación elegida (o 'org') hasta el ancestro más cercano. El tipo de unidad
        // es opcional (sin tipo = el padre directo por esa relación); si se indica, se valida que exista.
        const unitTypeId = normalizeNumericId(resolver?.unit_type_id);
        if (unitTypeId && unitTypeIds.size && !unitTypeIds.has(unitTypeId)) {
          issues.push(`${label}: el tipo de unidad seleccionado (${unitTypeId}) no existe o está inactivo.`);
        }
        if (scopeHasRules === false) {
          issues.push(`${label}: el ámbito de contexto no resolvería porque el proceso vinculado no tiene reglas objetivo.`);
        }
      }
    }
  };

  const fillSteps = Array.isArray(fillWorkflow?.steps) ? fillWorkflow.steps.filter((s) => s && typeof s === "object") : [];
  if (fillSteps.length) {
    checkOrders(fillSteps, "Paso de entrega");
    const allowedResolverTypes = webFillResolverTypesForScope(templateScope);
    const allowedUnitScopeTypes = webFillUnitScopeTypesForScope(templateScope);
    const isAdHocScope = String(templateScope) === "ad_hoc";
    fillSteps.forEach((step, index) => {
      const label = `Paso de entrega ${index + 1}`;
      const resolver = getStepResolver(step);
      const type = String(resolver.type || "task_assignee");
      if (!allowedResolverTypes.has(type)) {
        const allowed = isAdHocScope
          ? '"Responsable del entregable", "Por cargo" o "Persona concreta"'
          : '"Responsable del entregable" o "Por cargo"';
        issues.push(`${label}: responsable no permitido para este tipo de plantilla. Usa ${allowed}.`);
        return;
      }
      // La revisión no usa subárbol ni "todas las unidades" (eso es distribución, vive en las reglas).
      if (type === "cargo_in_scope") {
        const scope = String(resolver.unit_scope_type || "context_exact");
        if (!allowedUnitScopeTypes.has(scope)) {
          const allowed = isAdHocScope
            ? "la unidad del entregable o una unidad específica"
            : "la unidad del entregable, una unidad específica o un tipo de unidad";
          issues.push(`${label}: ámbito no permitido para este tipo de plantilla. Usa ${allowed}.`);
          return;
        }
      }
      checkResolverRefs(resolver, type, label);
      const selection = resolver.selection_mode;
      // En autoría de ENTREGA solo "uno cualquiera" / "todas". 'manual' no está implementado en entrega (el
      // resolvedor lo trata como 'todas') → se rechaza para no engañar. (Firmas sí soporta 'manual' aparte.)
      if (selection && !WEB_FILL_SELECTION_MODES.has(String(selection))) {
        issues.push(`${label}: modo no permitido en entrega. Usa "Uno cualquiera" o "Todas".`);
      }
    });
  }

  const signatureSteps = Array.isArray(signatureWorkflow?.steps) ? signatureWorkflow.steps.filter((s) => s && typeof s === "object") : [];
  if (signatureSteps.length) {
    checkOrders(signatureSteps, "Paso de firma");
    // Mismo gating por tipo de plantilla que llenado (official: +tipo de unidad, sin persona; ad_hoc: +persona).
    const sigAllowedResolverTypes = webFillResolverTypesForScope(templateScope);
    const sigAllowedUnitScopeTypes = webFillUnitScopeTypesForScope(templateScope);
    signatureSteps.forEach((step, index) => {
      const label = `Paso de firma ${index + 1}`;
      const approval = String(step.approval_mode || "and");
      if (!SIGNATURE_APPROVAL_MODES.has(approval)) {
        issues.push(`${label}: modo de aprobación inválido (${approval}).`);
      }
      // Multi-firmante: valida cada firmante del paso. Back-compat: si no hay lista, el paso es un firmante.
      const signers = Array.isArray(step.signers) && step.signers.length ? step.signers : [step];
      if (!signers.length) {
        issues.push(`${label}: define al menos un firmante.`);
        return;
      }
      signers.forEach((signer, si) => {
        const signerLabel = signers.length > 1 ? `${label} · firmante ${si + 1}` : label;
        const resolver = getStepResolver(signer);
        const type = String(resolver.type || "cargo_in_scope");
        if (!sigAllowedResolverTypes.has(type)) {
          issues.push(`${signerLabel}: firmante no permitido para este tipo de plantilla.`);
          return;
        }
        if (type === "cargo_in_scope") {
          const scope = String(resolver.unit_scope_type || "context_exact");
          if (!sigAllowedUnitScopeTypes.has(scope)) {
            issues.push(`${signerLabel}: ámbito no permitido para este tipo de plantilla.`);
            return;
          }
        }
        checkResolverRefs(resolver, type, signerLabel, signer.required_cargo_code);
      });
    });
  }

  return { errors: issues, warnings };
};

