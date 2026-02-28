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
    table: "relation_unit_types",
    label: "Tipos de relacion",
    category: "Estructura",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "code", label: "Codigo", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_inheritance_allowed", label: "Herencia", type: "boolean", defaultValue: 0 },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["code", "name"]
  },
  {
    table: "units",
    label: "Unidades",
    category: "Estructura",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "label", label: "Etiqueta", type: "text" },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "unit_type_id", label: "Tipo de unidad", type: "number", required: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug"]
  },
  {
    table: "unit_relations",
    label: "Relaciones de unidades",
    category: "Estructura",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "relation_type_id", label: "Tipo de relacion", type: "number", required: true },
      { name: "parent_unit_id", label: "Unidad padre", type: "number", required: true },
      { name: "child_unit_id", label: "Unidad hija", type: "number", required: true },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
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
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "active_definition_version", label: "Definicion activa", type: "text", readOnly: true, virtual: true },
      { name: "active_execution_mode", label: "Modo activo", type: "text", readOnly: true, virtual: true },
      { name: "active_definition_status", label: "Estado definicion", type: "text", readOnly: true, virtual: true },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug"]
  },
  {
    table: "process_definition_versions",
    label: "Definiciones de proceso",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_id", label: "Proceso", type: "number", required: true },
      { name: "variation_key", label: "Serie", type: "text", required: true, defaultValue: "general" },
      { name: "definition_version", label: "Version", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "has_document", label: "Tiene documento", type: "boolean", defaultValue: 1 },
      {
        name: "execution_mode",
        label: "Modo",
        type: "select",
        options: ["manual", "system", "hybrid"],
        defaultValue: "manual"
      },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["draft", "active", "retired"],
        defaultValue: "draft"
      },
      { name: "effective_from", label: "Vigencia desde", type: "date", required: true },
      { name: "effective_to", label: "Vigencia hasta", type: "date" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["variation_key", "definition_version", "name", "status"]
  },
  {
    table: "process_target_rules",
    label: "Reglas de alcance",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_definition_id", label: "Definicion", type: "number", required: true },
      {
        name: "unit_scope_type",
        label: "Alcance",
        type: "select",
        options: ["unit_exact", "unit_subtree", "unit_type", "all_units"],
        defaultValue: "unit_exact"
      },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "unit_type_id", label: "Tipo de unidad", type: "number" },
      { name: "include_descendants", label: "Incluye descendientes", type: "boolean", defaultValue: 0 },
      { name: "cargo_id", label: "Cargo", type: "number" },
      { name: "position_id", label: "Puesto exacto", type: "number" },
      {
        name: "recipient_policy",
        label: "Entrega",
        type: "select",
        options: ["all_matches", "one_per_unit", "one_match_only", "exact_position"],
        defaultValue: "all_matches"
      },
      { name: "priority", label: "Prioridad", type: "number", defaultValue: 1 },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "effective_from", label: "Vigencia desde", type: "date" },
      { name: "effective_to", label: "Vigencia hasta", type: "date" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["unit_scope_type", "recipient_policy"]
  },
  {
    table: "term_types",
    label: "Tipos de periodo",
    category: "Academico",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "code", label: "Codigo", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
    ],
    searchFields: ["code", "name"]
  },
  {
    table: "terms",
    label: "Periodos",
    category: "Academico",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "term_type_id", label: "Tipo de periodo", type: "number", required: true },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date", required: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 }
    ],
    searchFields: ["name"]
  },
  {
    table: "tasks",
    label: "Tareas",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_definition_id", label: "Definicion de proceso", type: "number", required: true },
      { name: "term_id", label: "Periodo", type: "number", required: true },
      { name: "parent_task_id", label: "Tarea padre", type: "number" },
      { name: "responsible_position_id", label: "Puesto responsable", type: "number" },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "comments_thread_ref", label: "Comentarios (Mongo)", type: "text" },
      { name: "is_main", label: "Tarea principal", type: "boolean", defaultValue: 1 },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["pendiente", "en_proceso", "completada", "cancelada"],
        defaultValue: "pendiente"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["status"]
  },
  {
    table: "task_assignments",
    label: "Asignaciones de tareas",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "task_id", label: "Tarea", type: "number", required: true },
      { name: "position_id", label: "Puesto", type: "number", required: true },
      { name: "assigned_person_id", label: "Responsable (snapshot)", type: "number" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["pendiente", "en_proceso", "completada", "cancelada"],
        defaultValue: "pendiente"
      },
      { name: "assigned_at", label: "Asignado", type: "datetime", readOnly: true },
      { name: "unassigned_at", label: "Desasignado", type: "datetime" }
    ],
    searchFields: ["status"]
  },
  {
    table: "template_artifacts",
    label: "Artifacts de plantilla",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "template_code", label: "Codigo", type: "text", required: true },
      { name: "display_name", label: "Nombre", type: "text", required: true },
      { name: "source_version", label: "Version fuente", type: "text", required: true },
      { name: "storage_version", label: "Version storage", type: "text", required: true },
      { name: "bucket", label: "Bucket", type: "text", required: true },
      { name: "base_object_prefix", label: "Prefijo base", type: "text", required: true },
      {
        name: "mode",
        label: "Modo",
        type: "select",
        options: ["system", "user"],
        required: true
      },
      { name: "format", label: "Formato", type: "text", required: true },
      { name: "entry_object_key", label: "Ruta de entrada", type: "text", required: true },
      { name: "schema_object_key", label: "Ruta schema", type: "text", required: true },
      { name: "meta_object_key", label: "Ruta meta", type: "text", required: true },
      { name: "content_hash", label: "Hash", type: "text" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["template_code", "display_name", "format", "storage_version"]
  },
  {
    table: "process_definition_template_bindings",
    label: "Vinculos definicion-plantilla",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_definition_id", label: "Definicion", type: "number", required: true },
      { name: "template_artifact_id", label: "Artifact", type: "number", required: true },
      {
        name: "usage_role",
        label: "Uso",
        type: "select",
        options: ["system_render", "manual_fill", "attachment", "support"],
        defaultValue: "manual_fill"
      },
      { name: "is_required", label: "Requerido", type: "boolean", defaultValue: 1 },
      { name: "sort_order", label: "Orden", type: "number", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["usage_role"]
  },
  {
    table: "templates",
    label: "Plantillas",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_id", label: "Proceso", type: "number", required: true },
      { name: "process_name", label: "Proceso", type: "text", readOnly: true, virtual: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug"]
  },
  {
    table: "template_versions",
    label: "Versiones de plantilla",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "template_id", label: "Plantilla", type: "number", required: true },
      { name: "version", label: "Version", type: "text", required: true },
      { name: "mongo_ref", label: "Mongo ref", type: "text", required: true },
      { name: "mongo_version", label: "Mongo version", type: "text", required: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["version", "mongo_ref", "mongo_version"]
  },
  {
    table: "persons",
    label: "Usuarios",
    category: "Usuarios",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "cedula", label: "Cedula", type: "text" },
      { name: "first_name", label: "Nombre", type: "text", required: true },
      { name: "last_name", label: "Apellido", type: "text", required: true },
      { name: "email", label: "Email", type: "email" },
      { name: "whatsapp", label: "Whatsapp", type: "text" },
      { name: "direccion", label: "Direccion", type: "text" },
      { name: "pais", label: "Pais", type: "text" },
      { name: "password_hash", label: "Password Hash", type: "text", required: true },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["Inactivo", "Activo", "Verificado", "Reportado"],
        defaultValue: "Inactivo"
      },
      { name: "verify_email", label: "Email verificado", type: "boolean", defaultValue: 0 },
      { name: "verify_whatsapp", label: "Whatsapp verificado", type: "boolean", defaultValue: 0 },
      { name: "photo_url", label: "Foto", type: "text" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
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
    table: "cargo_role_map",
    label: "Mapa cargo-rol",
    category: "Seguridad",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "cargo_id", label: "Cargo", type: "number", required: true },
      { name: "role_id", label: "Rol", type: "number", required: true }
    ],
    searchFields: []
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
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
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
      { name: "unit_id", label: "Unidad", type: "number", required: true },
      { name: "derived_from_assignment_id", label: "Derivado de ocupacion", type: "number" },
      {
        name: "source",
        label: "Origen",
        type: "select",
        options: ["manual", "derived"],
        defaultValue: "manual"
      },
      { name: "max_depth", label: "Profundidad", type: "number", defaultValue: 0 },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date" },
      { name: "is_current", label: "Actual", type: "boolean", defaultValue: 1 },
      { name: "current_flag", label: "Marca actual", type: "boolean", readOnly: true },
      { name: "assigned_at", label: "Asignado", type: "datetime", readOnly: true },
      { name: "revoked_at", label: "Revocado", type: "datetime" },
      { name: "revoked_reason", label: "Motivo", type: "text" }
    ],
    searchFields: []
  },
  {
    table: "role_assignment_relation_types",
    label: "Relaciones de asignacion de rol",
    category: "Seguridad",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "relation_type_id", label: "Tipo de relacion", type: "number", required: true },
      { name: "role_assignment_id", label: "Asignacion de rol", type: "number", required: true }
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
    table: "unit_positions",
    label: "Puestos",
    category: "Estructura",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "unit_id", label: "Unidad", type: "number", required: true },
      { name: "cargo_id", label: "Cargo", type: "number", required: true },
      { name: "slot_no", label: "Plaza", type: "number", required: true },
      { name: "title", label: "Titulo", type: "text" },
      { name: "profile_ref", label: "Perfil (Mongo)", type: "text" },
      {
        name: "position_type",
        label: "Tipo de puesto",
        type: "select",
        options: ["real", "promocion", "simbolico"],
        defaultValue: "real"
      },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "deactivated_at", label: "Desactivado", type: "datetime" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
    ],
    searchFields: ["title"]
  },
  {
    table: "position_assignments",
    label: "Ocupaciones",
    category: "Estructura",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "position_id", label: "Puesto", type: "number", required: true },
      { name: "person_id", label: "Persona", type: "number", required: true },
      { name: "start_date", label: "Inicio", type: "date", required: true },
      { name: "end_date", label: "Fin", type: "date" },
      { name: "is_current", label: "Actual", type: "boolean", defaultValue: 1 },
      { name: "current_flag", label: "Marca actual", type: "boolean", readOnly: true },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
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
      { name: "task_id", label: "Tarea", type: "number", required: true },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["Inicial", "En proceso", "Aprobado", "Rechazado"],
        defaultValue: "Inicial"
      },
      { name: "comments_thread_ref", label: "Comentarios (Mongo)", type: "text" },
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
      { name: "version", label: "Version", type: "number", defaultValue: "0.1", required: true },
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
      { name: "signature_request_id", label: "Solicitud", type: "number" },
      { name: "document_version_id", label: "Version documento", type: "number", required: true },
      { name: "signer_user_id", label: "Firmante", type: "number", required: true },
      { name: "signature_type_id", label: "Tipo firma", type: "number", required: true },
      { name: "signature_status_id", label: "Estado firma", type: "number", required: true },
      { name: "note_short", label: "Nota", type: "textarea" },
      { name: "signed_file_path", label: "Ruta firmada", type: "text" },
      { name: "signed_at", label: "Firmado", type: "datetime" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["signature_type_id", "signature_status_id"]
  },
  {
    table: "signature_types",
    label: "Tipos de firma",
    category: "Firmas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "code", label: "Codigo", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["code", "name"]
  },
  {
    table: "signature_statuses",
    label: "Estados de firma",
    category: "Firmas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "code", label: "Codigo", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["code", "name"]
  },
  {
    table: "signature_request_statuses",
    label: "Estados de solicitud",
    category: "Firmas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "code", label: "Codigo", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["code", "name"]
  },
  {
    table: "signature_flow_templates",
    label: "Plantillas de flujo",
    category: "Firmas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_definition_id", label: "Definicion proceso", type: "number", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name"]
  },
  {
    table: "signature_flow_steps",
    label: "Pasos de firma",
    category: "Firmas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "template_id", label: "Plantilla", type: "number", required: true },
      { name: "step_order", label: "Orden", type: "number", required: true },
      { name: "step_type_id", label: "Tipo", type: "number", required: true },
      { name: "required_cargo_id", label: "Cargo", type: "number", required: true },
      {
        name: "selection_mode",
        label: "Seleccion",
        type: "select",
        options: ["auto_all", "select", "auto_quorum"],
        defaultValue: "auto_all"
      },
      { name: "required_signers_min", label: "Min firmantes", type: "number" },
      { name: "required_signers_max", label: "Max firmantes", type: "number" },
      { name: "is_required", label: "Obligatorio", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: []
  },
  {
    table: "signature_flow_instances",
    label: "Instancias de flujo",
    category: "Firmas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "template_id", label: "Plantilla", type: "number", required: true },
      { name: "document_version_id", label: "Version documento", type: "number", required: true },
      { name: "status_id", label: "Estado", type: "number", required: true },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: []
  },
  {
    table: "signature_requests",
    label: "Solicitudes de firma",
    category: "Firmas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "instance_id", label: "Instancia", type: "number", required: true },
      { name: "step_id", label: "Paso", type: "number", required: true },
      { name: "assigned_person_id", label: "Persona", type: "number" },
      { name: "status_id", label: "Estado", type: "number", required: true },
      { name: "is_manual", label: "Manual", type: "boolean", defaultValue: 0 },
      { name: "requested_at", label: "Solicitado", type: "datetime", readOnly: true },
      { name: "notified_at", label: "Notificado", type: "datetime" },
      { name: "responded_at", label: "Respondido", type: "datetime" }
    ],
    searchFields: []
  },
  {
    table: "vacancies",
    label: "Vacantes",
    category: "Contratos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "position_id", label: "Puesto", type: "number", required: true },
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
        options: ["dependencia", "servicios", "promocion"],
        required: true
      },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["abierta", "cubierta", "cerrada", "cancelada"],
        defaultValue: "abierta"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["title", "category", "status"]
  },
  {
    table: "vacancy_visibility",
    label: "Visibilidad de vacante",
    category: "Contratos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "vacancy_id", label: "Vacante", type: "number", required: true },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "role_id", label: "Rol", type: "number" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: []
  },
  {
    table: "contracts",
    label: "Contratos",
    category: "Contratos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "person_id", label: "Persona", type: "number", required: true },
      { name: "position_id", label: "Puesto", type: "number", required: true },
      {
        name: "relation_type",
        label: "Relacion",
        type: "select",
        options: ["dependencia", "servicios", "promocion"],
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
        options: ["activo", "finalizado", "cancelado"],
        defaultValue: "activo"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["status"]
  },
  
];

export const SQL_TABLE_MAP = Object.fromEntries(SQL_TABLES.map((table) => [table.table, table]));
