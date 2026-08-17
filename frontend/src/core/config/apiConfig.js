// Configuración centralizada para rutas de la API
// Puedes adaptar HOST, PORT, y rutas aquí según el entorno

const DEFAULT_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";
const DEFAULT_PROTOCOL = typeof window !== "undefined" ? window.location.protocol : "http:";
const API_PORT = import.meta.env.VITE_API_PORT || "3030";
const RAW_API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const API_BASE_URL = RAW_API_BASE_URL || `${DEFAULT_PROTOCOL}//${DEFAULT_HOST}:${API_PORT}`;
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/$/, "");
export const API_PREFIX = `${NORMALIZED_API_BASE_URL}/deasy/v1`;

export const API_ROUTES = {
  BASE: NORMALIZED_API_BASE_URL,
  PREFIX: API_PREFIX,
  UNITS: `${API_PREFIX}/units`,
  TAREA_SUPERVISED_STUCK: `${API_PREFIX}/tarea/supervised-stuck`,
  USERS: `${API_PREFIX}/users`,
  VERIFY_EMAIL: `${API_PREFIX}/email/verify`,
  USERS_RECOVER_PASSWORD: `${API_PREFIX}/reset-password/request`,
  USERS_VERIFY_RESET_CODE: `${API_PREFIX}/reset-password/verify`,
  USERS_RESET_PASSWORD: `${API_PREFIX}/reset-password/reset`,
  USERS_LOGIN: `${API_PREFIX}/users/login`,
  USERS_LOGOUT: `${API_PREFIX}/users/logout`,
  USERS_REFRESH_TOKEN: `${API_PREFIX}/users/refresh-token`,
  USERS_ME: `${API_PREFIX}/users/me`,
  USERS_MY_CERTIFICATES: `${API_PREFIX}/users/me/certificates`,
  USERS_MY_CERTIFICATE_DOWNLOAD: (certificateId) => `${API_PREFIX}/users/me/certificates/${certificateId}/download`,
  USERS_MY_CERTIFICATE_DEFAULT: (certificateId) => `${API_PREFIX}/users/me/certificates/${certificateId}/default`,
  USERS_MENU: (userId) => `${API_PREFIX}/users/${userId}/menu`,
  USERS_DOCUMENT_CENTER: (userId) => `${API_PREFIX}/users/${userId}/document-center`,
  USERS_SIGNATURE_CENTER: (userId) => `${API_PREFIX}/users/${userId}/signature-center`,
  USERS_PROCESS_DEFINITION_PANEL: (userId, definitionId) => `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/panel`,
  USERS_PROCESS_DEFINITION_TASKS: (userId, definitionId) => `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/tasks`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_OBSERVATIONS: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/observations`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_OBSERVATION_RESOLVE: (userId, definitionId, taskItemId, observationId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/observations/${observationId}/resolve`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_HANDOVERS: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/handovers`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_UPLOAD_FILE: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/upload-file`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_TEMPLATE_DOWNLOAD: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/template-download`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_FILE: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/file`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_RESET_WORKFLOW: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/reset-workflow`,
  USERS_GENERAL_TASKS: (userId) => `${API_PREFIX}/users/${userId}/general-tasks`,
  USERS_ADDABLE_DELIVERABLES: (userId) => `${API_PREFIX}/users/${userId}/addable-deliverables`,
  USERS_TASK_RECIPIENTS: (userId) => `${API_PREFIX}/users/${userId}/task-recipients`,
  USERS_FLOW_CATALOG: (userId) => `${API_PREFIX}/users/${userId}/flow-catalog`,
  USERS_MY_SENDS: (userId) => `${API_PREFIX}/users/${userId}/my-sends`,
  USERS_MY_RECEIVED: (userId) => `${API_PREFIX}/users/${userId}/my-received`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_ATTACHMENTS: (userId, definitionId, taskItemId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/attachments`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_ATTACHMENT: (userId, definitionId, taskItemId, attachmentId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/attachments/${attachmentId}`,
  USERS_PROCESS_DEFINITION_TASK_ITEM_ATTACHMENT_DOWNLOAD: (userId, definitionId, taskItemId, attachmentId) =>
    `${API_PREFIX}/users/${userId}/process-definitions/${definitionId}/task-items/${taskItemId}/attachments/${attachmentId}/download`,
  CHAT_PROCESS_THREAD: (processId) => `${API_PREFIX}/chat/processes/${processId}/thread`,
  CHAT_UNITS: `${API_PREFIX}/chat/units`,
  CHAT_UNIT_THREAD: (unitId) => `${API_PREFIX}/chat/units/${unitId}/thread`,
  CHAT_CONVERSATION: (conversationId) => `${API_PREFIX}/chat/conversations/${conversationId}`,
  CHAT_CONVERSATION_MESSAGES: (conversationId) => `${API_PREFIX}/chat/conversations/${conversationId}/messages`,
  CHAT_CONVERSATION_READ: (conversationId) => `${API_PREFIX}/chat/conversations/${conversationId}/read`,
  CHAT_CONVERSATION_ATTACHMENTS: (conversationId) => `${API_PREFIX}/chat/conversations/${conversationId}/attachments`,
  CHAT_MESSAGE_ATTACHMENT: (conversationId, messageId, attachmentIndex) =>
    `${API_PREFIX}/chat/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentIndex}`,
  USERS_VALIDATE_CEDULA: (cedula) => `${API_PREFIX}/users/validate/cedula/${cedula}`,
  USERS_VALIDATE_WHATSAPP: (phone) => `${API_PREFIX}/users/validate/whatsapp/${phone}`,
  ADMIN_SQL_META: `${API_PREFIX}/admin/sql/meta`,
  ADMIN_SQL_OPERATION_STATS: `${API_PREFIX}/admin/sql/stats/operation`,
  ADMIN_SQL_UNITS_GRAPH: (relationType = "org") => `${API_PREFIX}/admin/sql/units/graph?relation_type=${encodeURIComponent(relationType)}`,
  ADMIN_SQL_UNITS_WITH_PARENT: `${API_PREFIX}/admin/sql/units/with-parent`,
  ADMIN_SQL_UNIT_DETAIL: (unitId) => `${API_PREFIX}/admin/sql/units/${unitId}/detail`,
  ADMIN_SQL_PROCESSES_GRAPH: `${API_PREFIX}/admin/sql/processes/graph`,
  ADMIN_SQL_PROCESSES_WITH_PARENT: `${API_PREFIX}/admin/sql/processes/with-parent`,
  ADMIN_SQL_PROCESS_DETAIL: (processId) => `${API_PREFIX}/admin/sql/processes/${processId}/detail`,
  ADMIN_SQL_PROCESS_PARENT: (processId) => `${API_PREFIX}/admin/sql/processes/${processId}/parent`,
  ADMIN_SQL_UNIT_PROCESSES: (unitId) => `${API_PREFIX}/admin/sql/units/${unitId}/processes`,
  ADMIN_SQL_UNIT_ATTACHABLE_PROCESSES: (unitId) => `${API_PREFIX}/admin/sql/units/${unitId}/attachable-processes`,
  ADMIN_SQL_UNIT_POSITIONS: (unitId) => `${API_PREFIX}/admin/sql/units/${unitId}/positions`,
  ADMIN_SQL_UNIT_POSITION: (positionId) => `${API_PREFIX}/admin/sql/units/positions/${positionId}`,
  ADMIN_SQL_UNIT_POSITION_ASSIGN: (positionId) => `${API_PREFIX}/admin/sql/units/positions/${positionId}/assign`,
  ADMIN_SQL_UNIT_POSITION_UNASSIGN: (positionId) => `${API_PREFIX}/admin/sql/units/positions/${positionId}/unassign`,
  ADMIN_SQL_TEMPLATE_SEEDS_SYNC: `${API_PREFIX}/admin/sql/template_seeds/sync`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT: `${API_PREFIX}/admin/sql/template_artifacts/draft`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT_UPDATE: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/draft/${artifactId}`,
  ADMIN_SQL_TEMPLATE_SEED_PREVIEW: (seedId) => `${API_PREFIX}/admin/sql/template_seeds/${seedId}/preview`,
  ADMIN_SQL_TEMPLATE_SEED_DOWNLOAD: (seedId) => `${API_PREFIX}/admin/sql/template_seeds/${seedId}/download`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_DOWNLOAD: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/download`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_SOURCE: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/source`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_SCHEMA: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/schema`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_ACTIVE: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/active`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_VERSION: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/version`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_PUBLISH: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/publish`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_RETIRE: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/retire`,
  ADMIN_SQL_TEMPLATE_VERSIONS: (code) => `${API_PREFIX}/admin/sql/template_artifacts/versions?code=${encodeURIComponent(code)}`,
  ADMIN_SQL_TEMPLATE_USE_IN_CONFIG: () => `${API_PREFIX}/admin/sql/template_artifacts/use-in-config`,
  ADMIN_SQL_CONFIG_ACTIVATION_DIFF: (definitionId) => `${API_PREFIX}/admin/sql/process_definitions/${definitionId}/activation-diff`,
  ADMIN_SQL_TEMPLATE_GUIDED_UPDATE_START: () => `${API_PREFIX}/admin/sql/template_artifacts/guided-update`,
  ADMIN_SQL_TEMPLATE_GUIDED_UPDATE_FINISH: () => `${API_PREFIX}/admin/sql/template_artifacts/guided-update/finish`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_SYNC_STATUS: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/sync-status`,
  ADMIN_SQL_TEMPLATE_ARTIFACT_RESYNC: (artifactId) => `${API_PREFIX}/admin/sql/template_artifacts/${artifactId}/resync`,
  ADMIN_SQL_PROCESS_TARGET_SCOPE: (definitionId) => `${API_PREFIX}/admin/sql/process_definitions/${definitionId}/target-scope`,
  ADMIN_SQL_PROCESS_RESOLVABLE_CARGOS: (definitionId) => `${API_PREFIX}/admin/sql/process_definitions/${definitionId}/resolvable-cargos`,
  ADMIN_SQL_PROCESS_SERIES_SCOPE: (definitionId) => `${API_PREFIX}/admin/sql/process_definitions/${definitionId}/series-scope`,
  ADMIN_SQL_TABLE: (table) => `${API_PREFIX}/admin/sql/${table}`,
  ADMIN_GENERATE_TERM_TASKS: (termId) => `${API_PREFIX}/admin/terms/${termId}/generate-tasks`,
  ADMIN_TERM_LAUNCH_STATUS: (termId) => `${API_PREFIX}/admin/terms/${termId}/launch-status`,
  ADMIN_LAUNCH_PROCESS_DEFINITION: (definitionId) => `${API_PREFIX}/admin/process-definitions/${definitionId}/launch`,
  ADMIN_PROCESS_DEFINITION_LAUNCH_INFO: (definitionId) => `${API_PREFIX}/admin/process-definitions/${definitionId}/launch-info`,
  SIGN: `${API_PREFIX}/sign`,
  SIGN_VALIDATE: `${API_PREFIX}/sign/validate`,
  SIGN_BATCH_START: `${API_PREFIX}/sign/batch/start`,
  SIGN_BATCH_STATUS: (jobId) => `${API_PREFIX}/sign/batch/${jobId}`,
  SIGN_BATCH_DOWNLOAD: (jobId) => `${API_PREFIX}/sign/batch/${jobId}/download`,
  SIGN_DOCUMENT_SIGNATURE_FLOW: (documentVersionId) => `${API_PREFIX}/sign/documents/${documentVersionId}/signature-flow`,
  SIGN_FILL_REQUEST_START: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/start`,
  SIGN_FILL_REQUEST_APPROVE: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/approve`,
  SIGN_FILL_REQUEST_RETURN: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/return`,
  SIGN_FILL_REQUEST_REJECT: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/reject`,
  SIGN_FILL_REQUEST_CANCEL: (requestId) => `${API_PREFIX}/sign/fill-requests/${requestId}/cancel`,
  SYSTEM_BOOTSTRAP_STATUS: `${API_PREFIX}/system/bootstrap/status`,
  SYSTEM_BOOTSTRAP_INITIALIZE: `${API_PREFIX}/system/bootstrap/initialize`
};
