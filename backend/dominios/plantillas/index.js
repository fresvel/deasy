// LA PUERTA del dominio `plantillas` — **parcial**, igual que la de `tareas` y por el mismo motivo:
// hoy sólo tiene `datos/`, y el resto se mueve en F7.5. Ver la nota de `dominios/tareas/index.js`.
export {
  actualizarAvanceDelFlujo,
  cancelFillFlow,
  cancelFillRequestsOfFlow,
  findFillFlowIdByDocumentVersion,
  getCurrentFillOwnership
} from "./datos/flujoDeLlenado.js";
