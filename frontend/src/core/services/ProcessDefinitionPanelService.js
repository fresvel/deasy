import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

class ProcessDefinitionPanelService {
  getAuthHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getPanel(userId, processDefinitionId) {
    if (!userId || !processDefinitionId) {
      throw new Error("Se requiere usuario y definicion de proceso.");
    }
    const { data } = await axios.get(API_ROUTES.USERS_PROCESS_DEFINITION_PANEL(userId, processDefinitionId));
    return data;
  }

  async createTask(userId, processDefinitionId, payload) {
    if (!userId || !processDefinitionId) {
      throw new Error("Se requiere usuario y definicion de proceso.");
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASKS(userId, processDefinitionId),
      payload ?? {}
    );
    return data;
  }

  async uploadDeliverableFile(userId, processDefinitionId, taskItemId, file) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, definición y entregable.");
    }
    if (!file) {
      throw new Error("Debes seleccionar un archivo.");
    }
    const formData = new FormData();
    formData.append("file", file);
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

  async approveFillRequest(fillRequestId, payload = {}) {
    if (!fillRequestId) {
      throw new Error("Se requiere la solicitud de llenado.");
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
      throw new Error("Se requiere la solicitud de llenado.");
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
      throw new Error("Se requiere la solicitud de llenado.");
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
      throw new Error("Se requiere la solicitud de llenado.");
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
      throw new Error("Se requiere la solicitud de llenado.");
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
      throw new Error("Se requiere usuario, definición y entregable.");
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
    return response.data;
  }

  async downloadDeliverableFile(userId, processDefinitionId, taskItemId, kind = "best") {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, definición y entregable.");
    }
    const response = await axios.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_FILE(userId, processDefinitionId, taskItemId),
      {
        headers: {
          ...this.getAuthHeaders(),
        },
        params: { kind },
        responseType: "blob",
      }
    );
    return response.data;
  }

  async resetDeliverableWorkflow(userId, processDefinitionId, taskItemId) {
    if (!userId || !processDefinitionId || !taskItemId) {
      throw new Error("Se requiere usuario, definición y entregable.");
    }
    const { data } = await axios.post(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_RESET_WORKFLOW(userId, processDefinitionId, taskItemId),
      {},
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
