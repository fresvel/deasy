// LA PUERTA del dominio `plantillas` — **parcial**, igual que la de `tareas` y por el mismo motivo:
// hoy sólo tiene `datos/`, y el resto se mueve en F7.5. Ver la nota de `dominios/tareas/index.js`.
export {
  actualizarAvanceDelFlujo,
  cancelFillFlow,
  cancelFillRequestsOfFlow,
  findFillFlowIdByDocumentVersion,
  getCurrentFillOwnership
} from "./datos/flujoDeLlenado.js";

// La receta del recorrido unificado (frente 24, fase 4). Escribe `pasos_declarados` y
// `participantes_declarados`: las dos tablas de este dominio, por su `datos/`.
export {
  participantesDeUnPasoDeEntrega,
  participantesDeUnPasoDeFirma,
  reemplazarReceta
} from "./datos/recetaDelRecorrido.js";
