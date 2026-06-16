import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcrypt";
import mongoose from "mongoose";
import mysql from "mysql2/promise";

import { Dossier } from "../models/users/dossiers.js";
import { Usuario } from "../models/users/usuario_model.js";
import {
  ACTION_CATALOG,
  RESOURCE_CATALOG,
  ROLE_CATALOG,
  ROLE_PERMISSION_MATRIX
} from "../config/rbacCatalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

const DEMO_PASSWORD = process.env.DEASY_DEMO_PASSWORD || "Deasy1234!";
const DEMO_UNIT_SLUG = "deasy-qa-demo";
const DEMO_PROCESS_SLUG = "flujo-demo-cuenta";
const DEMO_TERM_NAME = "QA Demo 2026";

const demoUsers = [
  {
    cedula: "0999900001",
    email: "admin.demo@deasy.local",
    first_name: "AdminSistema",
    last_name: "Demo",
    role: "AdminSistema",
    cargo: { code: "DEMO-ADMIN", name: "Administrador demo" },
    token: "DMADMIN001",
    whatsapp: "0999900001"
  },
  {
    cedula: "0999900002",
    email: "gestor.demo@deasy.local",
    first_name: "GestorProcesos",
    last_name: "Demo",
    role: "GestorProcesos",
    cargo: { code: "DEMO-GESTOR-PROCESOS", name: "Gestion de procesos demo" },
    token: "DMGESTR001",
    whatsapp: "0999900002"
  },
  {
    cedula: "0999900003",
    email: "auditor.demo@deasy.local",
    first_name: "Auditor",
    last_name: "Demo",
    role: "Auditor",
    cargo: { code: "DEMO-AUDITOR", name: "Auditor demo" },
    token: "DMAUDIT001",
    whatsapp: "0999900003"
  },
  {
    cedula: "0999900004",
    email: "usuario.demo@deasy.local",
    first_name: "Usuario",
    last_name: "Demo",
    role: "Usuario",
    cargo: { code: "DEMO-USUARIO", name: "Usuario demo" },
    token: "DMUSER001",
    whatsapp: "0999900004"
  }
];

const loadEnvFile = async () => {
  const envPath = path.join(backendRoot, ".env");
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").trim();
    });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`No se pudo leer ${envPath}: ${error.message}`);
    }
  }
};

const requireEnv = (keys) => {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }
};

const createMariaDbConnection = async () => {
  requireEnv(["MARIADB_HOST", "MARIADB_PORT", "MARIADB_USER", "MARIADB_PASSWORD", "MARIADB_DATABASE"]);
  return mysql.createConnection({
    host: process.env.MARIADB_HOST,
    port: Number(process.env.MARIADB_PORT),
    user: process.env.MARIADB_USER,
    password: process.env.MARIADB_PASSWORD,
    database: process.env.MARIADB_DATABASE,
    timezone: process.env.MARIADB_TIMEZONE || "Z"
  });
};

const fetchOne = async (connection, sql, params = []) => {
  const [rows] = await connection.query(sql, params);
  return rows[0] || null;
};

const getRequiredId = async (connection, sql, params = [], label = "registro") => {
  const row = await fetchOne(connection, sql, params);
  if (!row?.id) throw new Error(`No se pudo resolver ${label}.`);
  return Number(row.id);
};

const upsertByUnique = async (connection, table, payload, updateKeys = []) => {
  const columns = Object.keys(payload);
  const placeholders = columns.map(() => "?").join(", ");
  const updates = [
    "id = LAST_INSERT_ID(id)",
    ...updateKeys.map((key) => `\`${key}\` = VALUES(\`${key}\`)`)
  ].join(", ");
  const values = columns.map((key) => payload[key]);
  const [result] = await connection.query(
    `INSERT INTO \`${table}\` (${columns.map((key) => `\`${key}\``).join(", ")})
     VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}`,
    values
  );
  if (Number(result.insertId || 0) > 0) {
    return Number(result.insertId);
  }
  const [rows] = await connection.query("SELECT LAST_INSERT_ID() AS id");
  return Number(rows?.[0]?.id || 0);
};

const getOrCreateUnitType = async (connection) => {
  const existing = await fetchOne(connection, "SELECT id FROM unit_types WHERE name = ? LIMIT 1", ["Demo QA"]);
  if (existing) return Number(existing.id);
  const [result] = await connection.query(
    "INSERT INTO unit_types (name, is_active) VALUES (?, 1)",
    ["Demo QA"]
  );
  return Number(result.insertId);
};

const getOrCreateUnit = async (connection, unitTypeId) => {
  const existing = await fetchOne(connection, "SELECT id FROM units WHERE slug = ? LIMIT 1", [DEMO_UNIT_SLUG]);
  if (existing) {
    await connection.query(
      "UPDATE units SET name = ?, label = ?, unit_type_id = ?, is_active = 1 WHERE id = ?",
      ["Unidad QA Demo", "QA Demo", unitTypeId, existing.id]
    );
    return Number(existing.id);
  }
  const [result] = await connection.query(
    `INSERT INTO units (name, label, slug, unit_type_id, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    ["Unidad QA Demo", "QA Demo", DEMO_UNIT_SLUG, unitTypeId]
  );
  return Number(result.insertId);
};

const getOrCreateRole = async (connection, role) => upsertByUnique(
  connection,
  "roles",
  { name: role.name, description: role.description, is_active: 1 },
  ["description", "is_active"]
);

const getOrCreateCargo = async (connection, cargo) => upsertByUnique(
  connection,
  "cargos",
  { code: cargo.code, name: cargo.name, description: `Cargo demo para ${cargo.name}.`, is_active: 1 },
  ["name", "description", "is_active"]
);

const getOrCreatePosition = async (connection, { unitId, cargoId, title }) => upsertByUnique(
  connection,
  "unit_positions",
  {
    unit_id: unitId,
    slot_no: 1,
    title,
    profile_ref: "demo",
    position_type: "real",
    is_active: 1,
    cargo_id: cargoId
  },
  ["title", "profile_ref", "position_type", "is_active"]
);

const upsertPositionAssignment = async (connection, { positionId, personId }) => upsertByUnique(
  connection,
  "position_assignments",
  {
    position_id: positionId,
    person_id: personId,
    start_date: "2026-01-01",
    end_date: null,
    is_current: 1
  },
  ["person_id", "start_date", "end_date", "is_current"]
);

const upsertResource = async (connection, resource) => upsertByUnique(
  connection,
  "resources",
  { ...resource, is_active: 1 },
  ["name", "description", "is_active"]
);

const upsertAction = async (connection, action) => upsertByUnique(
  connection,
  "actions",
  { ...action, is_active: 1 },
  ["name", "description", "is_active"]
);

const upsertPermission = async (connection, { resourceId, actionId, code, description }) => upsertByUnique(
  connection,
  "permissions",
  { resource_id: resourceId, action_id: actionId, code, description, is_active: 1 },
  ["code", "description", "is_active"]
);

const seedPermissions = async (connection, roleIds) => {
  const resourceIds = new Map();
  const actionIds = new Map();
  const permissionIds = new Map();

  for (const resource of RESOURCE_CATALOG) {
    resourceIds.set(resource.code, await upsertResource(connection, resource));
  }
  for (const action of ACTION_CATALOG) {
    actionIds.set(action.code, await upsertAction(connection, action));
  }

  for (const resource of RESOURCE_CATALOG) {
    for (const action of ACTION_CATALOG) {
      const permissionId = await upsertPermission(connection, {
        resourceId: resourceIds.get(resource.code),
        actionId: actionIds.get(action.code),
        code: `${resource.code}.${action.code}`,
        description: `${action.name} ${resource.name}`.trim()
      });
      permissionIds.set(`${resource.code}.${action.code}`, permissionId);
    }
  }

  for (const [roleName, resourceMap] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    await connection.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);
    for (const [resourceCode, actionCodes] of Object.entries(resourceMap)) {
      for (const actionCode of actionCodes) {
        const permissionId = permissionIds.get(`${resourceCode}.${actionCode}`);
        if (!permissionId) continue;
        await connection.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permissionId]
        );
      }
    }
  }
};

const upsertPerson = async (connection, user, passwordHash) => upsertByUnique(
  connection,
  "persons",
  {
    cedula: user.cedula,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    whatsapp: user.whatsapp,
    direccion: "Av. Demo y Calle QA",
    pais: "Ecuador",
    pais_residencia: "Ecuador",
    provincia_residencia: "Esmeraldas",
    ciudad_residencia: "Esmeraldas",
    calle_primaria: "Av. Demo",
    calle_secundaria: "Calle QA",
    codigo_postal: "080150",
    password_hash: passwordHash,
    status: "Activo",
    verify_email: 1,
    verify_whatsapp: 1,
    photo_url: null,
    is_active: 1,
    token: user.token
  },
  [
    "first_name",
    "last_name",
    "email",
    "whatsapp",
    "direccion",
    "pais",
    "pais_residencia",
    "provincia_residencia",
    "ciudad_residencia",
    "calle_primaria",
    "calle_secundaria",
    "codigo_postal",
    "password_hash",
    "status",
    "verify_email",
    "verify_whatsapp",
    "photo_url",
    "is_active",
    "token"
  ]
);

const ensureDemoProcess = async (connection, { cargoIds }) => {
  const processId = await upsertByUnique(
    connection,
    "processes",
    {
      name: "Flujo demo de cuenta",
      slug: DEMO_PROCESS_SLUG,
      parent_id: null,
      is_active: 1
    },
    ["name", "parent_id", "is_active"]
  );

  const seriesId = await upsertByUnique(
    connection,
    "process_definition_series",
    {
      source_type: "legacy",
      unit_type_id: null,
      cargo_id: null,
      code: "demo-account-flow",
      is_active: 1
    },
    ["source_type", "unit_type_id", "cargo_id", "is_active"]
  );

  const definitionId = await upsertByUnique(
    connection,
    "process_definition_versions",
    {
      process_id: processId,
      series_id: seriesId,
      variation_key: "general",
      definition_version: "1.0.0",
      name: "Flujo demo de cuenta",
      description: "Proceso de prueba para revisar home, documentos, llenado y firma.",
      has_document: 1,
      status: "active",
      effective_from: "2026-01-01",
      effective_to: null
    },
    ["series_id", "name", "description", "has_document", "status", "effective_from", "effective_to"]
  );

  const existingRule = await fetchOne(
    connection,
    `SELECT id FROM process_target_rules
     WHERE process_definition_id = ? AND unit_scope_type = 'all_units' AND cargo_id IS NULL
     LIMIT 1`,
    [definitionId]
  );
  if (existingRule) {
    await connection.query(
      `UPDATE process_target_rules
       SET recipient_policy = 'all_matches', priority = 1, is_active = 1, effective_from = '2026-01-01', effective_to = NULL
       WHERE id = ?`,
      [existingRule.id]
    );
  } else {
    await connection.query(
      `INSERT INTO process_target_rules
       (process_definition_id, unit_scope_type, unit_id, unit_type_id, include_descendants, cargo_id, position_id, recipient_policy, priority, is_active, effective_from, effective_to)
       VALUES (?, 'all_units', NULL, NULL, 0, NULL, NULL, 'all_matches', 1, 1, '2026-01-01', NULL)`,
      [definitionId]
    );
  }

  await upsertByUnique(
    connection,
    "process_definition_triggers",
    {
      process_definition_id: definitionId,
      trigger_mode: "manual_only",
      term_type_id: null,
      is_active: 1
    },
    ["is_active"]
  );

  const artifactId = await upsertByUnique(
    connection,
    "template_artifacts",
    {
      template_seed_id: null,
      owner_person_id: null,
      template_code: "tpl-demo-workflow-report",
      display_name: "Documento demo de flujo",
      description: "Plantilla demo para probar documentos y firmas.",
      owner_ref: "demo",
      source_version: "1.0.0",
      storage_version: "1.0.0",
      artifact_stage: "published",
      bucket: process.env.MINIO_TEMPLATES_BUCKET || "templates",
      base_object_prefix: "Seeds/demo-workflow",
      available_formats: JSON.stringify(["pdf", "docx"]),
      schema_object_key: "Seeds/demo-workflow/schema.json",
      meta_object_key: "Seeds/demo-workflow/meta.yaml",
      content_hash: "demo-workflow",
      is_active: 1
    },
    [
      "display_name",
      "description",
      "owner_ref",
      "source_version",
      "artifact_stage",
      "bucket",
      "base_object_prefix",
      "available_formats",
      "schema_object_key",
      "meta_object_key",
      "content_hash",
      "is_active"
    ]
  );

  const definitionTemplateId = await upsertByUnique(
    connection,
    "process_definition_templates",
    {
      process_definition_id: definitionId,
      template_artifact_id: artifactId,
      instance_mode: "owner_many_documents",
      creates_task: 1,
      sort_order: 1
    },
    ["instance_mode", "creates_task", "sort_order"]
  );

  for (const cargoId of cargoIds) {
    await connection.query(
      `INSERT IGNORE INTO cargo_role_map (role_id, cargo_id)
       SELECT r.id, ?
       FROM roles r
       WHERE r.name IN (?)`,
      [cargoId, ROLE_CATALOG.map((role) => role.name)]
    );
  }

  return { processId, definitionId, artifactId, definitionTemplateId };
};

const ensureTerm = async (connection) => {
  const termTypeId = await upsertByUnique(
    connection,
    "term_types",
    {
      code: "CUS",
      name: "Custom",
      description: "Periodo operativo personalizado",
      is_active: 1
    },
    ["name", "description", "is_active"]
  );
  return upsertByUnique(
    connection,
    "terms",
    {
      name: DEMO_TERM_NAME,
      term_type_id: termTypeId,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      is_active: 1
    },
    ["term_type_id", "start_date", "end_date", "is_active"]
  );
};

const getOrCreateFillFlowTemplate = async (connection, definitionTemplateId) => {
  const existingTemplate = await fetchOne(
    connection,
    "SELECT id FROM fill_flow_templates WHERE process_definition_template_id = ? AND name = ? LIMIT 1",
    [definitionTemplateId, "Llenado demo"]
  );
  let templateId = existingTemplate?.id;
  if (!templateId) {
    const [result] = await connection.query(
      `INSERT INTO fill_flow_templates (process_definition_template_id, name, description, is_active)
       VALUES (?, ?, ?, 1)`,
      [definitionTemplateId, "Llenado demo", "Paso demo de llenado del documento."]
    );
    templateId = result.insertId;
  }

  const stepId = await upsertByUnique(
    connection,
    "fill_flow_steps",
    {
      fill_flow_template_id: templateId,
      step_order: 1,
      resolver_type: "document_owner",
      assigned_person_id: null,
      unit_scope_type: "all_units",
      unit_id: null,
      unit_type_id: null,
      cargo_id: null,
      position_id: null,
      selection_mode: "auto_one",
      is_required: 1,
      can_reject: 1
    },
    ["resolver_type", "assigned_person_id", "unit_scope_type", "selection_mode", "is_required", "can_reject"]
  );

  return { templateId: Number(templateId), stepId };
};

const getOrCreateSignatureFlowTemplate = async (connection, definitionTemplateId) => {
  const signatureTypeId = await upsertByUnique(
    connection,
    "signature_types",
    {
      code: "electronica",
      name: "Electronica",
      description: "Firma electronica demo.",
      is_active: 1
    },
    ["name", "description", "is_active"]
  );
  const pendingStatusId = await upsertByUnique(
    connection,
    "signature_request_statuses",
    {
      code: "pendiente",
      name: "Pendiente",
      description: "Solicitud de firma pendiente de atencion.",
      is_active: 1
    },
    ["name", "description", "is_active"]
  );

  const existingTemplate = await fetchOne(
    connection,
    "SELECT id FROM signature_flow_templates WHERE process_definition_template_id = ? AND name = ? LIMIT 1",
    [definitionTemplateId, "Firma demo"]
  );
  let templateId = existingTemplate?.id;
  if (!templateId) {
    const [result] = await connection.query(
      `INSERT INTO signature_flow_templates (process_definition_template_id, name, description, is_active)
       VALUES (?, ?, ?, 1)`,
      [definitionTemplateId, "Firma demo", "Paso demo para firma pendiente."]
    );
    templateId = result.insertId;
  }

  const stepId = await upsertByUnique(
    connection,
    "signature_flow_steps",
    {
      template_id: templateId,
      step_order: 1,
      code: "firma-demo",
      name: "Firma demo",
      slot: "principal",
      step_type_id: signatureTypeId,
      resolver_type: "document_owner",
      assigned_person_id: null,
      unit_scope_type: "all_units",
      unit_id: null,
      unit_type_id: null,
      position_id: null,
      required_cargo_id: null,
      selection_mode: "auto_all",
      approval_mode: "and",
      required_signers_min: 1,
      required_signers_max: 1,
      is_required: 1,
      anchor_refs: JSON.stringify([])
    },
    [
      "code",
      "name",
      "slot",
      "step_type_id",
      "resolver_type",
      "assigned_person_id",
      "unit_scope_type",
      "selection_mode",
      "approval_mode",
      "required_signers_min",
      "required_signers_max",
      "is_required",
      "anchor_refs"
    ]
  );

  return { templateId: Number(templateId), stepId, pendingStatusId };
};

const seedUserWorkflow = async (connection, { user, personId, positionId, processData, termId, fillFlow, signatureFlow }) => {
  const positionRow = await fetchOne(
    connection,
    "SELECT unit_id FROM unit_positions WHERE id = ? LIMIT 1",
    [positionId]
  );
  const scopeUnitId = positionRow?.unit_id ? Number(positionRow.unit_id) : null;
  const taskId = await upsertByUnique(
    connection,
    "tasks",
    {
      process_definition_id: processData.definitionId,
      process_run_id: null,
      term_id: termId,
      created_by_user_id: personId,
      scope_unit_id: scopeUnitId,
      responsible_position_id: positionId,
      description: `Tarea demo para ${user.first_name} ${user.last_name}`,
      comments_thread_ref: null,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      status: "pendiente"
    },
    ["responsible_position_id", "description", "start_date", "end_date", "status"]
  );

  const taskItemId = await upsertByUnique(
    connection,
    "task_items",
    {
      task_id: taskId,
      process_definition_template_id: processData.definitionTemplateId,
      template_artifact_id: processData.artifactId,
      origin_kind: "process_defined",
      title: `Entregable demo para ${user.first_name} ${user.last_name}`,
      sort_order: 1,
      responsible_position_id: positionId,
      assigned_person_id: personId,
      created_by_person_id: personId,
      target_unit_id: scopeUnitId,
      target_position_id: positionId,
      target_person_id: personId,
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      user_started_at: null,
      status: "pendiente"
    },
    [
      "template_artifact_id",
      "origin_kind",
      "title",
      "sort_order",
      "responsible_position_id",
      "assigned_person_id",
      "created_by_person_id",
      "target_unit_id",
      "target_position_id",
      "target_person_id",
      "start_date",
      "end_date",
      "status"
    ]
  );

  await connection.query(
    `INSERT IGNORE INTO task_assignments (task_id, position_id, assigned_person_id, status)
     VALUES (?, ?, ?, 'pendiente')`,
    [taskId, positionId, personId]
  );

  const documentDefinitions = [
    {
      instanceNo: 1,
      title: `Ficha de informacion - ${user.role}`,
      documentStatus: "Pendiente",
      versionStatus: "Pendiente de llenado",
      workingPath: null,
      finalPath: null,
      flow: "fill"
    },
    {
      instanceNo: 2,
      title: `Solicitud de firma - ${user.role}`,
      documentStatus: "En revision",
      versionStatus: "Pendiente de firma",
      workingPath: `users/${user.cedula}/demo/solicitud-firma.pdf`,
      finalPath: `users/${user.cedula}/demo/solicitud-firma.pdf`,
      flow: "signature"
    },
    {
      instanceNo: 3,
      title: `Documento completado - ${user.role}`,
      documentStatus: "Completado",
      versionStatus: "Borrador",
      workingPath: `users/${user.cedula}/demo/documento-completado.docx`,
      finalPath: `users/${user.cedula}/demo/documento-completado.pdf`,
      flow: null
    }
  ];

  for (const definition of documentDefinitions) {
    const documentId = await upsertByUnique(
      connection,
      "documents",
      {
        task_item_id: taskItemId,
        instance_no: definition.instanceNo,
        owner_person_id: personId,
        origin_unit_id: null,
        origin_type: "task_item",
        title: definition.title,
        status: definition.documentStatus,
        comments_thread_ref: null,
        updated_at: null
      },
      ["owner_person_id", "origin_unit_id", "origin_type", "title", "status", "comments_thread_ref", "updated_at"]
    );

    const versionId = await upsertByUnique(
      connection,
      "document_versions",
      {
        document_id: documentId,
        version: 1.0,
        template_artifact_id: processData.artifactId,
        payload_mongo_id: null,
        payload_hash: null,
        payload_object_path: null,
        working_file_path: definition.workingPath,
        final_file_path: definition.finalPath,
        format: definition.finalPath?.endsWith(".pdf") ? "pdf" : "docx",
        render_engine: "demo",
        status: definition.versionStatus
      },
      [
        "template_artifact_id",
        "payload_mongo_id",
        "payload_hash",
        "payload_object_path",
        "working_file_path",
        "final_file_path",
        "format",
        "render_engine",
        "status"
      ]
    );

    if (definition.flow === "fill") {
      const fillInstanceId = await upsertByUnique(
        connection,
        "document_fill_flows",
        {
          fill_flow_template_id: fillFlow.templateId,
          document_version_id: versionId,
          status: "pending",
          current_step_order: 1
        },
        ["fill_flow_template_id", "status", "current_step_order"]
      );
      await upsertByUnique(
        connection,
        "fill_requests",
        {
          document_fill_flow_id: fillInstanceId,
          fill_flow_step_id: fillFlow.stepId,
          assigned_person_id: personId,
          status: "pending",
          is_manual: 1,
          responded_at: null,
          response_note: null
        },
        ["status", "is_manual", "responded_at", "response_note"]
      );
    }

    if (definition.flow === "signature") {
      const signatureInstanceId = await upsertByUnique(
        connection,
        "signature_flow_instances",
        {
          template_id: signatureFlow.templateId,
          document_version_id: versionId,
          status_id: signatureFlow.pendingStatusId
        },
        ["template_id", "status_id"]
      );
      await upsertByUnique(
        connection,
        "signature_requests",
        {
          instance_id: signatureInstanceId,
          step_id: signatureFlow.stepId,
          assigned_person_id: personId,
          status_id: signatureFlow.pendingStatusId,
          is_manual: 1,
          notified_at: null,
          responded_at: null
        },
        ["status_id", "is_manual", "notified_at", "responded_at"]
      );
    }
  }
};

const buildDossierPayload = (user, mongoUserId = null) => {
  const label = `${user.first_name} ${user.last_name}`;
  return {
    usuario: mongoUserId,
    cedula: user.cedula,
    titulos: [
      { titulo: `Ingenieria de Software - ${label}`, ies: "PUCESE", nivel: "Grado", sreg: `${user.cedula}-T1`, campo_amplio: "Tecnologias de la informacion", tipo: "Presencial", pais: "Ecuador", sera: "Aprobado" },
      { titulo: `Diplomado en Gestion Academica - ${label}`, ies: "PUCESE", nivel: "Diplomado", sreg: `${user.cedula}-T2`, campo_amplio: "Administracion", tipo: "Virtual", pais: "Ecuador", sera: "Revisado" },
      { titulo: `Doctorado en Educacion Superior - ${label}`, ies: "Universidad Demo", nivel: "Doctorado", sreg: `${user.cedula}-T3`, campo_amplio: "Educacion", tipo: "Semipresencial", pais: "Ecuador", sera: "Enviado" }
    ],
    experiencia: [
      { institucion: "PUCESE", fecha_inicio: new Date("2021-01-01"), fecha_fin: new Date("2022-12-31"), funcion_catedra: ["Docencia", "Tutoria"], modalidad: "Presencial", tipo: "Docencia", sera: "Aprobado" },
      { institucion: "Instituto Tecnologico Demo", fecha_inicio: new Date("2023-01-01"), fecha_fin: new Date("2024-06-30"), funcion_catedra: ["Gestion", "Coordinacion"], modalidad: "Hibrida", tipo: "Profesional", sera: "Revisado" },
      { institucion: "Centro de Investigacion QA", fecha_inicio: new Date("2024-07-01"), fecha_fin: new Date("2025-12-31"), funcion_catedra: ["Investigacion"], modalidad: "Virtual", tipo: "Profesional", sera: "Enviado" }
    ],
    referencias: [
      { nombre: "Maria Referencia", cargo_parentesco: "Directora Academica", email: `referencia1.${user.cedula}@deasy.local`, telefono: "0999911111", institution: "PUCESE", tipo: "laboral" },
      { nombre: "Carlos Referencia", cargo_parentesco: "Colega", email: `referencia2.${user.cedula}@deasy.local`, telefono: "0999922222", institution: "Instituto Demo", tipo: "personal" },
      { nombre: "Ana Referencia", cargo_parentesco: "Coordinadora", email: `referencia3.${user.cedula}@deasy.local`, telefono: "0999933333", institution: "Centro QA", tipo: "laboral" }
    ],
    formacion: [
      { tema: "Diseno de procesos academicos", institution: "PUCESE", horas: 40, fecha_inicio: new Date("2024-01-10"), fecha_fin: new Date("2024-01-20"), tipo: "Docente", rol: "Asistencia", pais: "Ecuador", sera: "Aprobado" },
      { tema: "Gestion documental institucional", institution: "DEASY", horas: 24, fecha_inicio: new Date("2024-03-05"), fecha_fin: new Date("2024-03-12"), tipo: "Profesional", rol: "Instructor", pais: "Ecuador", sera: "Revisado" },
      { tema: "Indicadores de calidad", institution: "Unidad QA", horas: 32, fecha_inicio: new Date("2024-05-01"), fecha_fin: new Date("2024-05-15"), tipo: "Docente", rol: "Asistencia", pais: "Ecuador", sera: "Enviado" }
    ],
    certificaciones: [
      { titulo: "Certificacion en gestion de calidad", institution: "PUCESE", horas: 40, fecha: new Date("2024-02-01"), tipo: "Nacional", descripcion: "Certificacion nacional demo.", sera: "Aprobado" },
      { titulo: "Certificacion en analitica academica", institution: "DEASY", horas: 30, fecha: new Date("2024-04-01"), tipo: "Internacional", descripcion: "Certificacion internacional demo.", sera: "Revisado" },
      { titulo: "Certificacion en firma electronica", institution: "Unidad QA", horas: 16, fecha: new Date("2024-06-01"), tipo: "Nacional", descripcion: "Certificacion para flujo de firmas.", sera: "Enviado" }
    ],
    investigacion: {
      articulos: [
        { titulo: `Articulo demo de ${user.role}`, base_indexada: "Latindex", revista: "Revista QA", doi: `10.0000/${user.cedula}.1`, issn: "0000-0001", sjr: 0.21, fecha: new Date("2024-07-01"), pais: "Ecuador", estado: "Publicado", rol: "Autor", sera: "Aprobado" }
      ],
      libros: [
        { titulo: `Libro demo de ${user.role}`, editorial: "Editorial QA", isbn: `978-${user.cedula.slice(-4)}-000`, isnn: "0000-0002", pais: "Ecuador", tipo: "Libro", sera: "Revisado" }
      ],
      ponencias: [
        { titulo: `Ponencia demo de ${user.role}`, evento: "Congreso QA DEASY", pais: "Ecuador", sera: "Enviado" }
      ],
      tesis: [],
      proyectos: []
    }
  };
};

const seedMongoAccount = async (user, passwordHash) => {
  const mongoUser = await Usuario.findOneAndUpdate(
    { cedula: user.cedula },
    {
      cedula: user.cedula,
      password: passwordHash,
      nombre: user.first_name,
      apellido: user.last_name,
      email: user.email,
      correo: user.email,
      direccion: "Av. Demo y Calle QA",
      whatsapp: user.whatsapp,
      verify: { whatsapp: true, email: true },
      status: "Activo"
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  const payload = buildDossierPayload(user, mongoUser?._id || null);
  await Dossier.findOneAndUpdate(
    { cedula: user.cedula },
    payload,
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );
};

const run = async () => {
  await loadEnvFile();
  requireEnv(["URI_MONGO"]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const connection = await createMariaDbConnection();
  await mongoose.connect(process.env.URI_MONGO);

  const roleIds = new Map();
  const cargoIds = new Map();
  const positionIds = new Map();
  const personIds = new Map();

  try {
    await connection.beginTransaction();

    const unitTypeId = await getOrCreateUnitType(connection);
    const unitId = await getOrCreateUnit(connection, unitTypeId);

    for (const role of ROLE_CATALOG) {
      roleIds.set(role.name, await getOrCreateRole(connection, role));
    }

    await seedPermissions(connection, roleIds);

    for (const user of demoUsers) {
      const cargoId = await getOrCreateCargo(connection, user.cargo);
      cargoIds.set(user.role, cargoId);
      await connection.query(
        "INSERT IGNORE INTO cargo_role_map (role_id, cargo_id) VALUES (?, ?)",
        [roleIds.get(user.role), cargoId]
      );
      const positionId = await getOrCreatePosition(connection, {
        unitId,
        cargoId,
        title: user.cargo.name
      });
      positionIds.set(user.role, positionId);
      const personId = await upsertPerson(connection, user, passwordHash);
      personIds.set(user.role, personId);
      await upsertPositionAssignment(connection, { positionId, personId });
      await connection.query(
        `DELETE FROM role_assignments
         WHERE source = 'manual'
           AND person_id = ?
           AND role_id = ?
           AND unit_id = ?`,
        [personId, roleIds.get(user.role), unitId]
      );
    }

    const processData = await ensureDemoProcess(connection, { cargoIds: Array.from(cargoIds.values()) });
    const termId = await ensureTerm(connection);
    const fillFlow = await getOrCreateFillFlowTemplate(connection, processData.definitionTemplateId);
    const signatureFlow = await getOrCreateSignatureFlowTemplate(connection, processData.definitionTemplateId);

    for (const user of demoUsers) {
      await seedUserWorkflow(connection, {
        user,
        personId: personIds.get(user.role),
        positionId: positionIds.get(user.role),
        processData,
        termId,
        fillFlow,
        signatureFlow
      });
    }

    await connection.commit();

    for (const user of demoUsers) {
      await seedMongoAccount(user, passwordHash);
    }

    console.log("Semilla demo aplicada correctamente.");
    console.log(`Password comun: ${DEMO_PASSWORD}`);
    console.table(demoUsers.map((user) => ({
      rol: user.role,
      cedula: user.cedula,
      email: user.email
    })));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Error aplicando semilla demo:", error);
  process.exit(1);
});
