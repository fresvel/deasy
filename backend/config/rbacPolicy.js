export const ADMIN_ROLES = ["Admin"];
export const OPERATIVE_READ_ROLES = ["Admin", "Gestor", "Auditor"];
export const OPERATIVE_WRITE_ROLES = ["Admin", "Gestor"];

export const TABLE_RESOURCE_MAP = {
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

export const DEFAULT_ADMIN_TABLE_RESOURCE = "processes";

export const resolveTableResource = (tableName = "") =>
  TABLE_RESOURCE_MAP[String(tableName || "").trim()] || DEFAULT_ADMIN_TABLE_RESOURCE;

export const actionForHttpMethod = (method = "GET") => {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod === "GET") return "read";
  if (normalizedMethod === "POST") return "create";
  if (normalizedMethod === "PUT" || normalizedMethod === "PATCH") return "update";
  if (normalizedMethod === "DELETE") return "delete";
  return "manage";
};
