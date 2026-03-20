// Configuración centralizada para rutas de la API
// Puedes adaptar HOST, PORT, y rutas aquí según el entorno

const DEFAULT_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";
const API_PORT = import.meta.env.VITE_API_PORT || "3030";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${DEFAULT_HOST}:${API_PORT}`;
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
  VERIFY_EMAIL: `${API_PREFIX}/email/verify`,
  USERS_RECOVER_PASSWORD: `${API_PREFIX}/reset-password/request`,
  USERS_LOGIN: `${API_PREFIX}/users/login`,
  USERS_LOGOUT: `${API_PREFIX}/users/logout`,
  USERS_REFRESH_TOKEN: `${API_PREFIX}/users/refresh-token`,
  USERS_MENU: (userId) => `${API_PREFIX}/users/${userId}/menu`,
  USERS_PROCESS_DEFINITION_PANEL: (userId, definitionId) => `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/panel`,
  USERS_PROCESS_DEFINITION_TASKS: (userId, definitionId) => `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/tasks`,
  USERS_VALIDATE_CEDULA: (cedula) => `${API_PREFIX}/users/validate/cedula/${cedula}`,
  USERS_VALIDATE_WHATSAPP: (phone) => `${API_PREFIX}/users/validate/whatsapp/${phone}`,
  ADMIN_SQL_META: `${API_PREFIX}/admin/sql/meta`,
  ADMIN_SQL_TEMPLATE_ARTIFACTS_SYNC: `${API_PREFIX}/admin/sql/template_artifacts/sync`,
  ADMIN_SQL_TEMPLATE_SEEDS_SYNC: `${API_PREFIX}/admin/sql/template_seeds/sync`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT: `${API_PREFIX}/admin/sql/template_artifacts/draft`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT_UPDATE: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/draft/${artifactId}`,
  ADMIN_SQL_TEMPLATE_SEED_PREVIEW: (seedId) => `${API_PREFIX}/admin/sql/template_seeds/${seedId}/preview`,
  ADMIN_SQL_TABLE: (table) => `${API_PREFIX}/admin/sql/${table}`,
  ADMIN_GENERATE_TERM_TASKS: (termId) => `${API_PREFIX}/admin/terms/${termId}/generate-tasks`
};
