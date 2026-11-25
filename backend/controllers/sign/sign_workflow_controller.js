// Transporte de las cinco acciones del flujo de entrega. Toda la máquina de estados vive en
// `services/documents/FillRequestWorkflowService.js`; aquí solo se lee la petición, se llama al
// servicio y se traduce el resultado (o el error) a HTTP.
import { getSignatureFlowSnapshot } from "../../services/documents/DocumentSignatureWorkflowService.js";
import { updateFillRequestStatus } from "../../services/documents/FillRequestWorkflowService.js";
import { ESTADO_RECORRIDO } from "../../services/documents/DocumentWorkflowCatalog.js";

const runFillRequestAction = async (req, res, action, nextStatus) => {
  try {
    const result = await updateFillRequestStatus({
      userId: req.user?.uid,
      requestId: req.params?.requestId,
      action,
      nextStatus,
      note: String(req.body?.note || req.body?.response_note || "").trim() || null,
    });
    return res.json({ message: "Turno de entrega actualizado.", ...result });
  } catch (error) {
    console.error("[sign_workflow_controller] Error fill request:", error);
    // Respeta el codigo de negocio (400/403/404/409/...). Sin statusCode -> 500 de verdad.
    return res.status(error.statusCode ?? 500).json({ error: error.message || "No se pudo actualizar el turno de entrega." });
  }
};

export const startFillRequest = (req, res) =>
  runFillRequestAction(req, res, "start", ESTADO_RECORRIDO.EN_PROGRESO);

export const approveFillRequest = (req, res) =>
  runFillRequestAction(req, res, "approve", ESTADO_RECORRIDO.COMPLETADO);

export const returnFillRequest = (req, res) =>
  runFillRequestAction(req, res, "return", ESTADO_RECORRIDO.DEVUELTO);

export const rejectFillRequest = (req, res) =>
  runFillRequestAction(req, res, "reject", ESTADO_RECORRIDO.RECHAZADO);

export const cancelFillRequest = (req, res) =>
  runFillRequestAction(req, res, "cancel", ESTADO_RECORRIDO.CANCELADO);

// ── EL SNAPSHOT DEL RECORRIDO ───────────────────────────────────────────────────────────────────
// VINO DE `sign_controller.js` el 2026-10-09, al mover el dominio `firmas` (F7.5 del frente 22).
// Fue el UNICO manejador de aquel fichero que no se fue con el dominio, y el motivo es el mismo que
// disolvio `firmas/datos/flujoDeFirma.js`: un recorrido en marcha es un hecho de `tareas`, no de la
// firma. Aqui esta con los otros seis que operan turnos.
//
// ⚠️ Y YA NO RECIBE EL POOL. En `sign_controller.js` habia un `const pool = getPostgresPool();` en
// la columna cero y este manejador lo pasaba como `connection`; ademas comprobaba `if (!pool)` para
// devolver un 500. Hoy `getSignatureFlowSnapshot` resuelve su propia conexion si no se le da una,
// que es donde corresponde: un controlador no tiene pool.
export const getSignatureFlow = async (req, res) => {
  try {
    const documentVersionId = Number(req.params?.documentVersionId);
    if (!documentVersionId || Number.isNaN(documentVersionId)) {
      return res.status(400).json({ error: "Versión documental inválida." });
    }
    const snapshot = await getSignatureFlowSnapshot({
      documentVersionId,
      userId: Number(req.user?.uid || 0),
    });
    return res.json(snapshot);
  } catch (error) {
    console.error("[sign_controller] Error signature flow:", error);
    return res.status(500).json({ error: error.message || "No se pudo obtener el flujo de firmas." });
  }
};
