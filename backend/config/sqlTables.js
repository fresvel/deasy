import {
  DOCUMENT_STATUSES,
  DOCUMENT_VERSION_STATUSES,
} from "../services/documents/DocumentStateService.js";

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
      { name: "active_definition_status", label: "Estado definicion", type: "text", readOnly: true, virtual: true },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name", "slug"]
  },
  {
    table: "process_definition_versions",
    label: "Definicion de procesos",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_id", label: "Proceso", type: "number", required: true },
      { name: "series_id", label: "Serie", type: "number", required: true },
      { name: "variation_key", label: "Codigo de serie", type: "text", readOnly: true, defaultValue: "general" },
      { name: "definition_version", label: "Version", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "has_document", label: "Tiene documento", type: "boolean", defaultValue: 1 },
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
    table: "process_definition_series",
    label: "Variantes de procesos definidos",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      {
        name: "source_type",
        label: "Origen de serie",
        type: "select",
        options: ["unit_type", "cargo"],
        defaultValue: "",
        required: true
      },
      { name: "unit_type_id", label: "Tipo de unidad", type: "number" },
      { name: "cargo_id", label: "Cargo", type: "number" },
      { name: "code", label: "Codigo", type: "text", readOnly: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["code", "source_type"]
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
    table: "process_definition_triggers",
    label: "Disparadores de definiciones",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_definition_id", label: "Definicion", type: "number", required: true },
      {
        name: "trigger_mode",
        label: "Modo de disparo",
        type: "select",
        options: ["automatic_by_term_type", "manual_only", "manual_custom_term"],
        required: true
      },
      { name: "term_type_id", label: "Tipo de periodo", type: "number" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["trigger_mode"]
  },
  {
    table: "process_runs",
    label: "Corridas de proceso",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_definition_id", label: "Definicion de proceso", type: "number", required: true },
      { name: "term_id", label: "Periodo", type: "number" },
      {
        name: "run_mode",
        label: "Modo de corrida",
        type: "select",
        options: ["automatic_term", "manual", "reinstanced", "repair"],
        defaultValue: "manual"
      },
      { name: "source_run_id", label: "Corrida origen", type: "number" },
      { name: "created_by_user_id", label: "Creada por", type: "number" },
      { name: "reason", label: "Motivo", type: "textarea" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["pending", "active", "completed", "cancelled"],
        defaultValue: "active"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
    ],
    searchFields: ["run_mode", "status", "reason"]
  },
  {
    table: "tasks",
    label: "Tareas",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      {
        name: "process_definition_id",
        label: "Definicion de proceso",
        type: "number",
        required: true
      },
      { name: "process_run_id", label: "Corrida de proceso", type: "number" },
      { name: "term_id", label: "Periodo", type: "number", required: true },
      {
        name: "launch_mode",
        label: "Modo de lanzamiento",
        type: "select",
        options: ["automatic", "manual"],
        defaultValue: "manual"
      },
      { name: "created_by_user_id", label: "Creada por", type: "number" },
      { name: "parent_task_id", label: "Tarea padre (manual)", type: "number" },
      { name: "responsible_position_id", label: "Puesto responsable", type: "number" },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "comments_thread_ref", label: "Comentarios (Mongo)", type: "text" },
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
    table: "task_items",
    label: "Items de tareas",
    category: "Procesos",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "task_id", label: "Tarea", type: "number", required: true },
      {
        name: "process_definition_template_id",
        label: "Plantilla de proceso definido",
        type: "number",
        required: true
      },
      { name: "template_artifact_id", label: "Paquete", type: "number", required: true },
      {
        name: "template_usage_role",
        label: "Rol",
        type: "select",
        options: ["primary", "attachment", "support"],
        defaultValue: "primary"
      },
      { name: "sort_order", label: "Orden", type: "number", defaultValue: 1 },
      { name: "responsible_position_id", label: "Puesto responsable", type: "number" },
      { name: "assigned_person_id", label: "Responsable", type: "number" },
      { name: "start_date", label: "Inicio entregable", type: "date", required: true },
      { name: "end_date", label: "Vencimiento entregable", type: "date" },
      { name: "user_started_at", label: "Inicio usuario", type: "datetime", readOnly: true },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["pendiente", "en_proceso", "completada", "cancelada"],
        defaultValue: "pendiente"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["template_usage_role", "status"]
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
    table: "template_seeds",
    label: "Seeds de plantilla",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "seed_code", label: "Codigo", type: "text", required: true },
      { name: "display_name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "seed_type", label: "Tipo", type: "text", required: true },
      { name: "source_path", label: "Ruta fuente", type: "text", required: true },
      { name: "preview_path", label: "Ruta preview", type: "text" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["seed_code", "display_name", "seed_type"]
  },
  {
    table: "template_artifacts",
    label: "Paquetes de plantilla",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "template_seed_id", label: "Seed", type: "number", readOnly: true },
      { name: "owner_person_id", label: "Persona propietaria", type: "number", readOnly: true },
      { name: "template_code", label: "Codigo", type: "text", required: true },
      { name: "display_name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "owner_ref", label: "Propietario", type: "text" },
      { name: "source_version", label: "Version fuente", type: "text", required: true },
      { name: "storage_version", label: "Version storage", type: "text", required: true },
      {
        name: "artifact_origin",
        label: "Catalogo",
        type: "select",
        options: ["process", "general"],
        defaultValue: "process"
      },
      {
        name: "artifact_stage",
        label: "Etapa",
        type: "select",
        options: ["draft", "review", "approved", "published", "archived"],
        defaultValue: "published"
      },
      { name: "bucket", label: "Bucket", type: "text", required: true },
      { name: "base_object_prefix", label: "Prefijo base", type: "text", required: true },
      { name: "available_formats", label: "Formatos disponibles (JSON)", type: "textarea", required: true },
      { name: "schema_object_key", label: "Ruta schema", type: "text", required: true },
      { name: "meta_object_key", label: "Ruta meta", type: "text", required: true },
      { name: "content_hash", label: "Hash", type: "text" },
      { name: "seed_display_name", label: "Nombre del seed", type: "text", readOnly: true, virtual: true },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["template_code", "display_name", "storage_version", "owner_ref", "artifact_origin", "artifact_stage"]
  },
  {
    table: "process_definition_templates",
    label: "Plantillas de procesos definidos",
    category: "Plantillas",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "process_definition_id", label: "Definicion", type: "number", required: true },
      { name: "template_artifact_id", label: "Paquete", type: "number", required: true },
      {
        name: "usage_role",
        label: "Rol",
        type: "select",
        options: ["primary", "attachment", "support"],
        defaultValue: "primary"
      },
      { name: "creates_task", label: "Genera tarea", type: "boolean", defaultValue: 1 },
      { name: "is_required", label: "Requerido", type: "boolean", defaultValue: 1 },
      { name: "sort_order", label: "Orden", type: "number", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["usage_role"]
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
      { name: "code", label: "Codigo", type: "text", required: true },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 }
    ],
    searchFields: ["code", "name"]
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
      { name: "task_item_id", label: "Item de tarea", type: "number" },
      { name: "owner_person_id", label: "Propietario", type: "number" },
      {
        name: "origin_type",
        label: "Origen",
        type: "select",
        options: ["task_item", "standalone", "imported", "generated"],
        defaultValue: "task_item"
      },
      { name: "title", label: "Titulo", type: "text" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: [...DOCUMENT_STATUSES],
        defaultValue: "Inicial"
      },
      { name: "comments_thread_ref", label: "Comentarios (Mongo)", type: "text" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
    ],
    searchFields: ["origin_type", "title", "status"]
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
      { name: "template_artifact_id", label: "Artifact", type: "number" },
      { name: "payload_mongo_id", label: "Payload legacy", type: "text" },
      { name: "payload_hash", label: "Hash payload", type: "text" },
      { name: "payload_object_path", label: "Ruta payload", type: "text" },
      { name: "working_file_path", label: "Ruta working", type: "text" },
      { name: "final_file_path", label: "Ruta final", type: "text" },
      { name: "format", label: "Formato", type: "text" },
      { name: "render_engine", label: "Motor de render", type: "text" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: [...DOCUMENT_VERSION_STATUSES],
        defaultValue: "Borrador"
      },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["payload_mongo_id", "payload_hash", "payload_object_path", "format", "render_engine", "status"]
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
    table: "fill_flow_templates",
    label: "Plantillas de llenado",
    category: "Llenado",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      {
        name: "process_definition_template_id",
        label: "Plantilla de proceso definido",
        type: "number",
        required: true
      },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "description", label: "Descripcion", type: "textarea" },
      { name: "is_active", label: "Activo", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["name"]
  },
  {
    table: "fill_flow_steps",
    label: "Pasos de llenado",
    category: "Llenado",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "fill_flow_template_id", label: "Plantilla de llenado", type: "number", required: true },
      { name: "step_order", label: "Orden", type: "number", required: true },
      {
        name: "resolver_type",
        label: "Resolver",
        type: "select",
        options: ["task_assignee", "document_owner", "specific_person", "position", "cargo_in_scope", "manual_pick"],
        defaultValue: "task_assignee"
      },
      { name: "assigned_person_id", label: "Persona fija", type: "number" },
      {
        name: "unit_scope_type",
        label: "Alcance de unidad",
        type: "select",
        options: ["unit_exact", "unit_subtree", "unit_type", "all_units"],
        defaultValue: "unit_exact"
      },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "unit_type_id", label: "Tipo de unidad", type: "number" },
      { name: "cargo_id", label: "Cargo", type: "number" },
      { name: "position_id", label: "Puesto", type: "number" },
      {
        name: "selection_mode",
        label: "Seleccion",
        type: "select",
        options: ["auto_one", "auto_all", "manual"],
        defaultValue: "auto_one"
      },
      { name: "is_required", label: "Obligatorio", type: "boolean", defaultValue: 1 },
      { name: "can_reject", label: "Puede rechazar", type: "boolean", defaultValue: 1 },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true }
    ],
    searchFields: ["resolver_type", "selection_mode"]
  },
  {
    table: "document_fill_flows",
    label: "Instancias de llenado",
    category: "Llenado",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "fill_flow_template_id", label: "Plantilla de llenado", type: "number", required: true },
      { name: "document_version_id", label: "Version documento", type: "number", required: true },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["pending", "in_progress", "approved", "rejected", "cancelled"],
        defaultValue: "pending"
      },
      { name: "current_step_order", label: "Paso actual", type: "number" },
      { name: "created_at", label: "Creado", type: "datetime", readOnly: true },
      { name: "updated_at", label: "Actualizado", type: "datetime", readOnly: true }
    ],
    searchFields: ["status"]
  },
  {
    table: "fill_requests",
    label: "Solicitudes de llenado",
    category: "Llenado",
    primaryKeys: ["id"],
    fields: [
      { name: "id", label: "ID", type: "number", readOnly: true },
      { name: "document_fill_flow_id", label: "Instancia", type: "number", required: true },
      { name: "fill_flow_step_id", label: "Paso", type: "number", required: true },
      { name: "assigned_person_id", label: "Persona", type: "number" },
      {
        name: "status",
        label: "Estado",
        type: "select",
        options: ["pending", "in_progress", "approved", "rejected", "returned", "cancelled"],
        defaultValue: "pending"
      },
      { name: "is_manual", label: "Manual", type: "boolean", defaultValue: 0 },
      { name: "requested_at", label: "Solicitado", type: "datetime", readOnly: true },
      { name: "responded_at", label: "Respondido", type: "datetime" },
      { name: "response_note", label: "Respuesta", type: "textarea" }
    ],
    searchFields: ["status"]
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
      {
        name: "process_definition_template_id",
        label: "Plantilla de proceso definido",
        type: "number",
        required: true
      },
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
      { name: "code", label: "Código", type: "text" },
      { name: "name", label: "Nombre", type: "text" },
      { name: "slot", label: "Slot", type: "text" },
      { name: "step_type_id", label: "Tipo", type: "number", required: true },
      {
        name: "resolver_type",
        label: "Resolver",
        type: "select",
        options: ["task_assignee", "document_owner", "specific_person", "position", "cargo_in_scope", "manual_pick"],
        defaultValue: "cargo_in_scope"
      },
      { name: "assigned_person_id", label: "Persona asignada", type: "number" },
      {
        name: "unit_scope_type",
        label: "Alcance unidad",
        type: "select",
        options: ["unit_exact", "unit_subtree", "unit_type", "all_units", "context_exact", "context_subtree", "context_ancestor_type"],
        defaultValue: "context_exact"
      },
      { name: "unit_id", label: "Unidad", type: "number" },
      { name: "unit_type_id", label: "Tipo de unidad", type: "number" },
      { name: "position_id", label: "Puesto", type: "number" },
      { name: "required_cargo_id", label: "Cargo", type: "number" },
      {
        name: "selection_mode",
        label: "Seleccion",
        type: "select",
        options: ["auto_one", "auto_all", "manual"],
        defaultValue: "auto_all"
      },
      {
        name: "approval_mode",
        label: "Resolucion",
        type: "select",
        options: ["and", "or", "at_least"],
        defaultValue: "and"
      },
      { name: "required_signers_min", label: "Min firmantes", type: "number" },
      { name: "required_signers_max", label: "Max firmantes", type: "number" },
      { name: "is_required", label: "Obligatorio", type: "boolean", defaultValue: 1 },
      {
        name: "anchor_refs",
        label: "Anchor refs",
        type: "textarea",
        description: "JSON array de códigos de anchor enlazados al paso"
      },
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
