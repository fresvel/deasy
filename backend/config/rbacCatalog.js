export const ADMIN_ROLE_NAME = "AdminSistema";

export const ROLE_CATALOG = [
  { name: "AdminSistema", description: "Administra seguridad, bootstrap, configuracion critica y gobierno global del sistema." },
  { name: "GestorSeguridad", description: "Gestiona roles, permisos, asignaciones y relaciones de seguridad." },
  { name: "GestorTalentoHumano", description: "Gestiona personas, cargos, puestos y ocupaciones institucionales." },
  { name: "GestorUnidades", description: "Gestiona unidades, tipos de unidad y relaciones jerarquicas." },
  { name: "GestorAcademico", description: "Gestiona periodos y catalogos academicos asociados." },
  { name: "GestorProcesos", description: "Gestiona procesos base, definiciones, versiones, reglas y disparadores." },
  { name: "GestorPlantillas", description: "Gestiona seeds, artifacts y plantillas asociadas a procesos." },
  { name: "GestorEjecucionProcesos", description: "Gestiona corridas, tareas, entregables y asignaciones operativas." },
  { name: "GestorDocumental", description: "Gestiona documentos, versiones y flujos de llenado documental." },
  { name: "GestorFirmas", description: "Gestiona flujos, solicitudes, estados y validacion operativa de firmas." },
  { name: "GestorContratacion", description: "Gestiona vacantes, postulaciones, ofertas, contratos y origenes contractuales." },
  { name: "Auditor", description: "Consulta informacion transversal sin permisos de escritura." },
  { name: "Usuario", description: "Acceso operativo base a Home, tareas, documentos, firmas y dossier propios." }
];

export const RESOURCE_CATALOG = [
  { code: "account", name: "Cuenta", description: "Datos de cuenta y sesion." },
  { code: "dossier", name: "Dossier", description: "Perfil profesional y evidencias." },
  { code: "security", name: "Seguridad", description: "Roles, permisos, recursos, acciones y asignaciones de seguridad." },
  { code: "people", name: "Talento humano", description: "Personas, cargos, puestos y ocupaciones." },
  { code: "units", name: "Unidades", description: "Unidades, tipos y relaciones institucionales." },
  { code: "academic_terms", name: "Periodos academicos", description: "Tipos de periodo y periodos." },
  { code: "process_definitions", name: "Definiciones de proceso", description: "Procesos base, definiciones, versiones, reglas y disparadores." },
  { code: "process_execution", name: "Ejecucion de procesos", description: "Corridas, tareas, entregables y asignaciones." },
  { code: "templates", name: "Plantillas", description: "Seeds, artifacts y plantillas de procesos definidos." },
  { code: "documents", name: "Documentos", description: "Documentos, versiones y ciclo documental operativo." },
  { code: "fill_flows", name: "Llenado documental", description: "Flujos, pasos, instancias y solicitudes de llenado." },
  { code: "signature_flows", name: "Firmas", description: "Flujos, solicitudes, estados y firmas documentales." },
  { code: "contracts", name: "Contratacion", description: "Vacantes, postulaciones, ofertas, contratos y origenes." }
];

export const ACTION_CATALOG = [
  { code: "read", name: "Leer", description: "Consultar registros." },
  { code: "create", name: "Crear", description: "Crear registros." },
  { code: "update", name: "Actualizar", description: "Modificar registros." },
  { code: "delete", name: "Eliminar", description: "Eliminar registros." },
  { code: "manage", name: "Administrar", description: "Administracion completa del modulo." }
];

const MANAGE_ALL_RESOURCES = Object.fromEntries(
  RESOURCE_CATALOG.map((resource) => [resource.code, ["read", "create", "update", "delete", "manage"]])
);

const READ_ALL_RESOURCES = Object.fromEntries(
  RESOURCE_CATALOG.map((resource) => [resource.code, ["read"]])
);

export const ROLE_PERMISSION_MATRIX = {
  AdminSistema: MANAGE_ALL_RESOURCES,
  GestorSeguridad: {
    account: ["read", "update"],
    security: ["read", "create", "update", "delete", "manage"],
    people: ["read"],
    units: ["read"]
  },
  GestorTalentoHumano: {
    account: ["read", "update"],
    people: ["read", "create", "update", "delete", "manage"],
    units: ["read"],
    contracts: ["read"],
    security: ["read"]
  },
  GestorUnidades: {
    account: ["read", "update"],
    units: ["read", "create", "update", "delete", "manage"],
    people: ["read"],
    academic_terms: ["read"],
    process_definitions: ["read"]
  },
  GestorAcademico: {
    account: ["read", "update"],
    academic_terms: ["read", "create", "update", "delete", "manage"],
    units: ["read"],
    process_definitions: ["read"],
    process_execution: ["read"]
  },
  GestorProcesos: {
    account: ["read", "update"],
    units: ["read"],
    people: ["read"],
    academic_terms: ["read"],
    process_definitions: ["read", "create", "update", "delete", "manage"],
    process_execution: ["read", "create", "update"],
    templates: ["read"],
    documents: ["read"],
    fill_flows: ["read"],
    signature_flows: ["read"]
  },
  GestorPlantillas: {
    account: ["read", "update"],
    templates: ["read", "create", "update", "delete", "manage"],
    process_definitions: ["read"],
    documents: ["read"],
    fill_flows: ["read"],
    signature_flows: ["read"]
  },
  GestorEjecucionProcesos: {
    account: ["read", "update"],
    people: ["read"],
    units: ["read"],
    academic_terms: ["read"],
    process_definitions: ["read"],
    process_execution: ["read", "create", "update", "delete", "manage"],
    templates: ["read"],
    documents: ["read", "create", "update"],
    fill_flows: ["read", "update"],
    signature_flows: ["read", "update"]
  },
  GestorDocumental: {
    account: ["read", "update"],
    documents: ["read", "create", "update", "delete", "manage"],
    fill_flows: ["read", "create", "update", "delete", "manage"],
    templates: ["read"],
    process_definitions: ["read"],
    process_execution: ["read"],
    signature_flows: ["read"]
  },
  GestorFirmas: {
    account: ["read", "update"],
    signature_flows: ["read", "create", "update", "delete", "manage"],
    documents: ["read", "update"],
    fill_flows: ["read"],
    people: ["read"]
  },
  GestorContratacion: {
    account: ["read", "update"],
    contracts: ["read", "create", "update", "delete", "manage"],
    people: ["read"],
    units: ["read"]
  },
  Auditor: READ_ALL_RESOURCES,
  Usuario: {
    account: ["read", "update"],
    dossier: ["read", "create", "update"],
    documents: ["read", "create", "update"],
    fill_flows: ["read", "update"],
    signature_flows: ["read", "update"],
    process_execution: ["read", "create"]
  }
};

export const LEGACY_ROLE_RENAMES = {
  Admin: "AdminSistema",
  Gestor: "GestorProcesos"
};

export const CARGO_ROLE_MAP = {
  coordinador: ["GestorProcesos"],
  director: ["GestorProcesos"],
  prorrector: ["GestorProcesos"],
  jefe: ["GestorTalentoHumano"],
  responsable: ["GestorProcesos"],
  docente: ["Usuario"]
};

export const ADMIN_ROLES = ["AdminSistema"];
export const MANAGEMENT_ROLES = ROLE_CATALOG
  .map((role) => role.name)
  .filter((roleName) => roleName !== "Usuario");

export const PROCESS_MANAGEMENT_ROLES = [
  "AdminSistema",
  "GestorProcesos",
  "GestorPlantillas",
  "GestorEjecucionProcesos",
  "GestorDocumental",
  "GestorFirmas"
];

export const OPERATIVE_READ_ROLES = [
  "AdminSistema",
  "Auditor",
  "GestorProcesos",
  "GestorEjecucionProcesos",
  "GestorDocumental",
  "GestorFirmas"
];

export const OPERATIVE_WRITE_ROLES = [
  "AdminSistema",
  "GestorEjecucionProcesos",
  "GestorDocumental"
];

export const TABLE_RESOURCE_MAP = {
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
  process_definition_triggers: "process_definitions",
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
  signature_types: "signature_flows",
  task_assignments: "process_execution",
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

export const DEFAULT_ADMIN_TABLE_RESOURCE = "process_definitions";
