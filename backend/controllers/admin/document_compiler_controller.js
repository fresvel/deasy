import { documentCompilerOrchestratorService } from "../../services/documents/DocumentCompilerOrchestratorService.js";

const COMPILER_SHARED_TOKEN = String(process.env.COMPILER_SHARED_TOKEN || "").trim();

const resolveDocumentVersionId = (req) => {
  const value = Number(req.params?.documentVersionId || req.body?.document_version_id);
  return Number.isNaN(value) ? null : value;
};

const isCompilerCallbackAuthorized = (req) => {
  if (!COMPILER_SHARED_TOKEN) {
    return true;
  }
  return req.headers.authorization === `Bearer ${COMPILER_SHARED_TOKEN}`;
};

export const validateDocumentCompilerPayloadController = async (req, res) => {
  try {
    const documentVersionId = resolveDocumentVersionId(req);
    if (!documentVersionId) {
      return res.status(400).json({ message: "Se requiere documentVersionId válido." });
    }

    const result = await documentCompilerOrchestratorService.validateDocumentVersion(documentVersionId);
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      message: error.message,
      error: error.payload || null,
    });
  }
};

export const requestDocumentCompilationController = async (req, res) => {
  try {
    const documentVersionId = resolveDocumentVersionId(req);
    if (!documentVersionId) {
      return res.status(400).json({ message: "Se requiere documentVersionId válido." });
    }

    const result = await documentCompilerOrchestratorService.requestCompilation(documentVersionId);
    return res.status(202).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      message: error.message,
      error: error.payload || null,
    });
  }
};

export const getDocumentCompilationStatusController = async (req, res) => {
  try {
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) {
      return res.status(400).json({ message: "Se requiere jobId válido." });
    }

    const result = await documentCompilerOrchestratorService.getCompilationStatus(jobId);
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      message: error.message,
      error: error.payload || null,
    });
  }
};

export const handleDocumentCompilationCallbackController = async (req, res) => {
  try {
    if (!isCompilerCallbackAuthorized(req)) {
      return res.status(401).json({ message: "Callback del compilador no autorizado." });
    }

    const result = await documentCompilerOrchestratorService.applyCompilationCallback(req.body || {});
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 400).json({
      message: error.message,
      error: error.payload || null,
    });
  }
};
