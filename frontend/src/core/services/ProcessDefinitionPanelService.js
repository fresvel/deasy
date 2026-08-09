import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";

class ProcessDefinitionPanelService {
  extractDownloadFileName(response, fallback = "archivo.bin") {
    const disposition = String(response?.headers?.["content-disposition"] || "");
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]).replace(/^["']|["']$/g, "");
    }
    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (plainMatch?.[1]) {
      return plainMatch[1].trim();
    }
    return fallback;
  }

  getAuthHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getPanel(userId, processDefinitionId, scopeUnitId = null) {
    if (!userId || !processDefinitionId) {
      throw new Error("Se requiere usuario y configuracion de proceso.");
    }
    const { data } = await axios.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_PANEL(userId, processDefinitionId),
      { params: scopeUnitId ? { scope_unit_id: scopeUnitId } : undefined }
    );
    return data;
  }

  async getDocumentCenter(userId) {
    if (!userId) {
      throw new Error("Se requiere usuario.");
    }
    const { data } = await axios.get(API_ROUTES.USERS_DOCUMENT_CENTER(userId), {
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    return data;
  }

  async getSignatureCenter(userId) {
    if (!userId) {
      throw new Error("Se requiere usuario.");
    }
    const { data } = await axios.get(API_ROUTES.USERS_SIGNATURE_CENTER(userId), {
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    return data;
  }

  async createTask(userId, processDefinitionId, payload) {
    if (!userId || !processDefinitionId) {
      throw new Error("Se requiere usuario y configuracion de proceso.");
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASKS(userId, processDefinitionId),
      payload ?? {}
    );
    return data;
  }

  async createGeneralTask(userId, payload = {}) {
    if (!userId) {
      throw new Error("Se requiere usuario.");
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_GENERAL_TASKS(userId),
      payload,
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async listAddableDeliverables(userId, { taskId = null, definitionId = null } = {}) {
    if (!userId || (!taskId && !definitionId)) {
      throw new Error("Se requiere usuario y tarea o definición.");
    }
    const params = {};
    if (taskId) params.task_id = taskId;
    if (definitionId) params.definition_id = definitionId;
    const { data } = await axios.get(
      API_ROUTES.USERS_ADDABLE_DELIVERABLES(userId),
      { params, headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async listMySends(userId) {
    if (!userId) {
      throw new Error("Se requiere usuario.");
    }
    const { data } = await axios.get(
      API_ROUTES.USERS_MY_SENDS(userId),
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async listMyReceived(userId) {
    if (!userId) {
      throw new Error("Se requiere usuario.");
    }
    const { data } = await axios.get(
      API_ROUTES.USERS_MY_RECEIVED(userId),
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async searchTaskRecipients(userId, query = "") {
    if (!userId) {
      throw new Error("Se requiere usuario.");
    }
    const { data } = await axios.get(
      API_ROUTES.USERS_TASK_RECIPIENTS(userId),
      { params: { q: query }, headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async listFlowCatalog(userId) {
    if (!userId) {
      throw new Error("Se requiere usuario.");
    }
    const { data } = await axios.get(
      API_ROUTES.USERS_FLOW_CATALOG(userId),
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async listTaskItemObservations(userId, processDefinitionId, taskItemId) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    const { data } = await axios.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_OBSERVATIONS(userId, processDefinitionId, taskItemId),
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async addTaskItemObservation(userId, processDefinitionId, taskItemId, payload = {}) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_OBSERVATIONS(userId, processDefinitionId, taskItemId),
      payload,
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async resolveTaskItemObservation(userId, processDefinitionId, taskItemId, observationId) {
    if (!userId || !processDefinitionId || !taskItemId || !observationId) {
      throw new Error("Se requiere usuario, configuración, entregable y observación.");
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_OBSERVATION_RESOLVE(userId, processDefinitionId, taskItemId, observationId),
      {},
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async uploadDeliverableFile(userId, processDefinitionId, taskItemId, file, options = {}) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    if (!file) {
      throw new Error("Debes seleccionar un archivo.");
    }
    const formData = new FormData();
    formData.append("file", file);
    if (options.documentId) {
      formData.append("document_id", String(options.documentId));
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_UPLOAD_FILE(userId, processDefinitionId, taskItemId),
      formData,
      {
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return data;
  }

  async listDeliverableAttachments(userId, processDefinitionId, taskItemId, options = {}) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    const { data } = await axios.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_ATTACHMENTS(userId, processDefinitionId, taskItemId),
      {
        headers: { ...this.getAuthHeaders() },
        params: options.documentId ? { document_id: options.documentId } : undefined,
      }
    );
    return data;
  }

  async uploadDeliverableAttachment(userId, processDefinitionId, taskItemId, file, options = {}) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    if (!file) {
      throw new Error("Debes seleccionar un archivo.");
    }
    const formData = new FormData();
    formData.append("file", file);
    if (options.kind) formData.append("kind", String(options.kind));
    if (options.description) formData.append("description", String(options.description));
    if (options.documentId) formData.append("document_id", String(options.documentId));
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_ATTACHMENTS(userId, processDefinitionId, taskItemId),
      formData,
      {
        headers: { ...this.getAuthHeaders(), "Content-Type": "multipart/form-data" },
      }
    );
    return data;
  }

  async deleteDeliverableAttachment(userId, processDefinitionId, taskItemId, attachmentId) {
    if (!userId || !processDefinitionId || !taskItemId || !attachmentId) {
      throw new Error("Se requiere usuario, configuración, entregable y anexo.");
    }
    const { data } = await axios.delete(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_ATTACHMENT(userId, processDefinitionId, taskItemId, attachmentId),
      { headers: { ...this.getAuthHeaders() } }
    );
    return data;
  }

  async downloadDeliverableAttachment(userId, processDefinitionId, taskItemId, attachmentId) {
    if (!userId || !processDefinitionId || !taskItemId || !attachmentId) {
      throw new Error("Se requiere usuario, configuración, entregable y anexo.");
    }
    const response = await axios.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_ATTACHMENT_DOWNLOAD(userId, processDefinitionId, taskItemId, attachmentId),
      { headers: { ...this.getAuthHeaders() }, responseType: "blob" }
    );
    return {
      blob: response.data,
      fileName: this.extractDownloadFileName(response, "anexo.bin"),
      contentType: String(response.headers?.["content-type"] || "application/octet-stream"),
    };
  }

  async approveFillRequest(fillRequestId, payload = {}) {
    if (!fillRequestId) {
      throw new Error("Se requiere la solicitud de entrega.");
    }
    const { data } = await axios.post(
      API_ROUTES.SIGN_FILL_REQUEST_APPROVE(fillRequestId),
      payload,
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async startFillRequest(fillRequestId, payload = {}) {
    if (!fillRequestId) {
      throw new Error("Se requiere la solicitud de entrega.");
    }
    const { data } = await axios.post(
      API_ROUTES.SIGN_FILL_REQUEST_START(fillRequestId),
      payload,
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async returnFillRequest(fillRequestId, payload = {}) {
    if (!fillRequestId) {
      throw new Error("Se requiere la solicitud de entrega.");
    }
    const { data } = await axios.post(
      API_ROUTES.SIGN_FILL_REQUEST_RETURN(fillRequestId),
      payload,
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async rejectFillRequest(fillRequestId, payload = {}) {
    if (!fillRequestId) {
      throw new Error("Se requiere la solicitud de entrega.");
    }
    const { data } = await axios.post(
      API_ROUTES.SIGN_FILL_REQUEST_REJECT(fillRequestId),
      payload,
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async cancelFillRequest(fillRequestId, payload = {}) {
    if (!fillRequestId) {
      throw new Error("Se requiere la solicitud de entrega.");
    }
    const { data } = await axios.post(
      API_ROUTES.SIGN_FILL_REQUEST_CANCEL(fillRequestId),
      payload,
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async downloadDeliverableTemplate(userId, processDefinitionId, taskItemId) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    const response = await axios.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_TEMPLATE_DOWNLOAD(userId, processDefinitionId, taskItemId),
      {
        headers: {
          ...this.getAuthHeaders(),
        },
        responseType: "blob",
      }
    );
    return {
      blob: response.data,
      fileName: this.extractDownloadFileName(response, "plantilla.zip"),
      contentType: String(response.headers?.["content-type"] || "application/octet-stream"),
    };
  }

  async downloadDeliverableFile(userId, processDefinitionId, taskItemId, kind = "best", options = {}) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    const response = await axios.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_FILE(userId, processDefinitionId, taskItemId),
      {
        headers: {
          ...this.getAuthHeaders(),
        },
        params: {
          kind,
          ...(options.documentId ? { document_id: options.documentId } : {})
        },
        responseType: "blob",
      }
    );
    return response.data;
  }

  async resetDeliverableWorkflow(userId, processDefinitionId, taskItemId, options = {}) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, configuración y entregable.");
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_RESET_WORKFLOW(userId, processDefinitionId, taskItemId),
      options.documentId ? { document_id: options.documentId } : {},
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async getProcessThread(processId, scopeUnitId = null) {
    if (!processId) {
      throw new Error("Se requiere processId.");
    }
    const { data } = await axios.get(API_ROUTES.CHAT_PROCESS_THREAD(processId), {
      headers: {
        ...this.getAuthHeaders(),
      },
      params: scopeUnitId ? { scope_unit_id: scopeUnitId } : undefined
    });
    return data;
  }

  async createOrGetProcessThread(processId, scopeUnitId = null) {
    if (!processId) {
      throw new Error("Se requiere processId.");
    }
    const { data } = await axios.post(
      API_ROUTES.CHAT_PROCESS_THREAD(processId),
      scopeUnitId ? { scope_unit_id: scopeUnitId } : {},
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async listChatUnits() {
    const { data } = await axios.get(API_ROUTES.CHAT_UNITS, {
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    return data;
  }

  async getUnitThread(unitId) {
    if (!unitId) {
      throw new Error("Se requiere unitId.");
    }
    const { data } = await axios.get(API_ROUTES.CHAT_UNIT_THREAD(unitId), {
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    return data;
  }

  async createOrGetUnitThread(unitId) {
    if (!unitId) {
      throw new Error("Se requiere unitId.");
    }
    const { data } = await axios.post(
      API_ROUTES.CHAT_UNIT_THREAD(unitId),
      {},
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async getConversation(conversationId) {
    if (!conversationId) {
      throw new Error("Se requiere conversationId.");
    }
    const { data } = await axios.get(API_ROUTES.CHAT_CONVERSATION(conversationId), {
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    return data;
  }

  async getConversationMessages(conversationId, params = {}) {
    if (!conversationId) {
      throw new Error("Se requiere conversationId.");
    }
    const { data } = await axios.get(API_ROUTES.CHAT_CONVERSATION_MESSAGES(conversationId), {
      headers: {
        ...this.getAuthHeaders(),
      },
      params,
    });
    return data;
  }

  async sendConversationMessage(conversationId, payload = {}) {
    if (!conversationId) {
      throw new Error("Se requiere conversationId.");
    }
    const { data } = await axios.post(
      API_ROUTES.CHAT_CONVERSATION_MESSAGES(conversationId),
      payload,
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async markConversationRead(conversationId) {
    if (!conversationId) {
      throw new Error("Se requiere conversationId.");
    }
    const { data } = await axios.post(
      API_ROUTES.CHAT_CONVERSATION_READ(conversationId),
      {},
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }

  async uploadConversationAttachments(conversationId, files = []) {
    if (!conversationId) {
      throw new Error("Se requiere conversationId.");
    }
    if (!Array.isArray(files) || !files.length) {
      throw new Error("Debes seleccionar al menos un archivo.");
    }
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    const { data } = await axios.post(
      API_ROUTES.CHAT_CONVERSATION_ATTACHMENTS(conversationId),
      formData,
      {
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return data;
  }

  async downloadConversationAttachment(conversationId, messageId, attachmentIndex) {
    if (!conversationId || !messageId || attachmentIndex === null || attachmentIndex === undefined) {
      throw new Error("Se requiere conversación, mensaje y adjunto.");
    }
    const response = await axios.get(
      API_ROUTES.CHAT_MESSAGE_ATTACHMENT(conversationId, messageId, attachmentIndex),
      {
        headers: {
          ...this.getAuthHeaders(),
        },
        responseType: "blob",
      }
    );
    return response.data;
  }
}

export default ProcessDefinitionPanelService;
