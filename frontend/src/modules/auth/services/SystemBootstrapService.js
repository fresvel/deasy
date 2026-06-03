import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

// Clave legacy: antes se persistía el estado de bootstrap en sessionStorage, lo que hacía que un
// estado obsoleto (p.ej. "normal" capturado antes de un reset del sistema) sobreviviera a los
// reloads y el guard del router mostrara el login en vez de la pantalla de bootstrap. Ya no se
// persiste; el estado es autoritativo en el servidor y se cachea solo en memoria con un TTL corto.
const LEGACY_STORAGE_KEY = "deasy-bootstrap-status";

// TTL del cache en memoria: las navegaciones dentro de esta ventana reutilizan el último estado
// (sin pegarle al backend en cada cambio de ruta); pasada la ventana se vuelve a consultar, de modo
// que una transición server-side (reset o initialize) se refleja sola. Un reload siempre refresca
// porque el módulo se reinicia.
const STATUS_TTL_MS = 15000;

let cachedStatus = null;
let cachedAt = 0;
let pendingRequest = null;

if (typeof window !== "undefined") {
  try {
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // sessionStorage no disponible: nada que limpiar.
  }
}

const isFresh = () => cachedStatus !== null && (Date.now() - cachedAt) < STATUS_TTL_MS;

const persistStatus = (status) => {
  cachedStatus = status;
  cachedAt = Date.now();
  return status;
};

class SystemBootstrapService {
  async getStatus({ force = false } = {}) {
    if (!force && isFresh()) {
      return cachedStatus;
    }

    if (!force && pendingRequest) {
      return pendingRequest;
    }

    pendingRequest = axios
      .get(API_ROUTES.SYSTEM_BOOTSTRAP_STATUS)
      .then((response) => persistStatus(response.data))
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
    cachedAt = 0;
    pendingRequest = null;
  }
}

export default new SystemBootstrapService();
