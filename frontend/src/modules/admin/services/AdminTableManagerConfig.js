export const personAssignmentSections = [
  { key: "ocupaciones", label: "Ocupación", icon: "id-card" },
  { key: "roles", label: "Rol", icon: "lock" },
  { key: "contratos", label: "Contrato", icon: "certificate" }
];

export const PROCESS_INLINE_HIDDEN_FIELDS = new Set([
  "version",
  "version_name",
  "version_slug",
  "version_effective_to",
  "version_parent_version_id"
]);

export const PROCESS_DEFINITION_HIDDEN_FIELDS = new Set([
  "variation_key"
]);

export const personCargoTableFields = [
  { name: "id", label: "ID" },
  { name: "position_id", label: "Puesto" },
  { name: "unit_label", label: "Unidad" },
  { name: "start_date", label: "Inicio" },
  { name: "end_date", label: "Fin" },
  { name: "is_current", label: "Actual" }
];

export const personRoleTableFields = [
  { name: "id", label: "ID" },
  { name: "role_id", label: "Rol" },
  { name: "unit_id", label: "Unidad" },
  { name: "assigned_at", label: "Asignado" }
];

export const personContractTableFields = [
  { name: "id", label: "ID" },
  { name: "position_id", label: "Puesto" },
  { name: "relation_type", label: "Relacion" },
  { name: "dedication", label: "Dedicacion" },
  { name: "start_date", label: "Inicio" },
  { name: "end_date", label: "Fin" },
  { name: "status", label: "Estado" }
];

export const vacantPositionTableFields = [
  { name: "id", label: "ID" },
  { name: "__unit_type_id", label: "Tipo de unidad" },
  { name: "unit_id", label: "Unidad" },
  { name: "cargo_id", label: "Cargo" },
  { name: "position_type", label: "Tipo de puesto" },
  { name: "slot_no", label: "Plaza" },
  { name: "title", label: "Titulo" }
];

export const unassignedTemplateArtifactTableFields = [
  { name: "id", label: "ID" },
  { name: "display_name", label: "Nombre" },
  { name: "available_formats", label: "Formatos" },
  { name: "template_code", label: "Codigo" },
  { name: "source_version", label: "Version fuente" },
  { name: "storage_version", label: "Version storage" },
  { name: "is_active", label: "Activo" }
];

export const processDefinitionActivationRuleTableFields = [
  { name: "unit_scope_type", label: "Alcance" },
  { name: "destination", label: "Destino" },
  { name: "is_active", label: "Activo" }
];

export const processDefinitionActivationTriggerTableFields = [
  { name: "trigger_mode", label: "Modo" },
  { name: "term_type_id", label: "Tipo de periodo" },
  { name: "is_active", label: "Activo" }
];

export const processDefinitionActivationArtifactTableFields = [
  { name: "template_artifact_id", label: "Paquete" },
  { name: "usage_role", label: "Rol" },
  { name: "creates_task", label: "Genera tarea" }
];

export const definitionArtifactsTableFields = [
  { name: "id", label: "ID" },
  { name: "template_artifact_id", label: "Artifact" },
  { name: "usage_role", label: "Rol" },
  { name: "creates_task", label: "Genera tarea" },
  { name: "is_required", label: "Requerido" },
  { name: "sort_order", label: "Orden" }
];

export const definitionTriggersTableFields = [
  { name: "id", label: "ID" },
  { name: "trigger_mode", label: "Modo" },
  { name: "term_type_id", label: "Tipo de periodo" },
  { name: "is_active", label: "Activo" }
];

export const definitionRulesTableFields = [
  { name: "id", label: "ID" },
  { name: "unit_scope_type", label: "Alcance" },
  { name: "unit_id", label: "Unidad" },
  { name: "unit_type_id", label: "Tipo de unidad" },
  { name: "cargo_id", label: "Cargo" },
  { name: "position_id", label: "Puesto" },
  { name: "recipient_policy", label: "Entrega" },
  { name: "is_active", label: "Activo" }
];

export const recordViewerSummaryTableFields = [
  { name: "label", label: "Campo" },
  { name: "value", label: "Valor" }
];

export const fkViewerSummaryTableFields = [
  { name: "label", label: "Campo" },
  { name: "value", label: "Valor" }
];

export const FK_TABLE_MAP = {
  parent_id: "processes",
  parent_task_id: "tasks",
  process_id: "processes",
  series_id: "process_definition_series",
  process_definition_id: "process_definition_versions",
  process_run_id: "process_runs",
  source_run_id: "process_runs",
  process_definition_template_id: "process_definition_templates",
  fill_flow_template_id: "fill_flow_templates",
  fill_flow_step_id: "fill_flow_steps",
  template_seed_id: "template_seeds",
  term_type_id: "term_types",
  term_id: "terms",
  task_id: "tasks",
  unit_type_id: "unit_types",
  unit_id: "units",
  parent_unit_id: "units",
  child_unit_id: "units",
  relation_type_id: "relation_unit_types",
  template_id: "signature_flow_templates",
  template_artifact_id: "template_artifacts",
  task_item_id: "task_items",
  document_id: "documents",
  document_version_id: "document_versions",
  document_fill_flow_id: "document_fill_flows",
  owner_person_id: "persons",
  created_by_user_id: "persons",
  person_id: "persons",
  responsible_position_id: "unit_positions",
  role_id: "roles",
  permission_id: "permissions",
  resource_id: "resources",
  action_id: "actions",
  cargo_id: "cargos",
  required_cargo_id: "cargos",
  signer_user_id: "persons",
  position_id: "unit_positions",
  assigned_person_id: "persons",
  vacancy_id: "vacancies",
  role_assignment_id: "role_assignments",
  signature_request_id: "signature_requests",
  signature_type_id: "signature_types",
  signature_status_id: "signature_statuses",
  step_id: "signature_flow_steps",
  step_type_id: "signature_types",
  instance_id: "signature_flow_instances",
  status_id: "signature_request_statuses"
};

export const RELATED_RECORD_CONFIG = {
  persons: [
    { table: "position_assignments", label: "Ocupaciones", foreignKey: "person_id", orderBy: "start_date", order: "desc" },
    { table: "role_assignments", label: "Roles", foreignKey: "person_id", orderBy: "assigned_at", order: "desc" },
    { table: "contracts", label: "Contratos", foreignKey: "person_id", orderBy: "start_date", order: "desc" }
  ],
  processes: [
    { table: "process_definition_versions", label: "Definiciones", foreignKey: "process_id", orderBy: "effective_from", order: "desc" }
  ],
  process_definition_versions: [
    { table: "process_definition_triggers", label: "Disparadores", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" },
    { table: "process_target_rules", label: "Reglas de alcance", foreignKey: "process_definition_id", orderBy: "priority", order: "asc" },
    { table: "process_definition_templates", label: "Plantillas", foreignKey: "process_definition_id", orderBy: "sort_order", order: "asc" },
    { table: "process_runs", label: "Corridas", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" },
    { table: "tasks", label: "Tareas", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" }
  ],
  process_runs: [
    { table: "tasks", label: "Tareas", foreignKey: "process_run_id", orderBy: "created_at", order: "desc" }
  ],
  process_definition_templates: [
    { table: "fill_flow_templates", label: "Flujos de llenado", foreignKey: "process_definition_template_id", orderBy: "created_at", order: "desc" },
    { table: "signature_flow_templates", label: "Flujos de firma", foreignKey: "process_definition_template_id", orderBy: "created_at", order: "desc" }
  ],
  fill_flow_templates: [
    { table: "fill_flow_steps", label: "Pasos de llenado", foreignKey: "fill_flow_template_id", orderBy: "step_order", order: "asc" }
  ],
  tasks: [
    { table: "task_items", label: "Items", foreignKey: "task_id", orderBy: "sort_order", order: "asc" },
    { table: "task_assignments", label: "Asignaciones", foreignKey: "task_id", orderBy: "assigned_at", order: "desc" }
  ],
  task_items: [
    { table: "documents", label: "Documentos", foreignKey: "task_item_id", orderBy: "created_at", order: "desc" }
  ],
  documents: [
    { table: "document_versions", label: "Versiones del documento", foreignKey: "document_id", orderBy: "created_at", order: "desc" }
  ],
  document_versions: [
    { table: "document_fill_flows", label: "Flujos de llenado", foreignKey: "document_version_id", orderBy: "created_at", order: "desc" },
    { table: "signature_flow_instances", label: "Flujos de firma", foreignKey: "document_version_id", orderBy: "created_at", order: "desc" }
  ],
  document_fill_flows: [
    { table: "fill_requests", label: "Solicitudes de llenado", foreignKey: "document_fill_flow_id", orderBy: "requested_at", order: "desc" }
  ],
  units: [
    { table: "unit_positions", label: "Puestos", foreignKey: "unit_id", orderBy: "created_at", order: "desc" },
    { table: "role_assignments", label: "Roles asignados", foreignKey: "unit_id", orderBy: "assigned_at", order: "desc" }
  ],
  vacancies: [
    { table: "vacancy_visibility", label: "Visibilidad", foreignKey: "vacancy_id", orderBy: "created_at", order: "desc" },
    { table: "aplications", label: "Aplicaciones", foreignKey: "vacancy_id", orderBy: "applied_at", order: "desc" }
  ]
};

export const formatTemplateArtifactFieldLabel = (field) => {
  if (!field || field.name !== "available_formats") {
    return field;
  }
  return {
    ...field,
    label: "Formatos"
  };
};
