// Validación de reglas de negocio del CRUD administrativo.
//
// Extraído de SqlAdminService.js. `validateTableRules` es la última barrera antes de
// escribir en ~24 tablas del núcleo del motor de procesos. Aquí es pura (no toca la
// base de datos) y por tanto testeable sin pool: esa propiedad es la razón de que las
// reglas vivan en este módulo y no en `SqlAdminService.tableHooks.js`, cuyos hooks son
// asíncronos y con conexión.
//
// El cut #10 la convirtió de un `switch (tableName)` de 22 `case` y complejidad cognitiva
// 99 (la cuarta más alta del repositorio) en `TABLE_RULES`: un registro que asocia cada
// tabla a una LISTA DE REGLAS aplicadas en orden. Trece tablas quedaron como datos puros
// (`requires` / `datesInOrder`); las otras nueve aportan además una función propia, porque
// tienen condicionales compuestas, comparan campos entre sí o mutan el candidato.
//
// El ORDEN dentro de la lista es CONTRATO: el primer guard que falla decide el mensaje que
// ve el usuario. Ojo con las que INTERCALAN — `process_definition_versions` mete el semver
// entre sus requeridos, `process_target_rules` valida fechas antes que su requerido y
// `task_items` mete el guard de origen en medio. Normalizarlas a "requeridos primero"
// cambiaría el mensaje; hay tests unitarios dedicados a clavar justo eso.
//
// AVISO sobre el orden de los guards: `SqlAdminService.create()` comprueba los campos
// requeridos ANTES de llamar aquí, y varias tablas tienen guards propios aún antes.
// Por eso algunas ramas son inalcanzables desde `create()` — p. ej. la de
// `unit_relations`, que create() corta con su propio mensaje. Los tests de
// caracterización (`flows/admin_crud.test.mjs`) fijan el mensaje que emerge de verdad.

import {
  assertDocumentStatusValue,
  assertDocumentVersionStatusValue,
} from "../../documents/DocumentStateService.js";
import { PROCESS_SERIES_SOURCE_TYPES } from "../processes/processDefinitionSeries.js";
import { SEMANTIC_VERSION_REGEX } from "../kernel/versioning.js";

export const parseJsonObject = (value, fieldLabel) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    throw new Error(`El campo ${fieldLabel} debe ser un JSON valido.`);
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new Error(`El campo ${fieldLabel} debe ser un JSON valido.`);
  }
};

export const ensureDateOrder = (startDate, endDate, label) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      throw new Error(`La fecha de fin debe ser posterior a la fecha de inicio en ${label}.`);
    }
  }
};

// -------------------------------------------------------------------------------------------
// El registro de reglas por tabla (cut #10). Mismo movimiento que el cut #7 hizo con los
// injertos de create/update, aquí sobre el `switch (tableName)`: la regla de cada tabla deja
// de ser control-flow anidado y pasa a ser una LISTA DE REGLAS que se evalúan en orden.
//
// El ORDEN dentro de la lista es CONTRATO: el primer campo ausente decide el mensaje que ve el
// usuario. Por eso las tablas que intercalan condicionales entre sus requeridos (p. ej.
// `process_definition_versions`, que mete el semver en medio) NO son declarativas y siguen en
// el switch de abajo.
// -------------------------------------------------------------------------------------------

/**
 * Campos obligatorios, evaluados EN ORDEN. La comprobación es `!valor` a propósito: hoy un 0 o
 * una cadena vacía cuentan como ausentes (`fill_flow_steps.step_order = 0` se rechaza), y eso
 * está fijado por los tests.
 */
const requires = (...pairs) => (candidate) => {
  for (const [field, message] of pairs) {
    if (!candidate[field]) {
      throw new Error(message);
    }
  }
};

/**
 * Orden de fechas. La mayoría de tablas usa `start_date`/`end_date`, pero las que versionan
 * vigencias (`process_definition_versions`, `process_target_rules`) usan `effective_from`/
 * `effective_to`; de ahí los dos parámetros opcionales.
 */
const datesInOrder = (label, startField = "start_date", endField = "end_date") => (candidate) => {
  ensureDateOrder(candidate[startField], candidate[endField], label);
};

// --- Reglas propias ---------------------------------------------------------------------------
// Lo que no cabe en `requires`/`datesInOrder`: condicionales compuestas, comparaciones entre
// campos y las dos ramas que MUTAN el candidato (`documents` y `document_versions` normalizan
// el estado in-place; un refactor que se lo comiera rompería la escritura en silencio).
// Movidas literalmente desde el switch del cut #10, sin reescribir una línea.

const unitRelationNotSelf = (candidate) => {
  if (candidate.parent_unit_id && candidate.child_unit_id) {
    if (Number(candidate.parent_unit_id) === Number(candidate.child_unit_id)) {
      throw new Error("La unidad padre y la unidad hija no pueden ser la misma.");
    }
  }
};

const semanticVersionRequired = (candidate) => {
  if (!candidate.definition_version || !SEMANTIC_VERSION_REGEX.test(String(candidate.definition_version).trim())) {
    throw new Error("La version de la configuracion debe tener formato semantico de tres segmentos (ej: 1.0.0).");
  }
};

const seriesSourceConsistent = (candidate) => {
  if (!candidate.source_type || !PROCESS_SERIES_SOURCE_TYPES.has(String(candidate.source_type))) {
    throw new Error("Selecciona el origen de la serie.");
  }

  if (candidate.source_type === "unit_type" && !candidate.unit_type_id) {
    throw new Error("Una serie por tipo de unidad requiere seleccionar un tipo de unidad.");
  }

  if (candidate.source_type === "cargo" && !candidate.cargo_id) {
    throw new Error("Una serie por cargo requiere seleccionar un cargo.");
  }

  if (candidate.source_type === "unit_type" && candidate.cargo_id) {
    throw new Error("Una serie por tipo de unidad no admite cargo.");
  }

  if (candidate.source_type === "cargo" && candidate.unit_type_id) {
    throw new Error("Una serie por cargo no admite tipo de unidad.");
  }

  if (candidate.source_type === "default" && (candidate.unit_type_id || candidate.cargo_id)) {
    throw new Error("La serie por defecto no admite tipo de unidad ni cargo.");
  }
};

const targetScopeConsistent = (candidate) => {
  if (candidate.recipient_policy === "exact_position" && !candidate.position_id) {
    throw new Error("La politica exact_position requiere un puesto exacto.");
  }

  if (candidate.unit_scope_type === "unit_exact" || candidate.unit_scope_type === "unit_subtree") {
    if (!candidate.unit_id && !candidate.position_id) {
      throw new Error("El alcance por unidad requiere una unidad base.");
    }
  }

  if (candidate.unit_scope_type === "unit_type" && !candidate.unit_type_id) {
    throw new Error("El alcance por tipo requiere un tipo de unidad.");
  }
};

const processDefinedNeedsTemplate = (candidate) => {
  if (
    String(candidate.origin_kind || "process_defined") === "process_defined"
    && !candidate.process_definition_template_id
  ) {
    throw new Error("Selecciona el entregable definido por proceso.");
  }
};

// Solo el estado. La otra mitad de esta regla —"item de tarea O propietario"— sostenía el
// "documento suelto", retirado: un documento no existe sin su entregable, así que `task_item_id`
// pasó a ser un requerido más y vive abajo, en `TABLE_RULES`. Lo que NO se puede perder es la
// normalización in-place del estado: muta el candidato y sin ella la escritura guarda el literal
// legacy sin que ningún error lo delate.
const documentStatusValue = (candidate) => {
  if (Object.hasOwn(candidate, "status")) {
    candidate.status = assertDocumentStatusValue(candidate.status);
  }
};

const documentVersionNumberAndStatus = (candidate) => {
  // La version es la RONDA, y es un entero desde el 2026-08-23: la 1 es el primer intento del flujo
  // y cada reinicio abre la siguiente. Las CORRECCIONES son el segundo digito y no se escriben aqui
  // — las lleva `document_version_uploads`, una fila por subida.
  if (candidate.version !== undefined) {
    const versionValue = Number(candidate.version);
    if (!Number.isInteger(versionValue) || versionValue < 1) {
      throw new Error("La version (ronda) debe ser un entero mayor o igual a 1.");
    }
  }

  if (Object.hasOwn(candidate, "status")) {
    candidate.status = assertDocumentVersionStatusValue(candidate.status);
  }
};

const seedCodeAndSourcePath = (candidate) => {
  if (!candidate.seed_code || !candidate.source_path) {
    throw new Error("Debes registrar el codigo y la ruta fuente del seed.");
  }
};

// El bloque `{ }` que envolvía esto en el switch solo existía para acotar el `const`; dentro de
// una función ya no hace falta.
const artifactFormatsPresent = (candidate) => {
  const availableFormats = parseJsonObject(candidate.available_formats, "Formatos disponibles (JSON)");
  if (!availableFormats || !Object.keys(availableFormats).length) {
    throw new Error("Debes registrar al menos un formato disponible en available_formats.");
  }
};

// --- El registro ------------------------------------------------------------------------------
const TABLE_RULES = {
  terms: [
    datesInOrder("periodos"),
  ],
  processes: [],
  process_definition_period_types: [
    requires(
      ["process_definition_id", "Selecciona una configuracion de proceso."],
      ["term_type_id", "Selecciona el tipo de periodo en que corre el proceso."],
    ),
  ],
  tasks: [
    requires(
      ["process_definition_id", "Selecciona una configuracion de proceso."],
      ["term_id", "Selecciona un periodo para la tarea."],
    ),
    datesInOrder("tareas"),
  ],
  fill_flow_templates: [
    requires(["process_definition_template_id", "Selecciona la plantilla de proceso configurado."]),
  ],
  fill_flow_steps: [
    requires(
      ["fill_flow_template_id", "Selecciona la plantilla de entrega."],
      ["step_order", "Define el orden del paso."],
    ),
  ],
  document_fill_flows: [
    requires(
      ["fill_flow_template_id", "Selecciona la plantilla de entrega."],
      ["document_version_id", "Selecciona la version de documento."],
    ),
  ],
  fill_requests: [
    requires(
      ["document_fill_flow_id", "Selecciona la instancia de entrega."],
      ["fill_flow_step_id", "Selecciona el paso de entrega."],
    ),
  ],
  signature_flow_templates: [
    requires(["process_definition_template_id", "Selecciona la plantilla de proceso configurado."]),
  ],
  vacancies: [],
  contracts: [
    datesInOrder("contratos"),
  ],
  role_assignments: [],

  // Tablas con reglas propias (tanda 2).
  unit_relations: [
    unitRelationNotSelf,
  ],
  process_definition_versions: [
    requires(
      ["process_id", "Selecciona un proceso base para la configuracion."],
      ["series_id", "Selecciona una serie de configuracion."],
    ),
    semanticVersionRequired,
    requires(["effective_from", "Selecciona la fecha de vigencia inicial de la configuracion."]),
    datesInOrder("configuraciones de proceso", "effective_from", "effective_to"),
  ],
  process_definition_series: [
    seriesSourceConsistent,
  ],
  process_target_rules: [
    datesInOrder("reglas de alcance", "effective_from", "effective_to"),
    requires(["process_definition_id", "Selecciona una configuracion de proceso."]),
    targetScopeConsistent,
  ],
  task_items: [
    requires(["task_id", "Selecciona una tarea."]),
    processDefinedNeedsTemplate,
    requires(["template_artifact_id", "Selecciona la plantilla documental."]),
    datesInOrder("items de tarea"),
  ],
  documents: [
    requires(["task_item_id", "Selecciona el item de tarea del documento."]),
    documentStatusValue,
  ],
  document_versions: [
    documentVersionNumberAndStatus,
  ],
  template_seeds: [
    seedCodeAndSourcePath,
  ],
  template_artifacts: [
    requires(["base_object_prefix", "Debes registrar el prefijo base del artifact."]),
    artifactFormatsPresent,
  ],
};

/** Aplica en orden las reglas de la tabla. Una tabla sin entrada no tiene reglas. */
export const validateTableRules = (tableName, candidate) => {
  // `Array.isArray` y no un `if (rules)` a secas: `tableName` viaja desde la URL y una clave
  // heredada de Object.prototype ("constructor") devolvería algo no iterable.
  const rules = TABLE_RULES[tableName];
  if (!Array.isArray(rules)) {
    return;
  }
  for (const rule of rules) {
    rule(candidate);
  }
};
