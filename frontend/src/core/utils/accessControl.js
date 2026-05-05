const ADMIN_TABLE_RESOURCE_MAP = {
  actions: "roles",
  aplications: "processes",
  cargo_role_map: "roles",
  cargos: "processes",
  contract_origin_recruitment: "processes",
  contract_origin_renewal: "processes",
  contract_origins: "processes",
  contracts: "processes",
  document_fill_flows: "documents",
  document_signatures: "documents",
  document_versions: "documents",
  documents: "documents",
  fill_flow_steps: "documents",
  fill_flow_templates: "documents",
  fill_requests: "documents",
  offers: "processes",
  permissions: "roles",
  person_certificates: "users",
  persons: "users",
  position_assignments: "users",
  process_definition_series: "processes",
  process_definition_templates: "processes",
  process_definition_triggers: "processes",
  process_definition_versions: "processes",
  process_runs: "processes",
  process_target_rules: "processes",
  processes: "processes",
  relation_unit_types: "processes",
  resources: "roles",
  role_assignment_relation_types: "roles",
  role_assignments: "roles",
  role_permissions: "roles",
  roles: "roles",
  signature_flow_instances: "documents",
  signature_flow_steps: "documents",
  signature_flow_templates: "documents",
  signature_request_statuses: "documents",
  signature_requests: "documents",
  signature_statuses: "documents",
  signature_types: "documents",
  task_assignments: "processes",
  task_items: "processes",
  tasks: "processes",
  template_artifacts: "processes",
  template_seeds: "processes",
  term_types: "processes",
  terms: "processes",
  unit_positions: "processes",
  unit_relations: "processes",
  unit_types: "processes",
  units: "processes",
  vacancies: "processes",
  vacancy_visibility: "processes"
};

const DEFAULT_ADMIN_RESOURCE = "processes";

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

export const hasAnyRole = (roles = [], user = getStoredUser()) => {
  const allowed = new Set(roles);
  return getUserRoles(user).some((role) => allowed.has(role));
};

export const hasPermission = (permissionCode, user = getStoredUser()) => {
  if (!permissionCode) return false;
  if (hasAnyRole(["Admin"], user)) return true;
  return getUserPermissions(user).includes(permissionCode);
};

export const canAccessResource = (resource, action = "read", user = getStoredUser()) => {
  if (!resource || !action) return false;
  return hasPermission(`${resource}.${action}`, user) ||
    hasPermission(`${resource}.manage`, user);
};

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
  hasAnyRole(["Admin", "Gestor", "Auditor"], user) ||
  ["roles", "users", "processes", "documents"].some((resource) =>
    canAccessResource(resource, "read", user)
  );

export const isAdminUser = (user = getStoredUser()) =>
  hasAnyRole(["Admin"], user);

export const getDefaultAuthenticatedRoute = (user = getStoredUser()) =>
  isAdminUser(user) ? "/admin" : "/dashboard";
