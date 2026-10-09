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
  { name: "storage_version", label: "Version" },
  { name: "is_active", label: "Activo" }
];

export const processDefinitionActivationRuleTableFields = [
  { name: "unit_scope_type", label: "Alcance" },
  { name: "destination", label: "Destino" },
  { name: "is_active", label: "Activo" }
];

export const processDefinitionActivationTriggerTableFields = [
  { name: "term_type_id", label: "Tipo de periodo" },
  { name: "is_active", label: "Activo" }
];

export const processDefinitionActivationArtifactTableFields = [
  { name: "edicion_id", label: "Plantilla documental" }
];

export const definitionArtifactsTableFields = [
  { name: "id", label: "ID" },
  { name: "edicion_id", label: "Plantilla documental" },
  { name: "item_mode", label: "Modo de emisión" },
  { name: "sort_order", label: "Orden" }
];

export const definitionTriggersTableFields = [
  { name: "id", label: "ID" },
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

export const FK_TABLE_MAP = {
  parent_id: "processes",
  process_id: "processes",
  series_id: "process_definition_series",
  process_definition_id: "process_definition_versions",
  process_run_id: "process_runs",
  source_run_id: "process_runs",
  vinculo_id: "vinculos",
  // LA RECETA Y LA EJECUCION DEL RECORRIDO. Aqui habia SEIS entradas --dos cabeceras, dos pasos, la
  // instancia de entrega y las dos de firma-- y son cuatro, porque las dos mitades son la misma
  // pareja de tablas (paso 4 de la fase 4 del frente 24).
  paso_id: "pasos_declarados",
  participante_id: "participantes_declarados",
  recorrido_id: "recorridos",
  persona_id: "persons",
  generador_id: "generadores_de_documento",
  term_type_id: "term_types",
  term_id: "terms",
  task_id: "tasks",
  unit_type_id: "unit_types",
  unit_id: "units",
  parent_unit_id: "units",
  child_unit_id: "units",
  relation_type_id: "relation_unit_types",
  // Identidad y geografía (2026-08-28). Sin esto, el editor pinta el número crudo: un
  // `pais_id: 60` en vez de "Ecuador".
  pais_id: "paises",
  provincia_id: "provincias",
  canton_id: "cantones",
  parroquia_id: "parroquias",
  clase_id: "clases_parroquia",
  genero_id: "generos",
  estado_civil_id: "estados_civiles",
  autoidentificacion_etnica_id: "autoidentificaciones_etnicas",
  tipo_discapacidad_id: "tipos_discapacidad",
  parentesco_id: "parentescos",
  categoria_visa_id: "categorias_visa",
  nacimiento_pais_id: "paises",
  nacimiento_canton_id: "cantones",
  nacionalidad_pais_id: "paises",
  canal_id: "canales_mensajeria",
  telefono_id: "telefonos",
  // La nacionalidad es una columna REAL de `persons`. Sin esta entrada el formulario pide un NÚMERO
  // («pais_id») en vez de ofrecer el catálogo, y quien da de alta tiene que saberse los ids.
  //
  // Aquí hubo tres entradas más —`documento_pais_id`, `telefono_pais_id`, `documento_tipo_id`— para
  // los campos virtuales del alta de persona. Se fueron con ellos el 2026-08-28: no son columnas de
  // ninguna tabla, así que sin el formulario que las inventaba no las pedía nadie.
  nacionalidad_pais_id: "paises",
  edicion_id: "ediciones",
  task_item_id: "task_items",
  // `document_id: "documents"` vivio aqui hasta el paso 4 de la fase 4 del frente 24. La tabla
  // murio el 2026-08-23 --era una cascara 1:1 sobre el entregable, sin ni una columna propia-- y
  // esta entrada se quedo apuntando al vacio: el editor pedia un catalogo que no existe.
  document_version_id: "document_versions",
  owner_person_id: "persons",
  created_by_user_id: "persons",
  person_id: "persons",
  // La bitacora de accesos sensibles: de quien es el dato y quien accedio.
  titular_person_id: "persons",
  actor_person_id: "persons",
  responsible_position_id: "unit_positions",
  role_id: "roles",
  permission_id: "permissions",
  resource_id: "resources",
  action_id: "actions",
  cargo_id: "cargos",
  signer_user_id: "persons",
  position_id: "unit_positions",
  assigned_person_id: "persons",
  vacancy_id: "vacancies",
  role_assignment_id: "role_assignments",
  // La columna conserva su nombre y lo que referencia es un TURNO (paso 3b de la fase 4): la lee el
  // firmador y viaja en la API, asi que renombrarla es otro cambio.
  turno_id: "turnos",
  signature_status_id: "signature_statuses"
};

export const RELATED_RECORD_CONFIG = {
  persons: [
    { table: "position_assignments", label: "Ocupaciones", foreignKey: "person_id", orderBy: "start_date", order: "desc" },
    { table: "role_assignments", label: "Roles", foreignKey: "person_id", orderBy: "assigned_at", order: "desc" },
    { table: "contracts", label: "Contratos", foreignKey: "person_id", orderBy: "start_date", order: "desc" }
  ],
  processes: [
    { table: "process_definition_versions", label: "Configuraciones", foreignKey: "process_id", orderBy: "effective_from", order: "desc" }
  ],
  process_definition_versions: [
    { table: "process_definition_period_types", label: "Periodos del proceso", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" },
    { table: "process_target_rules", label: "Reglas de alcance", foreignKey: "process_definition_id", orderBy: "priority", order: "asc" },
    { table: "vinculos", label: "Plantillas", foreignKey: "process_definition_id", orderBy: "sort_order", order: "asc" },
    { table: "process_runs", label: "Corridas", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" },
    { table: "tasks", label: "Tareas", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" }
  ],
  process_runs: [
    { table: "tasks", label: "Tareas", foreignKey: "process_run_id", orderBy: "created_at", order: "desc" }
  ],
  // Los recorridos autorados cuelgan de la EDICIÓN, no del vínculo: el escalón del vínculo murió en
  // la fase 2 del frente 24 y su columna ya no existe. Un vínculo alcanza su recorrido A TRAVÉS de
  // la edición que enlaza, así que aquí no hay nada que listar.
  // UNA ENTRADA PARA LOS DOS LADOS: los pasos de entrega y de firma de una edicion son la misma
  // tabla, con su columna `accion`.
  ediciones: [
    { table: "pasos_declarados", label: "Pasos del recorrido", foreignKey: "edicion_id", orderBy: "orden", order: "asc" }
  ],
  pasos_declarados: [
    { table: "participantes_declarados", label: "Participantes", foreignKey: "paso_id", orderBy: "orden", order: "asc" }
  ],
  tasks: [
    { table: "task_items", label: "Items", foreignKey: "task_id", orderBy: "sort_order", order: "asc" }
  ],
  task_items: [
    // Aqui ponia `documents`, la tabla que murio el 2026-08-23: las versiones cuelgan del ENTREGABLE.
    { table: "document_versions", label: "Versiones", foreignKey: "task_item_id", orderBy: "created_at", order: "desc" },
    // Sustituye a las «Asignaciones» (`task_assignments`), que colgaban de la TAREA. La tenencia
    // cuelga del ENTREGABLE, que es el grano al que de verdad se responde: una tarea reparte varios
    // entregables y cada uno tiene su propio responsable y su propia sucesión.
    { table: "task_item_tenures", label: "Tenencias", foreignKey: "task_item_id", orderBy: "started_at", order: "desc" }
  ],
  document_versions: [
    { table: "recorridos", label: "Recorridos", foreignKey: "document_version_id", orderBy: "created_at", order: "desc" }
  ],
  recorridos: [
    { table: "turnos", label: "Turnos", foreignKey: "recorrido_id", orderBy: "solicitado", order: "desc" }
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
