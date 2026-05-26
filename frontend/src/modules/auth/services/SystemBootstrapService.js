import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

const STORAGE_KEY = "deasy-bootstrap-status";

let cachedStatus = null;
let pendingRequest = null;

const readStoredStatus = () => {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const persistStatus = (status) => {
  cachedStatus = status;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(status));
  }
};

class SystemBootstrapService {
  async getStatus({ force = false } = {}) {
    if (!force && cachedStatus) {
      return cachedStatus;
    }

    if (!force) {
      const stored = readStoredStatus();
      if (stored) {
        cachedStatus = stored;
        return stored;
      }
    }

    if (!force && pendingRequest) {
      return pendingRequest;
    }

    pendingRequest = axios
      .get(API_ROUTES.SYSTEM_BOOTSTRAP_STATUS)
      .then((response) => {
        persistStatus(response.data);
        return response.data;
      })
      .finally(() => {
        pendingRequest = null;
      });

    return pendingRequest;
  }

  async initialize(payload) {
    const response = await axios.post(API_ROUTES.SYSTEM_BOOTSTRAP_INITIALIZE, payload);
    persistStatus(response.data);
    return response.data;
  }

  clearCache() {
    cachedStatus = null;
    pendingRequest = null;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }
}

export default new SystemBootstrapService();
