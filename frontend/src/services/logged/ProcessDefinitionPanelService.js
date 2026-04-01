import axios from "axios";
import { API_ROUTES } from "../apiConfig";

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
}

export default ProcessDefinitionPanelService;
