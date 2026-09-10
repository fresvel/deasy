export const ADMIN_ROLE_NAME = "AdminSistema";

export const ROLE_CATALOG = [
  { name: "AdminSistema", description: "Administra seguridad, bootstrap, configuracion critica y gobierno global del sistema." },
  { name: "GestorSeguridad", description: "Gestiona roles, permisos, asignaciones y relaciones de seguridad." },
  { name: "GestorTalentoHumano", description: "Gestiona personas, cargos, puestos y ocupaciones institucionales." },
  { name: "GestorUnidades", description: "Gestiona unidades, tipos de unidad y relaciones jerarquicas." },
  { name: "GestorAcademico", description: "Gestiona periodos y catalogos academicos asociados." },
  { name: "GestorProcesos", description: "Gestiona procesos base, configuraciones, versiones, reglas y disparadores." },
  { name: "GestorPlantillas", description: "Gestiona seeds, artifacts y plantillas asociadas a procesos." },
  { name: "GestorEjecucionProcesos", description: "Gestiona corridas, tareas, entregables y asignaciones operativas." },
  { name: "GestorDocumental", description: "Gestiona documentos, versiones y flujos de entrega documental." },
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
  { code: "process_definitions", name: "Configuraciones de proceso", description: "Procesos base, configuraciones, versiones, reglas y disparadores." },
  { code: "process_execution", name: "Ejecucion de procesos", description: "Corridas, tareas, entregables y asignaciones." },
  { code: "templates", name: "Plantillas", description: "Seeds, artifacts y plantillas de procesos configurados." },
  { code: "documents", name: "Documentos", description: "Documentos, versiones y ciclo documental operativo." },
  { code: "fill_flows", name: "Entrega documental", description: "Flujos, pasos, instancias y solicitudes de entrega." },
  { code: "signature_flows", name: "Firmas", description: "Flujos, solicitudes, estados y firmas documentales." },
  { code: "contracts", name: "Contratacion", description: "Vacantes, postulaciones, ofertas, contratos y origenes." },
  // ⚠️ `read` ENSEÑA EL ESTADO; `manage` ENSEÑA EL QR, y no es una gradacion cualquiera: QUIEN ESCANEA
  // EL QR DECIDE QUE CUENTA DE WHATSAPP ES EL CANAL DE LA INSTITUCION. Es una toma de control de la
  // identidad del canal, no «ver un dato». Quien vigila no tiene por que poder vincular.
  //
  // Lo bueno de que la matriz derive de este catalogo es que el reparto sale solo: AdminSistema
  // hereda las cinco acciones (ve el QR) y Auditor solo `read` (ve el estado, no el QR).
  //
  // `create`, `update` y `delete` existen porque el catalogo da cinco acciones a todo recurso, pero
  // aqui NO LOS MIRA NADIE: esta pantalla es de solo lectura a proposito. Ver
  // docs/arquitecturas/pestana-de-canales.md §7.
  { code: "channels", name: "Canales de mensajeria", description: "Estado de Telegram y WhatsApp, y el codigo de vinculacion." },
  // ⚠️ `update` EDITA EL BORRADOR; `manage` PUBLICA Y RETIRA, y la distancia entre las dos es toda
  // la diferencia entre un texto que se puede corregir y uno que YA NO SE PUEDE TOCAR NUNCA MAS.
  // Publicar copia el texto a un bucket con retencion COMPLIANCE: a partir de ese clic nadie --ni
  // quien administra el sistema-- puede borrarlo ni cambiarlo hasta que venza el plazo. Y retirar
  // decide que texto se le ofrece a quien se registra, que es lo que despues habra que demostrar
  // ante la autoridad (Art. 5 del Reglamento de la LOPDP).
  //
  // Por eso quien redacta no publica: redactar es `update`, comprometer a la institucion es
  // `manage`. Con una sola accion, corregir una coma y sellar diez años serian el mismo permiso.
  //
  // `create` y `delete` existen porque el catalogo da cinco acciones a todo recurso, pero aqui NO
  // LOS MIRA NADIE: crear un borrador es `update` (es el primer paso de redactar) y BORRAR NO
  // EXISTE -- un documento legal se retira, jamas se elimina, porque hay gente cuya prueba de
  // consentimiento apunta a el.
  { code: "legal_documents", name: "Documentos legales", description: "Terminos de uso y tratamiento de datos: borrador, publicacion y retirada." },
  // ⚠️ LOS DOS RECURSOS SENSIBLES (frente 20, P8), marcados con `sensible: true`. La marca NO es
  // decorativa: `READ_ALL_RESOURCES` -- la matriz de Auditor-- se calcula EXCLUYENDOLOS. Antes se
  // calculaba sobre el catalogo entero, y eso queria decir que añadir un recurso le daba a Auditor
  // lectura SIN QUE NADIE LO DECIDIERA. Una discapacidad no es informacion de auditoria.
  //
  // Y NINGUNO de los dos se le da a `Usuario`, aunque el titular si lee y edita lo suyo: el editor de
  // /admin no mira de quien es la fila, asi que `datos_sensibles.read` en Usuario seria leer los de
  // TODOS. Lo propio va por /users/me, que ya comprueba que eres tu.
  {
    code: "datos_sensibles",
    name: "Datos sensibles",
    description: "Categorias especiales de la LOPDP (Art. 25): etnia, identidad de genero, condicion migratoria, salud, cargas familiares.",
    sensible: true
  },
  // Lo peligroso de una cuenta bancaria no es que se LEA sino que se CAMBIE: es el blanco del desvio
  // de nomina (IC3, I-091818-PSA, que nombra a la educacion entre los sectores mas afectados). La LOPDP
  // no la cuenta como dato sensible, y aun asi va aparte y fuera de Auditor por ese motivo.
  { code: "datos_pago", name: "Datos de pago", description: "Cuentas bancarias para pagos.", sensible: true },
  // Geografia del INEC, vocabularios de persona, categorias de visa, la institucion. Hasta P8 no tenian
  // recurso y caian al de procesos, asi que GestorProcesos podia EDITAR la division politica del pais.
  // Los leen todos los gestores -- rellenan desplegables--; los escribe solo quien tiene `manage`.
  { code: "catalogos", name: "Catalogos", description: "Geografia, vocabularios de persona, categorias de visa y la institucion." },
  // Leer la bitacora es de quien vigila, y NO es leer el dato: Auditor ve QUIEN accedio a lo de
  // alguien, no lo que vio.
  { code: "bitacora_sensible", name: "Bitacora de accesos", description: "Quien leyo o cambio datos sensibles y de pago, y cuando." }
];

export const SENSITIVE_RESOURCES = RESOURCE_CATALOG
  .filter((resource) => resource.sensible)
  .map((resource) => resource.code);

export const ACTION_CATALOG = [
  { code: "read", name: "Leer", description: "Consultar registros." },
  { code: "create", name: "Crear", description: "Crear registros." },
  { code: "update", name: "Actualizar", description: "Modificar registros." },
  { code: "delete", name: "Eliminar", description: "Eliminar registros." },
  { code: "manage", name: "Administrar", description: "Administracion completa del modulo." }
];

export const permissionCode = (resourceCode, actionCode) => `${resourceCode}.${actionCode}`;

// Los permisos que salen del catalogo: cada recurso por cada accion, con su codigo y su descripcion.
//
// Vive aqui, y no dentro de quien siembra, porque ahora siembran DOS: el bootstrap
// (`seedBaseRbacCatalog`, que reescribe) y la sincronizacion del arranque (`sincronizarCatalogoRbac`,
// que solo añade). Si cada uno compusiera el codigo y la descripcion a su manera, el mismo permiso
// saldria distinto segun el camino por el que hubiera llegado a la base.
export const PERMISSION_CATALOG = RESOURCE_CATALOG.flatMap((resource) =>
  ACTION_CATALOG.map((action) => ({
    code: permissionCode(resource.code, action.code),
    resourceCode: resource.code,
    actionCode: action.code,
    description: `${action.name} ${resource.name}`.trim()
  }))
);

const MANAGE_ALL_RESOURCES = Object.fromEntries(
  RESOURCE_CATALOG.map((resource) => [resource.code, ["read", "create", "update", "delete", "manage"]])
);

// ⚠️ «TODO» MENOS LO SENSIBLE. Ver `sensible: true` en el catalogo: sin este filtro, cada recurso
// nuevo le daba a Auditor lectura sobre el por construccion.
const READ_ALL_RESOURCES = Object.fromEntries(
  RESOURCE_CATALOG
    .filter((resource) => !resource.sensible)
    .map((resource) => [resource.code, ["read"]])
);

export const ROLE_PERMISSION_MATRIX = {
  AdminSistema: MANAGE_ALL_RESOURCES,
  GestorSeguridad: {
    account: ["read", "update"],
    catalogos: ["read"],
    security: ["read", "create", "update", "delete", "manage"],
    people: ["read"],
    units: ["read"]
  },
  GestorTalentoHumano: {
    account: ["read", "update"],
    catalogos: ["read"],
    // Lee lo sensible y lo de pago, y NO lo escribe: lo escribe el titular desde su perfil, y en
    // /admin solo AdminSistema. Decision del dueño, 2026-09-10.
    datos_sensibles: ["read"],
    datos_pago: ["read"],
    people: ["read", "create", "update", "delete", "manage"],
    units: ["read"],
    contracts: ["read"],
    security: ["read"]
  },
  GestorUnidades: {
    account: ["read", "update"],
    catalogos: ["read"],
    units: ["read", "create", "update", "delete", "manage"],
    people: ["read"],
    academic_terms: ["read"],
    process_definitions: ["read"]
  },
  GestorAcademico: {
    account: ["read", "update"],
    catalogos: ["read"],
    academic_terms: ["read", "create", "update", "delete", "manage"],
    units: ["read"],
    process_definitions: ["read"],
    process_execution: ["read"]
  },
  GestorProcesos: {
    account: ["read", "update"],
    catalogos: ["read"],
    units: ["read"],
    people: ["read"],
    academic_terms: ["read"],
    process_definitions: ["read", "create", "update", "delete", "manage"],
    process_execution: ["read", "create", "update"],
    templates: ["read", "create", "update", "delete", "manage"],
    documents: ["read"],
    fill_flows: ["read"],
    signature_flows: ["read"]
  },
  GestorPlantillas: {
    account: ["read", "update"],
    catalogos: ["read"],
    templates: ["read", "create", "update", "delete", "manage"],
    process_definitions: ["read"],
    documents: ["read"],
    fill_flows: ["read"],
    signature_flows: ["read"]
  },
  GestorEjecucionProcesos: {
    account: ["read", "update"],
    catalogos: ["read"],
    people: ["read"],
    units: ["read"],
    academic_terms: ["read"],
    process_definitions: ["read"],
    process_execution: ["read", "create", "update", "delete", "manage"],
    templates: ["read", "create", "update"],
    documents: ["read", "create", "update"],
    fill_flows: ["read", "update"],
    signature_flows: ["read", "update"]
  },
  GestorDocumental: {
    account: ["read", "update"],
    catalogos: ["read"],
    documents: ["read", "create", "update", "delete", "manage"],
    fill_flows: ["read", "create", "update", "delete", "manage"],
    templates: ["read"],
    process_definitions: ["read"],
    process_execution: ["read"],
    signature_flows: ["read"]
  },
  GestorFirmas: {
    account: ["read", "update"],
    catalogos: ["read"],
    signature_flows: ["read", "create", "update", "delete", "manage"],
    documents: ["read", "update"],
    fill_flows: ["read"],
    people: ["read"]
  },
  GestorContratacion: {
    account: ["read", "update"],
    catalogos: ["read"],
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
  document_version_uploads: "documents",
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
  vacancy_visibility: "contracts",

  // ── Frente 20, P8. HASTA AQUI NO HABIA ENTRADA para estas diecinueve tablas, y una tabla sin
  // entrada caia a `process_definitions` en silencio: GestorProcesos editaba cedulas (medido con un
  // PUT de cuerpo vacio: 400 «Falta la llave primaria», o sea, habia pasado el guard). Ahora una tabla
  // sin entrada queda CERRADA, y `rbacCatalog.test.js` exige que toda tabla de sqlTables.js tenga la
  // suya.
  //
  // Catalogos: se leen para rellenar desplegables; los escribe quien tiene `catalogos.manage`.
  autoidentificaciones_etnicas: "catalogos",
  canales_mensajeria: "catalogos",
  cantones: "catalogos",
  categorias_visa: "catalogos",
  clases_parroquia: "catalogos",
  estados_civiles: "catalogos",
  generos: "catalogos",
  instituciones: "catalogos",
  nomenclatura_territorial: "catalogos",
  paises: "catalogos",
  parentescos: "catalogos",
  parroquias: "catalogos",
  provincias: "catalogos",
  tipos_discapacidad: "catalogos",
  // Los satelites de la persona: la misma proteccion que `persons`.
  direcciones: "people",
  emails: "people",
  telefono_canales: "people",
  telefonos: "people",
  // Sensibles (LOPDP, Art. 25). `documentos_identidad` ENTERA, cedulas incluidas: la visa trae la
  // condicion migratoria -- con categorias como «Solicitante de proteccion internacional»-- y el
  // editor no separa filas por tipo. Por su descripcion, ningun rol aparte de Talento Humano y
  // AdminSistema necesita hojear cedulas en /admin. Decision del dueño, 2026-09-10.
  documentos_identidad: "datos_sensibles",
  persona_autoidentificacion: "datos_sensibles",
  // La bitacora: la leen Auditor y AdminSistema, y nadie la escribe desde /admin (hook en tableHooks).
  accesos_sensibles: "bitacora_sensible"
};
