const ADMIN_TABLE_RESOURCE_MAP = {
  actions: "security",
  aplications: "contracts",
  cargo_role_map: "security",
  cargos: "people",
  contract_origin_recruitment: "contracts",
  contract_origin_renewal: "contracts",
  contract_origins: "contracts",
  contracts: "contracts",
  document_fill_flows: "fill_flows",
  document_signatures: "signature_flows",
  document_versions: "documents",
  documents: "documents",
  fill_flow_steps: "fill_flows",
  fill_flow_templates: "fill_flows",
  fill_requests: "fill_flows",
  offers: "contracts",
  permissions: "security",
  person_certificates: "signature_flows",
  persons: "people",
  position_assignments: "people",
  process_definition_series: "process_definitions",
  process_definition_templates: "templates",
  process_definition_period_types: "process_definitions",
  process_definition_versions: "process_definitions",
  process_runs: "process_execution",
  process_target_rules: "process_definitions",
  processes: "process_definitions",
  relation_unit_types: "units",
  resources: "security",
  role_assignment_relation_types: "security",
  role_assignments: "security",
  role_permissions: "security",
  roles: "security",
  signature_flow_instances: "signature_flows",
  signature_flow_steps: "signature_flows",
  signature_flow_templates: "signature_flows",
  signature_request_statuses: "signature_flows",
  signature_requests: "signature_flows",
  signature_statuses: "signature_flows",
  task_item_tenures: "process_execution",
  task_items: "process_execution",
  tasks: "process_execution",
  template_artifacts: "templates",
  template_seeds: "templates",
  term_types: "academic_terms",
  terms: "academic_terms",
  unit_positions: "people",
  unit_relations: "units",
  unit_types: "units",
  units: "units",
  vacancies: "contracts",
  vacancy_visibility: "contracts"
};

const DEFAULT_ADMIN_RESOURCE = "process_definitions";
const SYSTEM_ADMIN_ROLES = ["AdminSistema"];
const MANAGEMENT_RESOURCES = [
  "security",
  "people",
  "units",
  "academic_terms",
  "process_definitions",
  "process_execution",
  "templates",
  "documents",
  "fill_flows",
  "signature_flows",
  "contracts"
];

export const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeList = (values = []) =>
  Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

export const getUserRoles = (user = getStoredUser()) => {
  const accessRoles = normalizeList(user?.access?.roleNames);
  const publicRoles = normalizeList(user?.roles);
  const legacyRole = user?.role ? [String(user.role).trim()] : [];
  return [...new Set([...accessRoles, ...publicRoles, ...legacyRole].filter(Boolean))];
};

export const getUserPermissions = (user = getStoredUser()) => {
  const accessPermissions = normalizeList(user?.access?.permissions);
  const publicPermissions = normalizeList(user?.permissions);
  return [...new Set([...accessPermissions, ...publicPermissions])];
};

// ESPEJO de backend/services/auth/RbacService.js (hasAnyRole/hasPermission/canAccessResource).
// La lógica core (`res.action || res.manage`) debe coincidir con el backend, que es la
// fuente de verdad: esto solo decide qué se muestra, el backend decide qué se permite.
// Diferencia intencional: el backend usa `access.isAdmin` precomputado; aquí se deriva
// de los roles (SYSTEM_ADMIN_ROLES). Al tocar esta lógica, revisa también el backend.
// (El backend tiene RbacService.test.js; este lado no tiene runner de tests todavía.)
export const hasAnyRole = (roles = [], user = getStoredUser()) => {
  const allowed = new Set(roles);
  return getUserRoles(user).some((role) => allowed.has(role));
};

export const hasPermission = (permissionCode, user = getStoredUser()) => {
  if (!permissionCode) return false;
  if (hasAnyRole(SYSTEM_ADMIN_ROLES, user)) return true;
  return getUserPermissions(user).includes(permissionCode);
};

export const canAccessResource = (resource, action = "read", user = getStoredUser()) => {
  if (!resource || !action) return false;
  return hasPermission(`${resource}.${action}`, user) ||
    hasPermission(`${resource}.manage`, user);
};

export const canReadResource = (resource, user = getStoredUser()) =>
  canAccessResource(resource, "read", user);

export const canWriteResource = (resource, user = getStoredUser()) =>
  ["create", "update", "delete", "manage"].some((action) =>
    canAccessResource(resource, action, user)
  );

// Tablas runtime: registros materializados/actualizados por los flujos del sistema. Se agrupan aparte
// (bloque "Trazabilidad y soporte") y sus acciones de escritura quedan restringidas (ver AdminTableManager).
export const TRACEABILITY_TABLES = new Set([
  "task_items",
  "task_item_tenures",
  "document_versions",
  "document_fill_flows",
  "fill_requests",
  "signature_flow_instances",
  "signature_requests",
  "document_signatures"
]);

export const isTraceabilityTable = (tableName) =>
  TRACEABILITY_TABLES.has(String(tableName || "").trim());

export const resolveAdminTableResource = (tableName = "") =>
  ADMIN_TABLE_RESOURCE_MAP[String(tableName || "").trim()] || DEFAULT_ADMIN_RESOURCE;

export const canReadAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "read", user);

export const canCreateAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "create", user);

export const canUpdateAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "update", user);

export const canDeleteAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "delete", user);

export const canAccessAdmin = (user = getStoredUser()) =>
  hasAnyRole(["AdminSistema", "GestorSeguridad", "Auditor"], user) ||
  ["security"].some((resource) =>
    canAccessResource(resource, "read", user)
  );

export const canAccessManagement = (user = getStoredUser()) =>
  hasAnyRole([
    "AdminSistema",
    "GestorSeguridad",
    "GestorTalentoHumano",
    "GestorUnidades",
    "GestorAcademico",
    "GestorProcesos",
    "GestorPlantillas",
    "GestorEjecucionProcesos",
    "GestorDocumental",
    "GestorFirmas",
    "GestorContratacion",
    "Auditor"
  ], user) ||
  MANAGEMENT_RESOURCES.some((resource) => canAccessResource(resource, "read", user));

export const canAccessProcessManagement = (user = getStoredUser()) =>
  hasAnyRole([
    "AdminSistema",
    "GestorProcesos",
    "GestorPlantillas",
    "GestorEjecucionProcesos",
    "GestorDocumental",
    "GestorFirmas"
  ], user) ||
  ["process_definitions", "process_execution", "templates"].some((resource) =>
    ["create", "update", "delete", "manage"].some((action) =>
      canAccessResource(resource, action, user)
    )
  ) ||
  ["documents", "fill_flows", "signature_flows"].some((resource) =>
    ["create", "delete", "manage"].some((action) =>
      canAccessResource(resource, action, user)
    )
  );

export const isAdminUser = (user = getStoredUser()) =>
  hasAnyRole(SYSTEM_ADMIN_ROLES, user);

export const getDefaultAuthenticatedRoute = (user = getStoredUser()) =>
  isAdminUser(user) ? "/admin" : "/home";
