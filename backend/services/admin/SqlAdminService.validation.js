// Validación de reglas de negocio del CRUD administrativo.
//
// Extraído de SqlAdminService.js. `validateTableRules` es la última barrera antes de
// escribir en ~24 tablas del núcleo del motor de procesos. Aquí es pura (no toca la
// base de datos) y por tanto testeable sin pool: esa propiedad es la razón de que las
// reglas vivan en este módulo y no en `SqlAdminService.tableHooks.js`, cuyos hooks son
// asíncronos y con conexión.
//
// El cut #10 la partió en dos mitades. `TABLE_RULES` es un registro declarativo (13
// tablas cuya regla entera es "estos campos, en este orden, y las fechas al final");
// el `switch` que queda abajo guarda las nueve tablas con condicionales compuestas,
// mutación in-place o guards intercalados. Antes eran 22 `case` con complejidad
// cognitiva 99, la cuarta más alta del repositorio.
//
// AVISO sobre el orden de los guards: `SqlAdminService.create()` comprueba los campos
// requeridos ANTES de llamar aquí, y varias tablas tienen guards propios aún antes.
// Por eso algunas ramas son inalcanzables desde `create()` — p. ej. la de
// `unit_relations`, que create() corta con su propio mensaje. Los tests de
// caracterización (`flows/admin_crud.test.mjs`) fijan el mensaje que emerge de verdad.

import {
  assertDocumentStatusValue,
  assertDocumentVersionStatusValue,
} from "../documents/DocumentStateService.js";
import { PROCESS_SERIES_SOURCE_TYPES } from "./processDefinitionSeries.js";
import { SEMANTIC_VERSION_REGEX } from "./SqlAdminService.versioning.js";

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

const datesInOrder = (label) => (candidate) => {
  ensureDateOrder(candidate.start_date, candidate.end_date, label);
};

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
  task_assignments: [
    requires(
      ["task_id", "Selecciona una tarea para asignar."],
      ["position_id", "Selecciona un puesto para la asignacion."],
    ),
  ],
  vacancies: [],
  contracts: [
    datesInOrder("contratos"),
  ],
  role_assignments: [],
};

export const validateTableRules = (tableName, candidate) => {
  // `Array.isArray` y no un `if (rules)` a secas: `tableName` viaja desde la URL y una clave
  // heredada de Object.prototype ("constructor") devolvería algo no iterable.
  const rules = TABLE_RULES[tableName];
  if (Array.isArray(rules)) {
    for (const rule of rules) {
      rule(candidate);
    }
    return;
  }

  // Pendiente de convertir (tanda 2 del cut #10): las nueve tablas con condicionales
  // compuestas, mutación in-place del candidato o guards intercalados.
  switch (tableName) {
    case "unit_relations":
      if (candidate.parent_unit_id && candidate.child_unit_id) {
        if (Number(candidate.parent_unit_id) === Number(candidate.child_unit_id)) {
          throw new Error("La unidad padre y la unidad hija no pueden ser la misma.");
        }
      }
      break;
    case "process_definition_versions":
      if (!candidate.process_id) {
        throw new Error("Selecciona un proceso base para la configuracion.");
      }
      if (!candidate.series_id) {
        throw new Error("Selecciona una serie de configuracion.");
      }
      if (!candidate.definition_version || !SEMANTIC_VERSION_REGEX.test(String(candidate.definition_version).trim())) {
        throw new Error("La version de la configuracion debe tener formato semantico de tres segmentos (ej: 1.0.0).");
      }
      if (!candidate.effective_from) {
        throw new Error("Selecciona la fecha de vigencia inicial de la configuracion.");
      }
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "configuraciones de proceso");
      break;
    case "process_definition_series":
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
      break;
    case "process_target_rules":
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "reglas de alcance");
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una configuracion de proceso.");
      }
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
      break;
    case "task_items":
      if (!candidate.task_id) {
        throw new Error("Selecciona una tarea.");
      }
      if (
        String(candidate.origin_kind || "process_defined") === "process_defined"
        && !candidate.process_definition_template_id
      ) {
        throw new Error("Selecciona el entregable definido por proceso.");
      }
      if (!candidate.template_artifact_id) {
        throw new Error("Selecciona la plantilla documental.");
      }
      ensureDateOrder(candidate.start_date, candidate.end_date, "items de tarea");
      break;
    case "documents":
      if (!candidate.task_item_id && !candidate.owner_person_id) {
        throw new Error("Selecciona el item de tarea o define un propietario para el documento.");
      }
      if (Object.hasOwn(candidate, "status")) {
        candidate.status = assertDocumentStatusValue(candidate.status);
      }
      break;
    case "document_versions":
      if (candidate.version !== undefined) {
        const versionValue = Number(candidate.version);
        if (Number.isNaN(versionValue) || versionValue < 0.1) {
          throw new Error("La version debe ser mayor o igual a 0.1.");
        }
      }
      if (Object.hasOwn(candidate, "status")) {
        candidate.status = assertDocumentVersionStatusValue(candidate.status);
      }
      break;
    case "template_seeds":
      if (!candidate.seed_code || !candidate.source_path) {
        throw new Error("Debes registrar el codigo y la ruta fuente del seed.");
      }
      break;
    case "template_artifacts":
      if (!candidate.base_object_prefix) {
        throw new Error("Debes registrar el prefijo base del artifact.");
      }
      {
        const availableFormats = parseJsonObject(candidate.available_formats, "Formatos disponibles (JSON)");
        if (!availableFormats || !Object.keys(availableFormats).length) {
          throw new Error("Debes registrar al menos un formato disponible en available_formats.");
        }
      }
      break;
    default:
      break;
  }
};
