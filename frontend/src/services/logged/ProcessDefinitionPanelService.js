import axios from "axios";
import { API_ROUTES } from "../apiConfig";

class ProcessDefinitionPanelService {
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
}

export default ProcessDefinitionPanelService;
