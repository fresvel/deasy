// Configuración centralizada para rutas de la API
// Puedes adaptar HOST, PORT, y rutas aquí según el entorno

const DEFAULT_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";
const DEFAULT_PORT = process.env.VUE_APP_API_PORT || "3030";
const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
export const API_PREFIX = `${API_BASE_URL}/easym/v1`;

export const API_ROUTES = {
  BASE: API_BASE_URL,
  PREFIX: API_PREFIX,
  UNITS: `${API_PREFIX}/units`,
  PROGRAMS: `${API_PREFIX}/units`,
  AREAS: `${API_PREFIX}/area`,
  TAREAS_PENDIENTES: (usuario) => `${API_PREFIX}/tarea/pendiente?usuario=${usuario}`,
  INFORME_TUTORIAS: `${API_PREFIX}/tutorias/parcial`,
  GENERAR_REPORTE: `${API_PREFIX}/academia/co/logros.web`,
  OBTENER_REPORTE: `${API_PREFIX}/academia/co/logros.pdf`,
  USERS: `${API_PREFIX}/users`,
  USERS_LOGIN: `${API_PREFIX}/users/login`,
  USERS_LOGOUT: `${API_PREFIX}/users/logout`,
  USERS_MENU: (userId) => `${API_PREFIX}/users/${userId}/menu`,
  USERS_VALIDATE_CEDULA: (cedula) => `${API_PREFIX}/users/validate/cedula/${cedula}`,
  USERS_VALIDATE_WHATSAPP: (phone) => `${API_PREFIX}/users/validate/whatsapp/${phone}`,
  ADMIN_SQL_META: `${API_PREFIX}/admin/sql/meta`,
  ADMIN_SQL_TABLE: (table) => `${API_PREFIX}/admin/sql/${table}`
};
