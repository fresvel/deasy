import mysql from "mysql2/promise";
import fs from "fs/promises";
import {
  getMariaDBPool,
  getMariaDBDatabaseName,
  getMariaDBBaseConfig
} from "../config/mariadb.js";

const ensureDatabaseSQL = (databaseName) =>
  `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

const CREATE_USERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mongo_id CHAR(24) DEFAULT NULL,
  cedula VARCHAR(10) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  apellido VARCHAR(120) NOT NULL,
  whatsapp VARCHAR(20) DEFAULT NULL,
  direccion VARCHAR(255) DEFAULT NULL,
  pais VARCHAR(80) DEFAULT NULL,
  status ENUM('Inactivo','Activo','Verificado','Reportado') DEFAULT 'Inactivo',
  verify_email TINYINT(1) DEFAULT 0,
  verify_whatsapp TINYINT(1) DEFAULT 0,
  photo_url LONGTEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_cedula (cedula),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_mongo_id (mongo_id)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_EMAIL_VERIFICATION_CODES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT fk_email_verification_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_PASSWORD_RESET_CODES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
`;

const ADD_PHOTO_COLUMN_SQL = `
ALTER TABLE users
ADD COLUMN IF NOT EXISTS photo_url LONGTEXT DEFAULT NULL;
`;

const MODIFY_PHOTO_COLUMN_SQL = `
ALTER TABLE users
MODIFY COLUMN photo_url LONGTEXT DEFAULT NULL;
`;

const SCHEMA_FILE_URL = new URL("./mariadb_schema.sql", import.meta.url);

const splitSqlStatements = (sql) => {
  const statements = [];
  let delimiter = ";";
  let buffer = "";

  for (const rawLine of sql.split("\n")) {
    const line = rawLine;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("--")) {
      continue;
    }

    const delimiterMatch = trimmed.match(/^DELIMITER\s+(.+)$/i);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += line + "\n";

    let idx = buffer.indexOf(delimiter);
    while (idx !== -1) {
      const statement = buffer.slice(0, idx).trim();
      if (statement) {
        statements.push(statement);
      }
      buffer = buffer.slice(idx + delimiter.length);
      idx = buffer.indexOf(delimiter);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
};

export const ensureMariaDBDatabase = async () => {
  const baseConfig = getMariaDBBaseConfig();
  const databaseName = getMariaDBDatabaseName();

  if (!baseConfig.host || !databaseName) {
    console.warn("⚠️  Saltando creación de base de datos MariaDB por configuración incompleta.");
    return;
  }

  const connection = await mysql.createConnection(baseConfig);
  try {
    await connection.query(ensureDatabaseSQL(databaseName));
    console.log(`✅ Base de datos '${databaseName}' verificada/creada en MariaDB`);
  } finally {
    await connection.end();
  }
};

const DROP_TABLES = [
  "document_signatures",
  "signature_requests",
  "signature_flow_instances",
  "signature_flow_steps",
  "signature_flow_templates",
  "fill_requests",
  "document_fill_flows",
  "fill_flow_steps",
  "fill_flow_templates",
  "signature_types",
  "signature_statuses",
  "signature_request_statuses",
  "document_versions",
  "documents",
  "task_items",
  "process_definition_templates",
  "template_artifacts",
  "template_seeds",
  "task_assignments",
  "tasks",
  "process_runs",
  "terms",
  "term_types",
  "process_definition_triggers",
  "process_target_rules",
  "process_definition_versions",
  "process_definition_series",
  "processes",
  "contract_origin_recruitment",
  "contract_origin_renewal",
  "contract_origins",
  "offers",
  "aplications",
  "contracts",
  "vacancy_visibility",
  "vacancies",
  "position_assignments",
  "unit_positions",
  "person_certificates",
  "cargo_role_map",
  "role_assignment_relation_types",
  "role_assignments",
  "role_permissions",
  "permissions",
  "actions",
  "resources",
  "roles",
  "cargos",
  "unit_relations",
  "relation_unit_types",
  "units",
  "unit_types",
  "persons"
];

export const ensureMariaDBSchema = async ({ reset = false } = {}) => {
  const pool = getMariaDBPool();

  if (!pool) {
    console.warn("⚠️  Saltando inicialización MariaDB: no hay conexión configurada.");
    return;
  }

  const connection = await pool.getConnection();
  try {
    // 1. Tablas legacy de autenticación (no dependen del schema principal)
    await connection.query(CREATE_USERS_TABLE_SQL);
    await connection.query(CREATE_EMAIL_VERIFICATION_CODES_TABLE_SQL);
    await connection.query(ADD_PHOTO_COLUMN_SQL);
    await connection.query(MODIFY_PHOTO_COLUMN_SQL);
    await connection.query(CREATE_PASSWORD_RESET_CODES_TABLE_SQL);
    console.log("✅ Tabla 'users' verificada/creada en MariaDB");
    console.log("✅ Tabla 'email_verification_codes' verificada/creada");
    console.log("✅ Tabla 'password_reset_codes' verificada/creada");

    // 2. Schema principal — esto crea processes, persons, templates, etc.
    const schemaSQL = await fs.readFile(SCHEMA_FILE_URL, "utf8");
    const statements = splitSqlStatements(schemaSQL);
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log("✅ Schema principal aplicado desde mariadb_schema.sql");

    // 3. Migraciones sobre tablas del schema (ahora sí existen)
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions'`
    );
    const columnNames = columns.map((col) => col.COLUMN_NAME);
    if (columnNames.includes("version_num") && !columnNames.includes("version")) {
      await connection.query(
        "ALTER TABLE document_versions CHANGE COLUMN version_num version INT NOT NULL"
      );
      console.log("✅ document_versions.version_num renombrada a version");
    }
    if (columnNames.includes("version")) {
      await connection.query(
        "ALTER TABLE document_versions MODIFY COLUMN version DECIMAL(4,1) NOT NULL DEFAULT 0.1"
      );
    }
    if (columnNames.includes("payload_mongo_id")) {
      await connection.query("ALTER TABLE document_versions MODIFY COLUMN payload_mongo_id VARCHAR(180) NULL");
    }
    if (columnNames.includes("payload_hash")) {
      await connection.query("ALTER TABLE document_versions MODIFY COLUMN payload_hash VARCHAR(64) NULL");
    }
    if (!columnNames.includes("template_artifact_id")) {
      await connection.query("ALTER TABLE document_versions ADD COLUMN template_artifact_id INT NULL AFTER version");
    }
    if (!columnNames.includes("payload_object_path")) {
      await connection.query("ALTER TABLE document_versions ADD COLUMN payload_object_path VARCHAR(255) NULL AFTER payload_hash");
    }
    if (!columnNames.includes("working_file_path")) {
      const anchorColumn = columnNames.includes("signed_pdf_path") ? "signed_pdf_path" : "payload_object_path";
      await connection.query(`ALTER TABLE document_versions ADD COLUMN working_file_path VARCHAR(255) NULL AFTER ${anchorColumn}`);
    }
    if (!columnNames.includes("final_file_path")) {
      await connection.query("ALTER TABLE document_versions ADD COLUMN final_file_path VARCHAR(255) NULL AFTER working_file_path");
    }
    if (!columnNames.includes("format")) {
      await connection.query("ALTER TABLE document_versions ADD COLUMN format VARCHAR(40) NULL AFTER final_file_path");
    }
    if (!columnNames.includes("render_engine")) {
      await connection.query("ALTER TABLE document_versions ADD COLUMN render_engine VARCHAR(80) NULL AFTER format");
    }
    await connection.query(
      `UPDATE document_versions
       SET
         working_file_path = CASE
           WHEN working_file_path LIKE 'documents/%' OR working_file_path LIKE 'users/%' THEN NULL
           ELSE working_file_path
         END,
         final_file_path = CASE
           WHEN final_file_path LIKE 'documents/%' OR final_file_path LIKE 'users/%' THEN NULL
           ELSE final_file_path
         END,
         payload_object_path = CASE
           WHEN payload_object_path LIKE 'documents/%' OR payload_object_path LIKE 'users/%' THEN NULL
           ELSE payload_object_path
         END`
    );

    try {
      await connection.query(
        "ALTER TABLE document_versions ADD INDEX idx_document_versions_artifact (template_artifact_id)"
      );
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de document_versions.template_artifact_id:", error.message);
      }
    }

    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions'
           AND COLUMN_NAME = 'template_artifact_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length) {
        await connection.query(
          "ALTER TABLE document_versions ADD CONSTRAINT fk_document_versions_artifact FOREIGN KEY (template_artifact_id) REFERENCES template_artifacts(id)"
        );
      }
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de document_versions.template_artifact_id:", error.message);
    }

    const [documentColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents'`
    );
    const documentColumnNames = documentColumns.map((col) => col.COLUMN_NAME);
    if (!documentColumnNames.includes("owner_person_id")) {
      await connection.query("ALTER TABLE documents ADD COLUMN owner_person_id INT NULL AFTER task_item_id");
    }
    if (!documentColumnNames.includes("origin_unit_id")) {
      await connection.query("ALTER TABLE documents ADD COLUMN origin_unit_id INT NULL AFTER owner_person_id");
    }
    if (!documentColumnNames.includes("origin_type")) {
      await connection.query(
        "ALTER TABLE documents ADD COLUMN origin_type ENUM('task_item', 'standalone', 'imported', 'generated') NOT NULL DEFAULT 'task_item' AFTER origin_unit_id"
      );
    }
    if (!documentColumnNames.includes("title")) {
      await connection.query("ALTER TABLE documents ADD COLUMN title VARCHAR(180) NULL AFTER origin_type");
    }
    try {
      await connection.query("ALTER TABLE documents MODIFY COLUMN task_item_id INT NULL");
    } catch (error) {
      console.warn("⚠️  No se pudo ajustar documents.task_item_id a nullable:", error.message);
    }
    try {
      await connection.query("ALTER TABLE documents ADD INDEX idx_documents_owner_person (owner_person_id)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de documents.owner_person_id:", error.message);
      }
    }
    try {
      await connection.query("ALTER TABLE documents ADD INDEX idx_documents_origin_unit (origin_unit_id)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de documents.origin_unit_id:", error.message);
      }
    }
    try {
      await connection.query("ALTER TABLE documents ADD INDEX idx_documents_origin_type (origin_type)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de documents.origin_type:", error.message);
      }
    }

    const [cargoColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cargos'`
    );
    const cargoColumnNames = cargoColumns.map((col) => col.COLUMN_NAME);
    if (!cargoColumnNames.includes("code")) {
      await connection.query("ALTER TABLE cargos ADD COLUMN code VARCHAR(120) NULL AFTER id");
    }
    const [cargoRows] = await connection.query(
      `SELECT id, name, code
       FROM cargos
       ORDER BY id ASC`
    );
    for (const cargo of cargoRows) {
      const currentCode = String(cargo.code || "").trim();
      if (currentCode) {
        continue;
      }
      const normalizedCode = String(cargo.name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
      await connection.query(
        "UPDATE cargos SET code = ? WHERE id = ?",
        [normalizedCode || `cargo-${cargo.id}`, cargo.id]
      );
    }
    try {
      await connection.query("ALTER TABLE cargos MODIFY COLUMN code VARCHAR(120) NOT NULL");
    } catch (error) {
      console.warn("⚠️  No se pudo ajustar cargos.code a NOT NULL:", error.message);
    }
    try {
      await connection.query("ALTER TABLE cargos ADD UNIQUE KEY uq_cargos_code (code)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice único de cargos.code:", error.message);
      }
    }
    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents'
           AND COLUMN_NAME = 'owner_person_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length) {
        await connection.query(
          "ALTER TABLE documents ADD CONSTRAINT fk_documents_owner_person FOREIGN KEY (owner_person_id) REFERENCES persons(id)"
        );
      }
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de documents.owner_person_id:", error.message);
    }
    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents'
           AND COLUMN_NAME = 'origin_unit_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length) {
        await connection.query(
          "ALTER TABLE documents ADD CONSTRAINT fk_documents_origin_unit FOREIGN KEY (origin_unit_id) REFERENCES units(id)"
        );
      }
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de documents.origin_unit_id:", error.message);
    }
    try {
      await connection.query(
        `UPDATE documents d
         LEFT JOIN persons owner_person ON owner_person.id = d.owner_person_id
         LEFT JOIN position_assignments owner_pa
           ON owner_pa.person_id = owner_person.id
          AND owner_pa.is_current = 1
         LEFT JOIN unit_positions owner_pos ON owner_pos.id = owner_pa.position_id
         LEFT JOIN task_items ti ON ti.id = d.task_item_id
         LEFT JOIN unit_positions item_pos ON item_pos.id = ti.responsible_position_id
         LEFT JOIN tasks t ON t.id = ti.task_id
         LEFT JOIN unit_positions task_pos ON task_pos.id = t.responsible_position_id
         SET d.origin_unit_id = COALESCE(d.origin_unit_id, owner_pos.unit_id, item_pos.unit_id, task_pos.unit_id)
         WHERE d.origin_unit_id IS NULL`
      );
    } catch (error) {
      console.warn("⚠️  No se pudo backfillear documents.origin_unit_id:", error.message);
    }

    try {
      await connection.query(
        `UPDATE signature_request_statuses
         SET code = 'pendiente',
             name = 'Pendiente',
             is_active = 1
         WHERE LOWER(code) = 'pendiente'`
      );
      await connection.query(
        `UPDATE signature_request_statuses
         SET is_active = 0,
             description = 'Estado legacy fuera del estándar actual.'
         WHERE LOWER(code) = 'firmado'`
      );
      await connection.query(
        `UPDATE signature_statuses
         SET is_active = 0,
             description = 'Estado legacy fuera del estándar técnico actual.'
         WHERE LOWER(code) IN ('revisado', 'aprobado', 'elaborado', 'enviado', 'recibido', 'asistencia')`
      );
    } catch (error) {
      console.warn("⚠️  No se pudieron normalizar catálogos de firma legacy:", error.message);
    }

    const [taskColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'`
    );
    const taskColumnNames = taskColumns.map((col) => col.COLUMN_NAME);
    if (!taskColumnNames.includes("process_run_id")) {
      await connection.query("ALTER TABLE tasks ADD COLUMN process_run_id INT NULL AFTER process_definition_id");
    }
    try {
      await connection.query("ALTER TABLE tasks ADD INDEX idx_tasks_process_run (process_run_id)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de tasks.process_run_id:", error.message);
      }
    }
    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'
           AND COLUMN_NAME = 'process_run_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length) {
        await connection.query(
          "ALTER TABLE tasks ADD CONSTRAINT fk_tasks_process_run FOREIGN KEY (process_run_id) REFERENCES process_runs(id)"
        );
      }
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de tasks.process_run_id:", error.message);
    }

    try {
      await connection.query(
        `INSERT INTO process_runs (
           process_definition_id,
           term_id,
           run_mode,
           created_by_user_id,
           status
         )
         SELECT DISTINCT
           t.process_definition_id,
           t.term_id,
           CASE
             WHEN t.launch_mode = 'automatic' THEN 'automatic_term'
             ELSE 'manual'
           END,
           CASE
             WHEN t.launch_mode = 'manual' THEN t.created_by_user_id
             ELSE NULL
           END,
           'active'
         FROM tasks t
         LEFT JOIN process_runs pr
           ON pr.process_definition_id = t.process_definition_id
          AND pr.term_id <=> t.term_id
          AND pr.run_mode = CASE
            WHEN t.launch_mode = 'automatic' THEN 'automatic_term'
            ELSE 'manual'
          END
          AND (
            t.launch_mode <> 'manual'
            OR pr.created_by_user_id <=> t.created_by_user_id
          )
         WHERE t.process_run_id IS NULL
           AND pr.id IS NULL`
      );

      await connection.query(
        `UPDATE tasks t
         INNER JOIN process_runs pr
           ON pr.process_definition_id = t.process_definition_id
          AND pr.term_id <=> t.term_id
          AND pr.run_mode = CASE
            WHEN t.launch_mode = 'automatic' THEN 'automatic_term'
            ELSE 'manual'
          END
          AND (
            t.launch_mode <> 'manual'
            OR pr.created_by_user_id <=> t.created_by_user_id
          )
         SET t.process_run_id = pr.id
         WHERE t.process_run_id IS NULL`
      );
    } catch (error) {
      console.warn("⚠️  No se pudo backfillear tasks.process_run_id:", error.message);
    }

    const [taskItemColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_items'`
    );
    const taskItemColumnNames = taskItemColumns.map((col) => col.COLUMN_NAME);
    if (!taskItemColumnNames.includes("start_date")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN start_date DATE NULL AFTER assigned_person_id");
    }
    if (!taskItemColumnNames.includes("end_date")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN end_date DATE NULL AFTER start_date");
    }
    if (!taskItemColumnNames.includes("user_started_at")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN user_started_at DATETIME NULL AFTER end_date");
    }
    try {
      await connection.query("ALTER TABLE task_items ADD INDEX idx_task_items_dates (start_date, end_date)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de task_items.start_date/end_date:", error.message);
      }
    }
    try {
      await connection.query("ALTER TABLE task_items ADD INDEX idx_task_items_user_started (user_started_at)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de task_items.user_started_at:", error.message);
      }
    }
    try {
      await connection.query(
        `UPDATE task_items ti
         INNER JOIN tasks t ON t.id = ti.task_id
         SET ti.start_date = COALESCE(ti.start_date, t.start_date),
             ti.end_date = COALESCE(ti.end_date, t.end_date)
         WHERE ti.start_date IS NULL
            OR ti.end_date IS NULL`
      );
    } catch (error) {
      console.warn("⚠️  No se pudo backfillear task_items.start_date/end_date desde tasks:", error.message);
    }
    try {
      await connection.query("ALTER TABLE task_items MODIFY COLUMN start_date DATE NOT NULL");
    } catch (error) {
      console.warn("⚠️  No se pudo ajustar task_items.start_date a NOT NULL:", error.message);
    }

    try {
      await connection.query(
        `INSERT INTO documents (
           task_item_id,
           owner_person_id,
           origin_type,
           title,
           status
         )
         SELECT
           ti.id,
           ti.assigned_person_id,
           'task_item',
           COALESCE(tar.display_name, CONCAT('Documento ', ti.id)),
           'Inicial'
         FROM task_items ti
         LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
         LEFT JOIN documents d ON d.task_item_id = ti.id
         WHERE d.id IS NULL`
      );

      await connection.query(
        `INSERT INTO document_versions (
           document_id,
           version,
           template_artifact_id,
           status
         )
         SELECT
           d.id,
           0.1,
           ti.template_artifact_id,
           'Borrador'
         FROM documents d
         INNER JOIN task_items ti ON ti.id = d.task_item_id
         LEFT JOIN document_versions dv ON dv.document_id = d.id
         WHERE dv.id IS NULL`
      );

      await connection.query(
        `INSERT INTO document_fill_flows (
           fill_flow_template_id,
           document_version_id,
           status,
           current_step_order
         )
         SELECT
           fft.id,
           dv.id,
           'pending',
           MIN(ffs.step_order)
         FROM document_versions dv
         INNER JOIN documents d ON d.id = dv.document_id
         INNER JOIN task_items ti ON ti.id = d.task_item_id
         INNER JOIN fill_flow_templates fft
           ON fft.process_definition_template_id = ti.process_definition_template_id
          AND fft.is_active = 1
         LEFT JOIN fill_flow_steps ffs
           ON ffs.fill_flow_template_id = fft.id
         LEFT JOIN document_fill_flows dff
           ON dff.document_version_id = dv.id
         WHERE dff.id IS NULL
         GROUP BY fft.id, dv.id`
      );

      await connection.query(
        `INSERT INTO fill_requests (
           document_fill_flow_id,
           fill_flow_step_id,
           assigned_person_id,
           status,
           is_manual
         )
         SELECT
           dff.id,
           ffs.id,
           CASE
             WHEN ffs.resolver_type = 'specific_person' THEN ffs.assigned_person_id
             WHEN ffs.resolver_type = 'document_owner' THEN d.owner_person_id
             WHEN ffs.resolver_type = 'task_assignee' THEN COALESCE(ti.assigned_person_id, t.created_by_user_id)
             ELSE NULL
           END AS resolved_person_id,
           'pending',
           CASE
             WHEN ffs.resolver_type = 'manual_pick' THEN 1
             WHEN (
               CASE
                 WHEN ffs.resolver_type = 'specific_person' THEN ffs.assigned_person_id
                 WHEN ffs.resolver_type = 'document_owner' THEN d.owner_person_id
                 WHEN ffs.resolver_type = 'task_assignee' THEN COALESCE(ti.assigned_person_id, t.created_by_user_id)
                 ELSE NULL
               END
             ) IS NULL THEN 1
             ELSE 0
           END AS is_manual
         FROM document_fill_flows dff
         INNER JOIN document_versions dv ON dv.id = dff.document_version_id
         INNER JOIN documents d ON d.id = dv.document_id
         LEFT JOIN task_items ti ON ti.id = d.task_item_id
         LEFT JOIN tasks t ON t.id = ti.task_id
         INNER JOIN fill_flow_steps ffs
           ON ffs.fill_flow_template_id = dff.fill_flow_template_id
         LEFT JOIN fill_requests fr_same_step
           ON fr_same_step.document_fill_flow_id = dff.id
          AND fr_same_step.fill_flow_step_id = ffs.id
         LEFT JOIN fill_requests fr_same_assignee
           ON fr_same_assignee.document_fill_flow_id = dff.id
          AND fr_same_assignee.fill_flow_step_id = ffs.id
          AND fr_same_assignee.assigned_person_id <=> (
            CASE
              WHEN ffs.resolver_type = 'specific_person' THEN ffs.assigned_person_id
              WHEN ffs.resolver_type = 'document_owner' THEN d.owner_person_id
              WHEN ffs.resolver_type = 'task_assignee' THEN COALESCE(ti.assigned_person_id, t.created_by_user_id)
              ELSE NULL
            END
          )
         WHERE (
             (
               CASE
                 WHEN ffs.resolver_type = 'specific_person' THEN ffs.assigned_person_id
                 WHEN ffs.resolver_type = 'document_owner' THEN d.owner_person_id
                 WHEN ffs.resolver_type = 'task_assignee' THEN COALESCE(ti.assigned_person_id, t.created_by_user_id)
                 ELSE NULL
               END
             ) IS NULL
             AND fr_same_step.id IS NULL
           )
            OR (
             (
               CASE
                 WHEN ffs.resolver_type = 'specific_person' THEN ffs.assigned_person_id
                 WHEN ffs.resolver_type = 'document_owner' THEN d.owner_person_id
                 WHEN ffs.resolver_type = 'task_assignee' THEN COALESCE(ti.assigned_person_id, t.created_by_user_id)
                 ELSE NULL
               END
             ) IS NOT NULL
             AND fr_same_assignee.id IS NULL
           )`
      );

      await connection.query(
        `DELETE fr_manual
         FROM fill_requests fr_manual
         INNER JOIN fill_requests fr_resolved
           ON fr_resolved.document_fill_flow_id = fr_manual.document_fill_flow_id
          AND fr_resolved.fill_flow_step_id = fr_manual.fill_flow_step_id
          AND fr_resolved.assigned_person_id IS NOT NULL
         WHERE fr_manual.assigned_person_id IS NULL
           AND fr_manual.is_manual = 1`
      );

      await connection.query(
        `UPDATE document_versions dv
         INNER JOIN document_fill_flows dff ON dff.document_version_id = dv.id
         SET dv.status = 'Pendiente de llenado'
         WHERE dv.status = 'Borrador'`
      );

      await connection.query(
        `UPDATE documents d
         INNER JOIN document_versions dv ON dv.document_id = d.id
         INNER JOIN document_fill_flows dff ON dff.document_version_id = dv.id
         SET d.status = 'Pendiente de llenado'
         WHERE d.status IN ('Inicial', 'Borrador')`
      );

      await connection.query(
        `UPDATE documents
         SET status = 'Observado'
         WHERE status = 'Rechazado'`
      );
      await connection.query(
        `UPDATE document_versions
         SET status = 'Observado'
         WHERE status = 'Rechazado'`
      );
      await connection.query(
        `UPDATE documents
         SET status = 'Final'
         WHERE status = 'Aprobado'`
      );
      await connection.query(
        `UPDATE document_versions
         SET status = 'Final'
         WHERE status = 'Aprobado'`
      );
    } catch (error) {
      console.warn("⚠️  No se pudo backfillear documents/document_versions/fill_flows desde task_items:", error.message);
    }

    try {
      const [legacyVersionColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions'
           AND COLUMN_NAME IN ('latex_path', 'pdf_path', 'signed_pdf_path')`
      );
      for (const column of legacyVersionColumns.map((row) => row.COLUMN_NAME)) {
        await connection.query(`ALTER TABLE document_versions DROP COLUMN ${column}`);
      }
    } catch (error) {
      console.warn("⚠️  No se pudieron eliminar columnas legacy de document_versions:", error.message);
    }

    const [processColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processes'`
    );
    const processColumnNames = processColumns.map((col) => col.COLUMN_NAME);
    if (!processColumnNames.includes("unit_id"))
      await connection.query("ALTER TABLE processes ADD COLUMN unit_id INT NULL");
    if (!processColumnNames.includes("program_id"))
      await connection.query("ALTER TABLE processes ADD COLUMN program_id INT NULL");
    if (!processColumnNames.includes("person_id"))
      await connection.query("ALTER TABLE processes ADD COLUMN person_id INT NULL");
    if (!processColumnNames.includes("term_id"))
      await connection.query("ALTER TABLE processes ADD COLUMN term_id INT NULL");

    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processes'
           AND COLUMN_NAME = 'person_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length)
        await connection.query(
          "ALTER TABLE processes ADD CONSTRAINT fk_processes_person FOREIGN KEY (person_id) REFERENCES persons(id)"
        );
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de processes.person_id:", error.message);
    }

    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processes'
           AND COLUMN_NAME = 'term_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length)
        await connection.query(
          "ALTER TABLE processes ADD CONSTRAINT fk_processes_term FOREIGN KEY (term_id) REFERENCES terms(id)"
        );
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de processes.term_id:", error.message);
    }

    try {
      await connection.query("ALTER TABLE processes DROP CONSTRAINT chk_process_unit_program");
    } catch (error) {
      if (error?.code !== "ER_CONSTRAINT_NOT_FOUND")
        console.warn("⚠️  No se pudo eliminar CHECK de processes:", error.message);
    }

    // Migración legacy: solo si la tabla 'templates' aún existe (schema viejo)
    const [legacyTables] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('templates', 'process_templates')`
    );
    const legacyTableNames = legacyTables.map((t) => t.TABLE_NAME);

    if (legacyTableNames.includes("templates")) {
      const [templateColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates'`
      );
      const templateColumnNames = templateColumns.map((col) => col.COLUMN_NAME);
      if (!templateColumnNames.includes("version"))
        await connection.query("ALTER TABLE templates ADD COLUMN version VARCHAR(10) NOT NULL DEFAULT '0.1'");
      else
        await connection.query("ALTER TABLE templates MODIFY COLUMN version VARCHAR(10) NOT NULL DEFAULT '0.1'");
    }

    if (legacyTableNames.includes("process_templates")) {
      const [processTemplateColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_templates'`
      );
      const processTemplateColumnNames = processTemplateColumns.map((col) => col.COLUMN_NAME);
      if (processTemplateColumnNames.includes("template_version_id")) {
        try {
          const [fkRows] = await connection.query(
            `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_templates'
               AND COLUMN_NAME = 'template_version_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
          );
          if (fkRows.length)
            await connection.query(`ALTER TABLE process_templates DROP FOREIGN KEY ${fkRows[0].CONSTRAINT_NAME}`);
        } catch (error) {
          console.warn("⚠️  No se pudo eliminar FK antigua de process_templates:", error.message);
        }
        try {
          await connection.query("ALTER TABLE process_templates MODIFY COLUMN template_version_id INT NULL DEFAULT NULL");
        } catch (error) {
          console.warn("⚠️  No se pudo ajustar template_version_id:", error.message);
        }
        try {
          await connection.query("ALTER TABLE process_templates DROP COLUMN template_version_id");
        } catch (error) {
          console.warn("⚠️  No se pudo eliminar template_version_id:", error.message);
        }
      }
      if (!processTemplateColumnNames.includes("template_id"))
        await connection.query("ALTER TABLE process_templates ADD COLUMN template_id INT NOT NULL");
      try {
        await connection.query("ALTER TABLE process_templates DROP PRIMARY KEY");
      } catch (error) {
        if (error?.code !== "ER_CANT_DROP_FIELD_OR_KEY")
          console.warn("⚠️  No se pudo eliminar PK antigua de process_templates:", error.message);
      }
      try {
        await connection.query("ALTER TABLE process_templates ADD PRIMARY KEY (process_id, template_id)");
      } catch (error) {
        if (error?.code !== "ER_DUP_KEYNAME")
          console.warn("⚠️  No se pudo crear PK nueva de process_templates:", error.message);
      }
      try {
        await connection.query(
          "ALTER TABLE process_templates ADD CONSTRAINT fk_process_templates_template FOREIGN KEY (template_id) REFERENCES templates(id)"
        );
      } catch (error) {
        if (error?.code !== "ER_DUP_KEYNAME")
          console.warn("⚠️  No se pudo crear FK de process_templates:", error.message);
      }
    }

    if (reset) {
      console.log("✅ Esquema MariaDB recreado desde mariadb_schema.sql");
    } else {
      console.log("✅ Esquema MariaDB verificado/actualizado sin reset");
    }
  } finally {
    connection.release();
  }
};
