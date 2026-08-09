// Transporte de las cinco acciones del flujo de entrega. Toda la máquina de estados vive en
// `services/documents/FillRequestWorkflowService.js`; aquí solo se lee la petición, se llama al
// servicio y se traduce el resultado (o el error) a HTTP.
import { updateFillRequestStatus } from "../../services/documents/FillRequestWorkflowService.js";
import { FILL_REQUEST_STATUS } from "../../services/documents/DocumentWorkflowCatalog.js";

const runFillRequestAction = async (req, res, action, nextStatus) => {
  try {
    const result = await updateFillRequestStatus({
      userId: req.user?.uid,
      requestId: req.params?.requestId,
      action,
      nextStatus,
      note: String(req.body?.note || req.body?.response_note || "").trim() || null,
    });
    return res.json({ message: "Solicitud de entrega actualizada.", ...result });
  } catch (error) {
    console.error("[sign_workflow_controller] Error fill request:", error);
    // Respeta el codigo de negocio (400/403/404/409/...). Sin statusCode -> 500 de verdad.
    return res.status(error.statusCode ?? 500).json({ error: error.message || "No se pudo actualizar la solicitud de entrega." });
  }
};

export const startFillRequest = (req, res) =>
  runFillRequestAction(req, res, "start", FILL_REQUEST_STATUS.IN_PROGRESS);

export const approveFillRequest = (req, res) =>
  runFillRequestAction(req, res, "approve", FILL_REQUEST_STATUS.APPROVED);

export const returnFillRequest = (req, res) =>
  runFillRequestAction(req, res, "return", FILL_REQUEST_STATUS.RETURNED);

export const rejectFillRequest = (req, res) =>
  runFillRequestAction(req, res, "reject", FILL_REQUEST_STATUS.REJECTED);

export const cancelFillRequest = (req, res) =>
  runFillRequestAction(req, res, "cancel", FILL_REQUEST_STATUS.CANCELLED);
