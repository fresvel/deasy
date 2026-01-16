export const SQL_TABLES = [
  {
    table: "unit_types",
    label: "Tipos de unidad",
    category: "Estructura",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name"]
  },
  {
    table: "units",
    label: "Unidades",
    category: "Estructura",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "unit_type_id", label: "Tipo de unidad", type: "number", required: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug"]
  },
  {
    table: "unit_relations",
    label: "Relaciones de unidades",
    category: "Estructura",
    primaryKeys: ["parent_unit_id", "child_unit_id"],
    fields: [
      { name: "parent_unit_id", label: "Unidad padre", type: "number", required: true },
      { name: "child_unit_id", label: "Unidad hija", type: "number", required: true },
      { name: "relation_type", label: "Tipo de relacion", type: "text", defaultValue: "parent" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["relation_type"]
  },
  {
    table: "programs",
    label: "Programas",
    category: "Academico",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      {
        name: "level_type",
        label: "Nivel",
        type: "select",
        required: true,
        options: ["grado", "maestria", "doctorado", "tecnico", "tecnologico"]
      },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug", "level_type"]
  },
  {
    table: "program_unit_history",
    label: "Historial programa-unidad",
    category: "Academico",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "program_id", label: "Programa", type: "number", required: true },
      { name: "unit_id", label: "Unidad", type: "number", required: true },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date" },
      { name: "is_current", label: "Actual", type: "boolean", defaultValue: 1 }
    ],
    searchFields: []
  },
  {
    table: "processes",
    label: "Procesos",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "parent_id", label: "Proceso padre", type: "number" },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "program_id", label: "Programa", type: "number" },
      { name: "has_document", label: "Tiene documento", type: "boolean", defaultValue: 1 },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug"]
  },
  {
    table: "unit_processes",
    label: "Procesos por unidad",
    category: "Procesos",
    primaryKeys: ["unit_id", "process_id"],
    allowPrimaryKeyUpdate: true,
    fields: [
      { name: "unit_id", label: "Unidad", type: "number", required: true },
      { name: "process_id", label: "Proceso", type: "number", required: true }
    ],
    searchFields: []
  },
  {
    table: "program_processes",
    label: "Procesos por programa",
    category: "Procesos",
    primaryKeys: ["program_id", "process_id"],
    allowPrimaryKeyUpdate: true,
    fields: [
      { name: "program_id", label: "Programa", type: "number", required: true },
      { name: "process_id", label: "Proceso", type: "number", required: true }
    ],
    searchFields: []
  },
  {
    table: "terms",
    label: "Periodos",
    category: "Academico",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date", required: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 }
    ],
    searchFields: ["name"]
  },
  {
    table: "templates",
    label: "Plantillas",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "version", label: "Version", type: "text", defaultValue: "0.1", readOnly: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug"]
  },
  {
    table: "process_templates",
    label: "Plantillas por proceso",
    category: "Plantillas",
    primaryKeys: ["process_id", "template_id"],
    allowPrimaryKeyUpdate: true,
    fields: [
      { name: "process_id", label: "Proceso", type: "number", required: true },
      { name: "template_id", label: "Plantilla", type: "number", required: true }
    ],
    searchFields: []
  },
  {
    table: "persons",
    label: "Personas",
    category: "Personas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "cedula", label: "Cedula", type: "text" },
      { name: "first_name", label: "Nombre", type: "text", required: true },
      { name: "last_name", label: "Apellido", type: "text", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "whatsapp", label: "Whatsapp", type: "text" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["cedula", "first_name", "last_name", "email"]
  },
  {
    table: "roles",
    label: "Roles",
    category: "Seguridad",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 }
    ],
    searchFields: ["name"]
  },
  {
    table: "permissions",
    label: "Permisos",
    category: "Seguridad",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "code", label: "Codigo", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" }
    ],
    searchFields: ["code", "description"]
  },
  {
    table: "role_permissions",
    label: "Permisos por rol",
    category: "Seguridad",
    primaryKeys: ["role_id", "permission_id"],
    allowPrimaryKeyUpdate: true,
    fields: [
      { name: "role_id", label: "Rol", type: "number", required: true },
      { name: "permission_id", label: "Permiso", type: "number", required: true }
    ],
    searchFields: []
  },
  {
    table: "role_assignments",
    label: "Asignaciones de rol",
    category: "Seguridad",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "person_id", label: "Persona", type: "number", required: true },
      { name: "role_id", label: "Rol", type: "number", required: true },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "program_id", label: "Programa", type: "number" },
      { name: "assigned_at", label: "Asignado", type: "datetime", readOnly: true }
    ],
    searchFields: []
  },
  {
    table: "cargos",
    label: "Cargos",
    category: "Personas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 }
    ],
    searchFields: ["name"]
  },
  {
    table: "person_cargos",
    label: "Cargos por persona",
    category: "Personas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "person_id", label: "Persona", type: "number", required: true },
      { name: "cargo_id", label: "Cargo", type: "number", required: true },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "program_id", label: "Programa", type: "number" },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date" },
      { name: "is_current", label: "Actual", type: "boolean", defaultValue: 1 },
      { name: "current_flag", label: "Marca actual", type: "boolean", readOnly: true }
    ],
    searchFields: []
  },
  {
    table: "documents",
    label: "Documentos",
    category: "Documentos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_id", label: "Proceso", type: "number", required: true },
      { name: "term_id", label: "Periodo", type: "number", required: true },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "program_id", label: "Programa", type: "number" },
      { name: "unit_id_key", label: "Unidad llave", type: "number", readOnly: true },
      { name: "program_id_key", label: "Programa llave", type: "number", readOnly: true },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["Inicial", "En proceso", "Aprobado", "Rechazado"],
        defaultValue: "Inicial"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
    ],
    searchFields: ["status"]
  },
  {
    table: "document_versions",
    label: "Versiones de documento",
    category: "Documentos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "document_id", label: "Documento", type: "number", required: true },
      { name: "version", label: "Version", type: "number", required: true },
      { name: "payload_mongo_id", label: "Payload mongo", type: "text", required: true },
      { name: "payload_hash", label: "Hash", type: "text", required: true },
      { name: "latex_path", label: "Ruta LaTeX", type: "text" },
      { name: "pdf_path", label: "Ruta PDF", type: "text" },
      { name: "signed_pdf_path", label: "Ruta firmado", type: "text" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["Borrador", "Final", "Archivado"],
        defaultValue: "Borrador"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["payload_mongo_id", "payload_hash", "status"]
  },
  {
    table: "document_signatures",
    label: "Firmas de documento",
    category: "Documentos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "document_version_id", label: "Version documento", type: "number", required: true },
      { name: "signer_user_id", label: "Firmante", type: "number", required: true },
      {
        name: "signature_role",
        label: "Rol firma",
        type: "select",
        options: ["autor", "revisor", "aprobador"],
        required: true
      },
      {
        name: "signature_status",
        label: "Estado firma",
        type: "select",
        options: ["pendiente", "firmado", "rechazado"],
        defaultValue: "pendiente"
      },
      { name: "note_short", label: "Nota", type: "textarea" },
      { name: "signed_file_path", label: "Ruta firmada", type: "text" },
      { name: "signed_at", label: "Firmado", type: "datetime" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["signature_role", "signature_status"]
  },
  {
    table: "vacancies",
    label: "Vacantes",
    category: "Contratos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "program_id", label: "Programa", type: "number" },
      { name: "title", label: "Titulo", type: "text", required: true },
      { name: "category", label: "Categoria", type: "text" },
      {
        name: "dedication",
        label: "Dedicacion",
        type: "select",
        options: ["TC", "MT", "TP"],
        required: true
      },
      {
        name: "relation_type",
        label: "Relacion",
        type: "select",
        options: ["dependencia", "servicios"],
        required: true
      },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["abierta", "cerrada", "ocupada"],
        defaultValue: "abierta"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["title", "category", "status"]
  },
  {
    table: "contracts",
    label: "Contratos",
    category: "Contratos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "person_id", label: "Persona", type: "number", required: true },
      { name: "vacancy_id", label: "Vacante", type: "number", required: true },
      {
        name: "relation_type",
        label: "Relacion",
        type: "select",
        options: ["dependencia", "servicios"],
        required: true
      },
      {
        name: "dedication",
        label: "Dedicacion",
        type: "select",
        options: ["TC", "MT", "TP"],
        required: true
      },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["activo", "terminado", "suspendido"],
        defaultValue: "activo"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["status"]
  },
  {
    table: "student_program_terms",
    label: "Matriculas",
    category: "Academico",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "person_id", label: "Persona", type: "number", required: true },
      { name: "program_id", label: "Programa", type: "number", required: true },
      { name: "term_id", label: "Periodo", type: "number", required: true },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["activo", "inactivo", "retirado"],
        defaultValue: "activo"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["status"]
  }
];

export const SQL_TABLE_MAP = Object.fromEntries(SQL_TABLES.map((table) => [table.table, table]));
