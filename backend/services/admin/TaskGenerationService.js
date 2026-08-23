// FACHADA de TaskGenerationService.
//
// El fichero original tenía 2006 L y cero tests (God Object #3 de la auditoría). Se partió
// por dominios en la Fase 3, pero la SUPERFICIE PÚBLICA se conserva intacta a propósito:
// los 4 consumidores (task_generation_controller, user_controler, SqlAdminService,
// DocumentWorkflowResetService) siguen importando de aquí y no se tocaron.
//
// Dónde vive ahora cada cosa (paquete `generation/`):
//   primitives.js  decisiones de política puras (ámbito de un paso, reparto de una regla)
//   queries.js     lookups de solo lectura
//   assignees.js   el "quién hace el paso": de la declaración a personas concretas
//   taskitems.js   qué entregables existen en una tarea y a qué posiciones se asignan
//   documents.js   materialización del documento y flujo de llenado
//   launch.js      corrida (process_run), hidratación de tareas y estado de lanzamiento
//
// Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
export {
  ensureSignatureFlowForDocumentVersion,
  ensureFillFlowForDocumentVersion,
  resolveOwnerPersonIdForTaskItem,
  resolveOriginUnitIdForTaskItem,
  materializeRuntimeFlowForTaskItem,
  ensureDocumentForTaskItem,
  ensureDocumentsForTask
} from "./generation/documents.js";

export {
  ensureProcessRun,
  hydrateTaskFromDefinition,
  launchDefinitionInTerm,
  generateTasksForTerm,
  launchProcessDefinitionInTerm,
  getTermLaunchStatus,
  getDefinitionLaunchInfo
} from "./generation/launch.js";
