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
  USERS: `${API_PREFIX}/users`,
  VERIFY_EMAIL: `${API_PREFIX}/email/verify`,
  USERS_RECOVER_PASSWORD: `${API_PREFIX}/reset-password/request`,
  USERS_LOGIN: `${API_PREFIX}/users/login`,
  USERS_LOGOUT: `${API_PREFIX}/users/logout`,
  USERS_REFRESH_TOKEN: `${API_PREFIX}/users/refresh-token`,
  USERS_ME: `${API_PREFIX}/users/me`,
  USERS_MY_CERTIFICATES: `${API_PREFIX}/users/me/certificates`,
  USERS_MY_CERTIFICATE_DOWNLOAD: (certificateId) => `${API_PREFIX}/users/me/certificates/${certificateId}/download`,
  USERS_MY_CERTIFICATE_DEFAULT: (certificateId) => `${API_PREFIX}/users/me/certificates/${certificateId}/default`,
  USERS_MENU: (userId) => `${API_PREFIX}/users/${userId}/menu`,
  USERS_PROCESS_DEFINITION_PANEL: (userId, definitionId) => `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/panel`,
  USERS_PROCESS_DEFINITION_TASKS: (userId, definitionId) => `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/tasks`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_UPLOAD_FILE: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/upload-file`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_TEMPLATE_DOWNLOAD: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/template-download`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_FILE: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/file`,
  CHAT_PROCESS_THREAD: (processId) => `${API_PREFIX}/chat/processes/${processId}/thread`,
  CHAT_CONVERSATION_MESSAGES: (conversationId) => `${API_PREFIX}/chat/conversations/${conversationId}/messages`,
  CHAT_CONVERSATION_READ: (conversationId) => `${API_PREFIX}/chat/conversations/${conversationId}/read`,
  CHAT_CONVERSATION_ATTACHMENTS: (conversationId) => `${API_PREFIX}/chat/conversations/${conversationId}/attachments`,
  CHAT_MESSAGE_ATTACHMENT: (conversationId, messageId, attachmentIndex) =>
    `${API_PREFIX}/chat/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentIndex}`,
  USERS_VALIDATE_CEDULA: (cedula) => `${API_PREFIX}/users/validate/cedula/${cedula}`,
  USERS_VALIDATE_WHATSAPP: (phone) => `${API_PREFIX}/users/validate/whatsapp/${phone}`,
  ADMIN_SQL_META: `${API_PREFIX}/admin/sql/meta`,
  ADMIN_SQL_TEMPLATE_ARTIFACTS_SYNC: `${API_PREFIX}/admin/sql/template_artifacts/sync`,
  ADMIN_SQL_TEMPLATE_SEEDS_SYNC: `${API_PREFIX}/admin/sql/template_seeds/sync`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT: `${API_PREFIX}/admin/sql/template_artifacts/draft`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT_UPDATE: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/draft/${artifactId}`,
  ADMIN_SQL_TEMPLATE_SEED_PREVIEW: (seedId) => `${API_PREFIX}/admin/sql/template_seeds/${seedId}/preview`,
  ADMIN_SQL_TABLE: (table) => `${API_PREFIX}/admin/sql/${table}`,
  ADMIN_GENERATE_TERM_TASKS: (termId) => `${API_PREFIX}/admin/terms/${termId}/generate-tasks`,
  SIGN: `${API_PREFIX}/sign`,
  SIGN_BATCH: `${API_PREFIX}/sign/batch`,
  SIGN_BATCH_START: `${API_PREFIX}/sign/batch/start`,
  SIGN_BATCH_STATUS: (jobId) => `${API_PREFIX}/sign/batch/${jobId}`,
  SIGN_BATCH_DOWNLOAD: (jobId) => `${API_PREFIX}/sign/batch/${jobId}/download`,
  SIGN_DOCUMENT_SIGNATURE_FLOW: (documentVersionId) => `${API_PREFIX}/sign/documents/${documentVersionId}/signature-flow`,
  SIGN_FILL_REQUEST_START: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/start`,
  SIGN_FILL_REQUEST_APPROVE: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/approve`,
  SIGN_FILL_REQUEST_RETURN: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/return`,
  SIGN_FILL_REQUEST_REJECT: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/reject`,
  SIGN_FILL_REQUEST_CANCEL: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/cancel`
};
