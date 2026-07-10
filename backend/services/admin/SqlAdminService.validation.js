// Validación de reglas de negocio del CRUD administrativo.
//
// Extraído de SqlAdminService.js. `validateTableRules` es la última barrera antes de
// escribir en ~24 tablas del núcleo del motor de procesos; Sonar le mide una
// complejidad cognitiva de 99, la cuarta más alta del repositorio. Aquí es pura
// (no toca la base de datos) y por tanto testeable.
//
// AVISO sobre el orden de los guards: `SqlAdminService.create()` comprueba los campos
// requeridos ANTES de llamar aquí, y varias tablas tienen guards propios aún antes.
// Por eso algunas ramas de este switch son inalcanzables desde `create()` — p. ej. la
// de `unit_relations`, que create() corta con su propio mensaje. Los tests de
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

export const validateTableRules = (tableName, candidate) => {
  switch (tableName) {
    case "unit_relations":
      if (candidate.parent_unit_id && candidate.child_unit_id) {
        if (Number(candidate.parent_unit_id) === Number(candidate.child_unit_id)) {
          throw new Error("La unidad padre y la unidad hija no pueden ser la misma.");
        }
      }
      break;
    case "terms":
      ensureDateOrder(candidate.start_date, candidate.end_date, "periodos");
      break;
    case "processes":
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
    case "process_definition_period_types":
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una configuracion de proceso.");
      }
      if (!candidate.term_type_id) {
        throw new Error("Selecciona el tipo de periodo en que corre el proceso.");
      }
      break;
    case "tasks":
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una configuracion de proceso.");
      }
      if (!candidate.term_id) {
        throw new Error("Selecciona un periodo para la tarea.");
      }
      ensureDateOrder(candidate.start_date, candidate.end_date, "tareas");
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
    case "fill_flow_templates":
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso configurado.");
      }
      break;
    case "fill_flow_steps":
      if (!candidate.fill_flow_template_id) {
        throw new Error("Selecciona la plantilla de entrega.");
      }
      if (!candidate.step_order) {
        throw new Error("Define el orden del paso.");
      }
      break;
    case "document_fill_flows":
      if (!candidate.fill_flow_template_id) {
        throw new Error("Selecciona la plantilla de entrega.");
      }
      if (!candidate.document_version_id) {
        throw new Error("Selecciona la version de documento.");
      }
      break;
    case "fill_requests":
      if (!candidate.document_fill_flow_id) {
        throw new Error("Selecciona la instancia de entrega.");
      }
      if (!candidate.fill_flow_step_id) {
        throw new Error("Selecciona el paso de entrega.");
      }
      break;
    case "signature_flow_templates":
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso configurado.");
      }
      break;
    case "task_assignments":
      if (!candidate.task_id) {
        throw new Error("Selecciona una tarea para asignar.");
      }
      if (!candidate.position_id) {
        throw new Error("Selecciona un puesto para la asignacion.");
      }
      break;
    case "vacancies":
      break;
    case "contracts":
      ensureDateOrder(candidate.start_date, candidate.end_date, "contratos");
      break;
    case "role_assignments":
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
