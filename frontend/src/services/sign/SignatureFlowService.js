import axios from "axios";
import { API_ROUTES } from "../apiConfig";

class SignatureFlowService {
  getAuthHeaders() {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getSignatureFlow(documentVersionId) {
    if (!documentVersionId) {
      throw new Error("Se requiere el identificador de versión documental.");
    }
    const { data } = await axios.get(
      API_ROUTES.SIGN_DOCUMENT_SIGNATURE_FLOW(documentVersionId),
      {
        headers: {
          ...this.getAuthHeaders(),
        },
      }
    );
    return data;
  }
}

export default SignatureFlowService;
