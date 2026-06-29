import mysql from "mysql2/promise";
import fs from "fs/promises";
import {
  getMariaDBPool,
  getMariaDBDatabaseName,
  getMariaDBBaseConfig
} from "../config/mariadb.js";

const ensureDatabaseSQL = (databaseName) =>
  `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

// Tablas de códigos de auth ligadas a la identidad ÚNICA del sistema: persons. (La antigua tabla `users`
// con su puente Mongo quedó obsoleta; el dossier en Mongo se enlaza por cédula→persons, no por `users`.)
// Se crean DESPUÉS del schema principal porque referencian persons(id).
const CREATE_EMAIL_VERIFICATION_CODES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT fk_email_verification_person
    FOREIGN KEY (person_id)
    REFERENCES persons(id)
    ON DELETE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_PASSWORD_RESET_CODES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_person_id (person_id),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT fk_password_reset_person
    FOREIGN KEY (person_id)
    REFERENCES persons(id)
    ON DELETE CASCADE
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;
`;

// Migración idempotente para BDs existentes: re-cablea los códigos de auth desde la antigua `users` a
// `persons` y elimina la tabla legacy `users`. En instalación limpia es no-op (las tablas ya nacen con
// person_id). Helpers guardados por information_schema.
const ensureLegacyAuthCleanup = async (connection) => {
  const columnExists = async (table, column) => {
    const [rows] = await connection.query(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows.length > 0;
  };
  const tableExists = async (table) => {
    const [rows] = await connection.query(
      `SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table]
    );
    return rows.length > 0;
  };
  const dropFkIfExists = async (table, column, referenced) => {
    const [rows] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = ?`,
      [table, column, referenced]
    );
    for (const row of rows) {
      await connection.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
    }
  };
  const addPersonFkIfMissing = async (table) => {
    const [rows] = await connection.query(
      `SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'person_id' AND REFERENCED_TABLE_NAME = 'persons'`,
      [table]
    );
    if (!rows.length) {
      await connection.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT fk_${table}_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE`
      );
    }
  };

  // email_verification_codes: user_id (→users) -> person_id (→persons).
  if (await tableExists("email_verification_codes")) {
    await dropFkIfExists("email_verification_codes", "user_id", "users");
    if ((await columnExists("email_verification_codes", "user_id")) && !(await columnExists("email_verification_codes", "person_id"))) {
      // dev no tiene filas de verificación; cambiar tipo/colummna es seguro.
      await connection.query("ALTER TABLE email_verification_codes CHANGE COLUMN user_id person_id INT NOT NULL");
    } else if (await columnExists("email_verification_codes", "user_id")) {
      await connection.query("ALTER TABLE email_verification_codes DROP COLUMN user_id");
    }
    await addPersonFkIfMissing("email_verification_codes");
  }

  // password_reset_codes: ya migrada a person_id en versiones previas; soltar el FK/columna user_id legacy.
  if (await tableExists("password_reset_codes")) {
    await dropFkIfExists("password_reset_codes", "user_id", "users");
    if (await columnExists("password_reset_codes", "user_id")) {
      await connection.query("ALTER TABLE password_reset_codes DROP COLUMN user_id");
    }
    await addPersonFkIfMissing("password_reset_codes");
  }

  // Tabla legacy `users` (duplicaba persons; vacía y sin referencias vivas): se elimina.
  await connection.query("DROP TABLE IF EXISTS users");
};

// Mantiene el enum de series actualizado. Migra el centinela historico 'legacy' -> 'default' y colapsa las
// variaciones combinadas 'unit_type_cargo' -> 'unit_type' (el cargo lo aporta ahora la regla, no la serie).
const ensureProcessSeriesSourceTypes = async (connection) => {
  const [cols] = await connection.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_definition_series' AND COLUMN_NAME = 'source_type'`
  );
  const columnType = String(cols?.[0]?.COLUMN_TYPE || "");
  if (!columnType) {
    return;
  }

  const hasLegacy = columnType.includes("'legacy'");
  const hasCombined = columnType.includes("'unit_type_cargo'");
  if (!hasLegacy && !hasCombined) {
    return;
  }

  // Amplia el enum temporalmente para poder reasignar las filas existentes.
  await connection.query(
    "ALTER TABLE process_definition_series MODIFY COLUMN source_type ENUM('unit_type','cargo','unit_type_cargo','legacy','default') NOT NULL DEFAULT 'default'"
  );
  if (hasLegacy) {
    await connection.query(
      "UPDATE process_definition_series SET source_type = 'default' WHERE source_type = 'legacy'"
    );
  }
  // Combinadas -> por tipo de unidad; se descarta el cargo de la serie (lo establece la regla).
  await connection.query(
    "UPDATE process_definition_series SET source_type = 'unit_type', cargo_id = NULL WHERE source_type = 'unit_type_cargo'"
  );

  await connection.query(
    "ALTER TABLE process_definition_series MODIFY COLUMN source_type ENUM('unit_type','cargo','default') NOT NULL DEFAULT 'default'"
  );
  console.log("✅ process_definition_series.source_type actualizado");
};

const getColumnNames = async (connection, tableName) => {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return new Set(columns.map((column) => column.COLUMN_NAME));
};

const addColumnIfMissing = async (connection, tableName, columnName, definition) => {
  const columnNames = await getColumnNames(connection, tableName);
  if (!columnNames.has(columnName)) {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definition}`);
  }
};


const addIndexIgnoringDuplicate = async (connection, tableName, indexSql, label) => {
  try {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD ${indexSql}`);
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME") {
      console.warn(`⚠️  No se pudo crear ${label}:`, error.message);
    }
  }
};

const addForeignKeyIfMissing = async (connection, tableName, columnName, constraintSql, label) => {
  try {
    const [fkRows] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [tableName, columnName]
    );
    if (!fkRows.length) {
      await connection.query(`ALTER TABLE \`${tableName}\` ADD ${constraintSql}`);
    }
  } catch (error) {
    console.warn(`⚠️  No se pudo crear ${label}:`, error.message);
  }
};

// Backfill idempotente del modelo "entregable/ediciones" (Fase 1): por cada template_code sin deliverable,
// crea un `deliverables` (atributos representativos de una versión) con dueño = la línea (proceso, variación)
// que más lo enlaza (NULL si no está enlazado a ninguna config), y apunta todas sus versiones a ese deliverable.
const ensureDeliverablesBackfill = async (connection) => {
  const [columns] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template_artifacts' AND COLUMN_NAME = 'deliverable_id'`
  );
  if (!columns.length) return; // la columna aún no existe (no debería pasar: se agrega antes)
  const [tcCol] = await connection.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template_artifacts' AND COLUMN_NAME = 'template_code'`
  );
  if (!tcCol.length) return; // ya se dropeó template_code (modelo migrado): nada que backfillear.

  const [codes] = await connection.query(
    "SELECT template_code, MAX(id) AS rep_id FROM template_artifacts GROUP BY template_code"
  );
  let created = 0;
  for (const row of codes) {
    const code = row.template_code;
    const [existing] = await connection.query("SELECT id FROM deliverables WHERE code = ? LIMIT 1", [code]);
    let deliverableId = existing?.[0]?.id;
    if (!deliverableId) {
      const [repRows] = await connection.query(
        "SELECT display_name, description, template_scope, template_seed_id, owner_person_id FROM template_artifacts WHERE id = ?",
        [row.rep_id]
      );
      const rep = repRows?.[0] || {};
      const [ownerRows] = await connection.query(
        `SELECT pdv.process_id, pdv.variation_key, COUNT(*) AS n
           FROM process_definition_templates pdt
           INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
           INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
          WHERE ta.template_code = ?
          GROUP BY pdv.process_id, pdv.variation_key
          ORDER BY n DESC, pdv.process_id ASC
          LIMIT 1`,
        [code]
      );
      const owner = ownerRows?.[0] || {};
      const [ins] = await connection.query(
        `INSERT INTO deliverables
           (code, display_name, description, owner_process_id, owner_variation_key, template_scope, template_seed_id, owner_person_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          rep.display_name || code,
          rep.description || null,
          owner.process_id || null,
          owner.variation_key || null,
          rep.template_scope || "official",
          rep.template_seed_id || null,
          rep.owner_person_id || null
        ]
      );
      deliverableId = ins.insertId;
      created += 1;
    }
    await connection.query(
      "UPDATE template_artifacts SET deliverable_id = ? WHERE template_code = ? AND deliverable_id IS NULL",
      [deliverableId, code]
    );
  }
  if (created > 0) {
    console.log(`✅ deliverables backfill: ${created} entregable(s) creado(s) desde template_code`);
  }
};

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
  "document_workflow_observations",
  "document_signatures",
  "signature_requests",
  "signature_flow_instances",
  "signature_flow_steps",
  "signature_flow_templates",
  "fill_requests",
  "document_fill_flows",
  "fill_flow_steps",
  "fill_flow_templates",
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
  "process_definition_period_types",
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

const LEGACY_AUTH_TABLES = [
  "password_reset_codes",
  "email_verification_codes",
  "users"
];

export const ensureMariaDBSchema = async ({ reset = false } = {}) => {
  const pool = getMariaDBPool();

  if (!pool) {
    console.warn("⚠️  Saltando inicialización MariaDB: no hay conexión configurada.");
    return;
  }

  const connection = await pool.getConnection();
  try {
    if (reset) {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      try {
        for (const tableName of [...DROP_TABLES, ...LEGACY_AUTH_TABLES]) {
          await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        }
      } finally {
        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      }
    }

    // 1. Schema principal — crea processes, persons, templates, etc. (la identidad única es `persons`).
    const schemaSQL = await fs.readFile(SCHEMA_FILE_URL, "utf8");
    const statements = splitSqlStatements(schemaSQL);
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log("✅ Schema principal aplicado desde mariadb_schema.sql");

    // 2. Códigos de auth ligados a persons (tras el schema, porque referencian persons(id)) + limpieza legacy.
    await connection.query(CREATE_EMAIL_VERIFICATION_CODES_TABLE_SQL);
    await connection.query(CREATE_PASSWORD_RESET_CODES_TABLE_SQL);
    await ensureLegacyAuthCleanup(connection);
    console.log("✅ Códigos de auth (email/reset) alineados con persons; tabla legacy 'users' eliminada");
    await ensureProcessSeriesSourceTypes(connection);

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
    await addIndexIgnoringDuplicate(connection, "documents", "INDEX idx_documents_owner_person (owner_person_id)", "índice documents.owner_person_id");
    await addIndexIgnoringDuplicate(connection, "documents", "INDEX idx_documents_origin_unit (origin_unit_id)", "índice documents.origin_unit_id");
    await addIndexIgnoringDuplicate(connection, "documents", "INDEX idx_documents_origin_type (origin_type)", "índice documents.origin_type");
    // Un documento principal por entregable (task_item).
    await addIndexIgnoringDuplicate(connection, "documents", "UNIQUE KEY uq_documents_task_item (task_item_id)", "unique documents un-documento-por-entregable");

    // template_artifacts: ciclo de vida editorial de la versión + linaje (Fase 0 versionado de plantillas).
    // lifecycle_state separa el estado editorial (draft/published/retired) de 'is_active' (almacenamiento listo).
    await addColumnIfMissing(
      connection,
      "template_artifacts",
      "lifecycle_state",
      "lifecycle_state ENUM('draft','published','retired') NOT NULL DEFAULT 'published' AFTER template_scope"
    );
    await addColumnIfMissing(
      connection,
      "template_artifacts",
      "parent_version_id",
      "parent_version_id INT NULL AFTER content_hash"
    );
    // Backfill por única vez: lo existente activo → 'published'; lo inactivo (versiones creadas inactivas) → 'draft'.
    // Solo cuando todas las filas están aún en el default 'published' (no re-pisa estados ya gestionados).
    const [stateRows] = await connection.query(
      "SELECT COUNT(*) AS total, SUM(lifecycle_state <> 'published') AS non_published FROM template_artifacts"
    );
    if (Number(stateRows?.[0]?.total || 0) > 0 && Number(stateRows?.[0]?.non_published || 0) === 0) {
      await connection.query(
        "UPDATE template_artifacts SET lifecycle_state = IF(is_active = 1, 'published', 'draft')"
      );
      console.log("✅ template_artifacts.lifecycle_state inicializado desde is_active");
    }
    await addIndexIgnoringDuplicate(
      connection,
      "template_artifacts",
      "INDEX idx_template_artifacts_state (lifecycle_state)",
      "índice template_artifacts.lifecycle_state"
    );
    await addForeignKeyIfMissing(
      connection,
      "template_artifacts",
      "parent_version_id",
      "CONSTRAINT fk_template_artifacts_parent FOREIGN KEY (parent_version_id) REFERENCES template_artifacts(id)",
      "FK template_artifacts.parent_version_id"
    );

    // Modelo "entregable/ediciones" (Fase 1, aditivo): la tabla `deliverables` ya la crea el schema. Aquí se
    // agrega template_artifacts.deliverable_id, se hace backfill (un deliverable por template_code, con dueño =
    // la línea (proceso, variación) que más lo usa) y se enlaza. No se tocan las columnas viejas (transición).
    await addColumnIfMissing(
      connection,
      "template_artifacts",
      "deliverable_id",
      "deliverable_id INT NULL AFTER parent_version_id"
    );
    await ensureDeliverablesBackfill(connection);
    await addIndexIgnoringDuplicate(
      connection,
      "template_artifacts",
      "INDEX idx_template_artifacts_deliverable (deliverable_id)",
      "índice template_artifacts.deliverable_id"
    );
    await addForeignKeyIfMissing(
      connection,
      "template_artifacts",
      "deliverable_id",
      "CONSTRAINT fk_template_artifacts_deliverable FOREIGN KEY (deliverable_id) REFERENCES deliverables(id)",
      "FK template_artifacts.deliverable_id"
    );

    // === F2-drop (limpieza final, irreversible): elimina las columnas DUPLICADAS de template_artifacts.
    // Identidad (template_code/display_name/description), scope, seed y persona viven ahora SOLO en
    // `deliverables`. Run-once: el guard por template_code hace que tras el drop el bloque se salte para siempre.
    // Helper local (el columnExists de arriba está scoped a otra función).
    const taColumnExists = async (column) => {
      const [r] = await connection.query(
        `SELECT 1 FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template_artifacts' AND COLUMN_NAME = ? LIMIT 1`,
        [column]
      );
      return r.length > 0;
    };
    if (await taColumnExists("template_code")) {
      const indexExists = async (name) => {
        const [r] = await connection.query(
          `SELECT 1 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template_artifacts' AND INDEX_NAME = ? LIMIT 1`,
          [name]
        );
        return r.length > 0;
      };
      const fkExists = async (name) => {
        const [r] = await connection.query(
          `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'template_artifacts' AND CONSTRAINT_NAME = ? LIMIT 1`,
          [name]
        );
        return r.length > 0;
      };
      // El backfill de arriba ya garantizó deliverable_id en todas las filas → endurecer a NOT NULL.
      const [nullDeliv] = await connection.query(
        "SELECT COUNT(*) AS c FROM template_artifacts WHERE deliverable_id IS NULL"
      );
      if (Number(nullDeliv?.[0]?.c || 0) === 0) {
        try {
          await connection.query("ALTER TABLE template_artifacts MODIFY deliverable_id INT NOT NULL");
        } catch (error) {
          console.warn("⚠️  F2-drop: no se pudo poner deliverable_id NOT NULL:", error.message);
        }
      }
      // Re-basar la clave única (template_code, storage_version) → (deliverable_id, storage_version).
      try {
        if (await indexExists("uq_template_artifacts_storage")) {
          await connection.query("ALTER TABLE template_artifacts DROP INDEX uq_template_artifacts_storage");
        }
        await connection.query(
          "ALTER TABLE template_artifacts ADD UNIQUE KEY uq_template_artifacts_storage (deliverable_id, storage_version)"
        );
      } catch (error) {
        console.warn("⚠️  F2-drop: no se pudo re-basar la clave única:", error.message);
      }
      // Soltar FKs de las columnas a eliminar (deben ir antes que el DROP COLUMN).
      for (const fk of ["fk_template_artifacts_seed", "fk_template_artifacts_owner_person"]) {
        if (await fkExists(fk)) {
          try { await connection.query(`ALTER TABLE template_artifacts DROP FOREIGN KEY ${fk}`); }
          catch (error) { console.warn(`⚠️  F2-drop: no se pudo soltar ${fk}:`, error.message); }
        }
      }
      // Soltar índices secundarios de esas columnas (si quedaran tras el DROP COLUMN).
      for (const idx of ["idx_template_artifacts_seed", "idx_template_artifacts_owner_person", "idx_template_artifacts_scope"]) {
        if (await indexExists(idx)) {
          try { await connection.query(`ALTER TABLE template_artifacts DROP INDEX ${idx}`); }
          catch { /* ya no existe / se quitó con la columna */ }
        }
      }
      // Soltar las columnas duplicadas.
      for (const col of ["template_seed_id", "owner_person_id", "template_code", "display_name", "description", "template_scope"]) {
        if (await taColumnExists(col)) {
          try { await connection.query(`ALTER TABLE template_artifacts DROP COLUMN \`${col}\``); }
          catch (error) { console.warn(`⚠️  F2-drop: no se pudo soltar columna ${col}:`, error.message); }
        }
      }
      console.log("✅ F2-drop: columnas duplicadas eliminadas de template_artifacts (identidad ahora en deliverables)");
    }

    // Ancestro por tipo de relación en pasos de llenado (organigramas matriciales): NULL = 'org'.
    await addColumnIfMissing(
      connection,
      "fill_flow_steps",
      "relation_type_id",
      "relation_type_id INT NULL AFTER unit_type_id"
    );
    await addForeignKeyIfMissing(
      connection,
      "fill_flow_steps",
      "relation_type_id",
      "CONSTRAINT fk_fill_flow_steps_relation_type FOREIGN KEY (relation_type_id) REFERENCES relation_unit_types(id)",
      "FK fill_flow_steps.relation_type_id"
    );

    // Normalización histórica de template_scope. SOLO si la columna aún existe en template_artifacts; tras el
    // F2-drop el scope vive únicamente en `deliverables` y NO se re-crea aquí (no hay addColumnIfMissing).
    if (await taColumnExists("template_scope")) {
      try {
        // Modelo de dos tipos: 'official' | 'ad_hoc' (se eliminó 'user_reusable' → pasa a 'official').
        await connection.query(
          "UPDATE template_artifacts SET template_scope = 'official' WHERE template_scope = 'user_reusable'"
        );
        await connection.query(
          `UPDATE template_artifacts
           SET template_scope = CASE
             WHEN base_object_prefix LIKE 'Users/%/AdHoc/%' THEN 'ad_hoc'
             ELSE 'official'
           END
           WHERE template_scope IS NULL
              OR template_scope NOT IN ('official','ad_hoc')`
        );
        const [scopeCol] = await connection.query(
          `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'template_artifacts' AND COLUMN_NAME = 'template_scope'`
        );
        if (scopeCol?.[0]?.t && /user_reusable/.test(scopeCol[0].t)) {
          await connection.query(
            "ALTER TABLE template_artifacts MODIFY template_scope ENUM('official','ad_hoc') NOT NULL DEFAULT 'official'"
          );
        }
      } catch (error) {
        console.warn("⚠️  No se pudo migrar template_artifacts.template_scope:", error.message);
      }
      await addIndexIgnoringDuplicate(
        connection,
        "template_artifacts",
        "INDEX idx_template_artifacts_scope (template_scope)",
        "índice template_artifacts.template_scope"
      );
    }

    // Jefatura por puesto (F-C): cabeza de unidad + máximo una por unidad (head_flag + UNIQUE). Para DBs
    // existentes (el CREATE TABLE IF NOT EXISTS no altera columnas).
    await addColumnIfMissing(
      connection,
      "unit_positions",
      "is_unit_head",
      "is_unit_head TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active"
    );
    await addColumnIfMissing(
      connection,
      "unit_positions",
      "head_flag",
      "head_flag TINYINT(1) AS (IF(is_unit_head = 1, 1, NULL)) PERSISTENT AFTER is_unit_head"
    );
    await addIndexIgnoringDuplicate(
      connection,
      "unit_positions",
      "UNIQUE KEY uq_unit_head (unit_id, head_flag)",
      "unique una-cabeza-por-unidad"
    );

    // unit_positions: (a) is_active es la única convención de estado → se elimina deactivated_at (redundante;
    // no se mantenía en los flujos del grafo y updated_at ya registra el cuándo). (b) El perfil del puesto pasa
    // de profile_ref (puntero VARCHAR a Mongo, nunca usado) a una columna JSON local `profile`
    // (keys: formacion/experiencia/capacitacion/investigacion). Idempotente.
    try {
      const upColumnExists = async (column) => {
        const [rows] = await connection.query(
          `SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'unit_positions' AND COLUMN_NAME = ?`,
          [column]
        );
        return rows.length > 0;
      };
      if (await upColumnExists("deactivated_at")) {
        await connection.query("ALTER TABLE unit_positions DROP COLUMN deactivated_at");
      }
      if (!(await upColumnExists("profile"))) {
        await connection.query("ALTER TABLE unit_positions ADD COLUMN profile JSON NULL AFTER title");
      }
      // profile_ref era solo un puntero (VARCHAR(64)) sin contenido real → se descarta sin migrar datos.
      if (await upColumnExists("profile_ref")) {
        await connection.query("ALTER TABLE unit_positions DROP COLUMN profile_ref");
      }
    } catch (error) {
      console.warn("⚠️  No se pudo migrar unit_positions (deactivated_at/profile):", error.message);
    }

    // Eliminación del catálogo `signature_types` (tipo de firma): no ramificaba comportamiento (todas las firmas
    // son con certificado vía pyhanko) → metadato inútil. Se quitan FKs, columnas y la tabla. Idempotente.
    try {
      const dropFkIfExists = async (table, fk) => {
        const [rows] = await connection.query(
          `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
          [table, fk]
        );
        if (rows.length) await connection.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk}\``);
      };
      const dropColumnIfExists = async (table, column) => {
        const [rows] = await connection.query(
          `SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        if (rows.length) await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
      };
      await dropFkIfExists("signature_flow_steps", "fk_signature_flow_steps_type");
      await dropColumnIfExists("signature_flow_steps", "step_type_id");
      await dropFkIfExists("document_signatures", "fk_document_signatures_type");
      await dropColumnIfExists("document_signatures", "signature_type_id");
      await connection.query("DROP TABLE IF EXISTS signature_types");
    } catch (error) {
      console.warn("⚠️  No se pudo eliminar signature_types:", error.message);
    }

    // Limpieza de sobrecarga en template_artifacts: el ciclo de vida se reduce a is_active (Activo/Inactivo);
    // se elimina artifact_stage (pipeline editorial del CLI obsoleto, no gateaba runtime), source_version
    // (semver decorativo nunca leído), owner_ref (cédula derivable de owner_person_id; lo editable lo da
    // template_scope) y bucket (siempre la constante). storage_version pasa de 'vNNNN' a semver 'X.Y.Z'.
    try {
      const columnExists = async (table, column) => {
        const [rows] = await connection.query(
          `SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      };
      const dropColumnIfExists = async (table, column) => {
        if (await columnExists(table, column)) {
          await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        }
      };
      // Coherencia previa: una etapa 'archived' equivale a inactiva.
      if (await columnExists("template_artifacts", "artifact_stage")) {
        await connection.query(
          "UPDATE template_artifacts SET is_active = 0 WHERE artifact_stage = 'archived'"
        );
      }
      // Invariante: storage_version SIEMPRE coincide con el segmento de versión del base_object_prefix (donde
      // viven los objetos en MinIO). Re-alinea filas desincronizadas (p. ej. por migraciones previas) sin mover
      // objetos: la verdad es la ruta física. Las plantillas nuevas/versiones nacen ya con semver (X.Y.Z); las
      // antiguas conservan su segmento histórico (vNNNN) hasta que se cree una nueva versión o se reinstale.
      await connection.query(
        `UPDATE template_artifacts
            SET storage_version = SUBSTRING_INDEX(TRIM(TRAILING '/' FROM base_object_prefix), '/', -1)
          WHERE base_object_prefix IS NOT NULL
            AND base_object_prefix <> ''
            AND storage_version <> SUBSTRING_INDEX(TRIM(TRAILING '/' FROM base_object_prefix), '/', -1)`
      );
      await dropColumnIfExists("template_artifacts", "artifact_stage");
      await dropColumnIfExists("template_artifacts", "source_version");
      await dropColumnIfExists("template_artifacts", "owner_ref");
      await dropColumnIfExists("template_artifacts", "bucket");
    } catch (error) {
      console.warn("⚠️  No se pudo limpiar template_artifacts:", error.message);
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
    if (!taskColumnNames.includes("scope_unit_id")) {
      await connection.query("ALTER TABLE tasks ADD COLUMN scope_unit_id INT NULL AFTER term_id");
    }
    if (!taskColumnNames.includes("normalized_scope_unit_id")) {
      await connection.query(
        "ALTER TABLE tasks ADD COLUMN normalized_scope_unit_id INT AS (IFNULL(scope_unit_id, 0)) PERSISTENT AFTER scope_unit_id"
      );
    }
    try {
      await connection.query(
        `UPDATE tasks t
         LEFT JOIN unit_positions up ON up.id = t.responsible_position_id
         SET t.scope_unit_id = COALESCE(t.scope_unit_id, up.unit_id)
         WHERE t.scope_unit_id IS NULL`
      );
    } catch (error) {
      console.warn("⚠️  No se pudo backfillear tasks.scope_unit_id:", error.message);
    }
    try {
      await connection.query("ALTER TABLE tasks ADD INDEX idx_tasks_process_run (process_run_id)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear índice de tasks.process_run_id:", error.message);
      }
    }
    await addIndexIgnoringDuplicate(
      connection,
      "tasks",
      "INDEX idx_tasks_scope_unit (scope_unit_id)",
      "índice tasks.scope_unit_id"
    );
    await addIndexIgnoringDuplicate(
      connection,
      "tasks",
      "UNIQUE KEY uq_tasks_definition_term_scope (process_definition_id, term_id, normalized_scope_unit_id)",
      "unique tasks proceso-periodo-alcance"
    );
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
    await addForeignKeyIfMissing(
      connection,
      "tasks",
      "scope_unit_id",
      "CONSTRAINT fk_tasks_scope_unit FOREIGN KEY (scope_unit_id) REFERENCES units(id)",
      "FK tasks.scope_unit_id"
    );

    // Asigna una corrida manual a tareas que se crearon sin process_run_id
    // (p. ej. tareas sueltas del proceso default creadas desde Home).
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
           'manual',
           t.created_by_user_id,
           'active'
         FROM tasks t
         LEFT JOIN process_runs pr
           ON pr.process_definition_id = t.process_definition_id
          AND pr.term_id <=> t.term_id
          AND pr.run_mode = 'manual'
         WHERE t.process_run_id IS NULL
           AND pr.id IS NULL`
      );

      await connection.query(
        `UPDATE tasks t
         INNER JOIN process_runs pr
           ON pr.process_definition_id = t.process_definition_id
          AND pr.term_id <=> t.term_id
          AND pr.run_mode = 'manual'
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
    try {
      await connection.query("ALTER TABLE task_items MODIFY COLUMN process_definition_template_id INT NULL");
    } catch (error) {
      console.warn("⚠️  No se pudo ajustar task_items.process_definition_template_id a nullable:", error.message);
    }
    if (!taskItemColumnNames.includes("origin_kind")) {
      await connection.query(
        "ALTER TABLE task_items ADD COLUMN origin_kind ENUM('process_defined','user_added') NOT NULL DEFAULT 'process_defined' AFTER template_artifact_id"
      );
    }
    if (!taskItemColumnNames.includes("title")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN title VARCHAR(180) NULL AFTER origin_kind");
    }
    if (!taskItemColumnNames.includes("created_by_person_id")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN created_by_person_id INT NULL AFTER sort_order");
    }
    if (!taskItemColumnNames.includes("source_task_item_id")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN source_task_item_id INT NULL AFTER created_by_person_id");
    }
    if (!taskItemColumnNames.includes("target_unit_id")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN target_unit_id INT NULL AFTER source_task_item_id");
    }
    if (!taskItemColumnNames.includes("target_position_id")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN target_position_id INT NULL AFTER target_unit_id");
    }
    if (!taskItemColumnNames.includes("target_person_id")) {
      await connection.query("ALTER TABLE task_items ADD COLUMN target_person_id INT NULL AFTER target_position_id");
    }
    if (!taskItemColumnNames.includes("process_definition_template_key")) {
      await connection.query(
        "ALTER TABLE task_items ADD COLUMN process_definition_template_key INT AS (IF(origin_kind = 'process_defined', process_definition_template_id, NULL)) PERSISTENT AFTER target_person_id"
      );
    }
    if (!taskItemColumnNames.includes("target_position_key")) {
      await connection.query(
        "ALTER TABLE task_items ADD COLUMN target_position_key INT AS (IF(origin_kind = 'process_defined', IFNULL(target_position_id, 0), NULL)) PERSISTENT AFTER process_definition_template_key"
      );
    }
    if (!taskItemColumnNames.includes("target_person_key")) {
      await connection.query(
        "ALTER TABLE task_items ADD COLUMN target_person_key INT AS (IF(origin_kind = 'process_defined', IFNULL(target_person_id, 0), NULL)) PERSISTENT AFTER target_position_key"
      );
    }
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
         LEFT JOIN template_artifacts ta ON ta.id = ti.template_artifact_id
         LEFT JOIN deliverables ta_d ON ta_d.id = ta.deliverable_id
         LEFT JOIN unit_positions item_pos ON item_pos.id = ti.responsible_position_id
         LEFT JOIN unit_positions task_pos ON task_pos.id = t.responsible_position_id
         SET ti.origin_kind = COALESCE(ti.origin_kind, 'process_defined'),
             ti.created_by_person_id = COALESCE(ti.created_by_person_id, t.created_by_user_id),
             ti.target_person_id = COALESCE(ti.target_person_id, ti.assigned_person_id),
             ti.target_position_id = COALESCE(ti.target_position_id, ti.responsible_position_id, t.responsible_position_id),
             ti.target_unit_id = COALESCE(ti.target_unit_id, item_pos.unit_id, task_pos.unit_id, t.scope_unit_id),
             ti.title = COALESCE(ti.title, ta_d.display_name)
         WHERE ti.origin_kind IS NULL
            OR ti.created_by_person_id IS NULL
            OR ti.target_person_id IS NULL
            OR ti.target_position_id IS NULL
            OR ti.target_unit_id IS NULL
            OR ti.title IS NULL`
      );
    } catch (error) {
      console.warn("⚠️  No se pudo backfillear metadata de task_items:", error.message);
    }
    await addIndexIgnoringDuplicate(
      connection,
      "task_items",
      "UNIQUE KEY uq_task_items_defined_target (task_id, process_definition_template_key, target_position_key, target_person_key)",
      "unique task_items entregable-destino"
    );
    await addIndexIgnoringDuplicate(connection, "task_items", "INDEX idx_task_items_origin (origin_kind)", "índice task_items.origin_kind");
    await addIndexIgnoringDuplicate(
      connection,
      "task_items",
      "INDEX idx_task_items_definition_template (process_definition_template_id)",
      "índice task_items.process_definition_template_id"
    );
    await addIndexIgnoringDuplicate(connection, "task_items", "INDEX idx_task_items_created_by (created_by_person_id)", "índice task_items.created_by_person_id");
    await addIndexIgnoringDuplicate(connection, "task_items", "INDEX idx_task_items_source (source_task_item_id)", "índice task_items.source_task_item_id");
    await addIndexIgnoringDuplicate(connection, "task_items", "INDEX idx_task_items_target_unit (target_unit_id)", "índice task_items.target_unit_id");
    await addIndexIgnoringDuplicate(connection, "task_items", "INDEX idx_task_items_target_position (target_position_id)", "índice task_items.target_position_id");
    await addIndexIgnoringDuplicate(connection, "task_items", "INDEX idx_task_items_target_person (target_person_id)", "índice task_items.target_person_id");
    await addForeignKeyIfMissing(
      connection,
      "task_items",
      "created_by_person_id",
      "CONSTRAINT fk_task_items_created_by FOREIGN KEY (created_by_person_id) REFERENCES persons(id)",
      "FK task_items.created_by_person_id"
    );
    await addForeignKeyIfMissing(
      connection,
      "task_items",
      "source_task_item_id",
      "CONSTRAINT fk_task_items_source FOREIGN KEY (source_task_item_id) REFERENCES task_items(id)",
      "FK task_items.source_task_item_id"
    );
    await addForeignKeyIfMissing(
      connection,
      "task_items",
      "target_unit_id",
      "CONSTRAINT fk_task_items_target_unit FOREIGN KEY (target_unit_id) REFERENCES units(id)",
      "FK task_items.target_unit_id"
    );
    await addForeignKeyIfMissing(
      connection,
      "task_items",
      "target_position_id",
      "CONSTRAINT fk_task_items_target_position FOREIGN KEY (target_position_id) REFERENCES unit_positions(id)",
      "FK task_items.target_position_id"
    );
    await addForeignKeyIfMissing(
      connection,
      "task_items",
      "target_person_id",
      "CONSTRAINT fk_task_items_target_person FOREIGN KEY (target_person_id) REFERENCES persons(id)",
      "FK task_items.target_person_id"
    );
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
           COALESCE(tar_d.display_name, CONCAT('Documento ', ti.id)),
           'Inicial'
         FROM task_items ti
         LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
         LEFT JOIN deliverables tar_d ON tar_d.id = tar.deliverable_id
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

    // Limpieza modelo (2026-06): columnas vestigiales de 'processes' (unit_id/program_id/person_id/term_id).
    // Nunca fueron leídas ni escritas por la aplicación; el scoping vive en process_definition_series +
    // process_target_rules + triggers. Se eliminan (idempotente): primero las FKs, luego las columnas.
    const [processColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processes'`
    );
    const processColumnNames = processColumns.map((col) => col.COLUMN_NAME);
    const [processFkRows] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processes'
         AND COLUMN_NAME IN ('person_id', 'term_id') AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    for (const fk of processFkRows.map((r) => r.CONSTRAINT_NAME)) {
      try {
        await connection.query(`ALTER TABLE processes DROP FOREIGN KEY ${fk}`);
      } catch (error) {
        console.warn(`⚠️  No se pudo eliminar FK ${fk} de processes:`, error.message);
      }
    }
    for (const col of ["unit_id", "program_id", "person_id", "term_id"]) {
      if (processColumnNames.includes(col)) {
        try {
          await connection.query(`ALTER TABLE processes DROP COLUMN ${col}`);
        } catch (error) {
          console.warn(`⚠️  No se pudo eliminar processes.${col}:`, error.message);
        }
      }
    }

    // Limpieza modelo (2026-06): columnas deprecadas por la migración del modelo de plantillas.
    // - template_artifacts.artifact_origin: constante 'process'; la propiedad se distingue por template_scope.
    const dropDeprecatedColumn = async (table, column) => {
      const [exists] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if (exists.length) {
        try {
          await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        } catch (error) {
          console.warn(`⚠️  No se pudo eliminar ${table}.${column}:`, error.message);
        }
      }
    };
    await dropDeprecatedColumn("template_artifacts", "artifact_origin");
    // - usage_role / template_usage_role: deprecados (Paso 6). Toda plantilla/entregable es 'primary';
    //   la adjunción ad-hoc va por document_attachments.
    await dropDeprecatedColumn("task_items", "template_usage_role");
    // process_definition_templates.usage_role forma parte del UNIQUE KEY (necesitado por un FK), así que se
    // reconstruye el índice sin esa columna en un único ALTER atómico (InnoDB ve el índice de reemplazo).
    {
      const [pdtUsageRole] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_definition_templates' AND COLUMN_NAME = 'usage_role'`
      );
      if (pdtUsageRole.length) {
        try {
          await connection.query(
            `ALTER TABLE process_definition_templates
               DROP INDEX uq_process_definition_templates,
               DROP COLUMN usage_role,
               ADD UNIQUE KEY uq_process_definition_templates (process_definition_id, template_artifact_id)`
          );
        } catch (error) {
          console.warn("⚠️  No se pudo eliminar process_definition_templates.usage_role:", error.message);
        }
      }
    }

    // - process_target_rules.include_descendants (2026-06): redundante con unit_scope_type='unit_subtree'
    //   (unit_exact + include_descendants=1 resolvía idéntico al subárbol). Antes de eliminar la columna,
    //   se promueven esas reglas a 'unit_subtree' para no perder su alcance.
    {
      const [hasIncludeDescendants] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_target_rules' AND COLUMN_NAME = 'include_descendants'`
      );
      if (hasIncludeDescendants.length) {
        try {
          await connection.query(
            `UPDATE process_target_rules
                SET unit_scope_type = 'unit_subtree'
              WHERE unit_scope_type = 'unit_exact' AND include_descendants = 1`
          );
        } catch (error) {
          console.warn("⚠️  No se pudo migrar process_target_rules.include_descendants:", error.message);
        }
      }
    }
    await dropDeprecatedColumn("process_target_rules", "include_descendants");

    // - process_target_rules.recipient_policy='one_match_only' (2026-06): de valor dudoso ("un solo puesto
    //   arbitrario en todo el alcance, ignorando el resto de unidades"). Se promueve a 'one_per_unit' (uno por
    //   unidad) y se quita del enum. Idempotente: solo actúa si el enum aún lo declara.
    {
      const [policyCol] = await connection.query(
        `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_target_rules' AND COLUMN_NAME = 'recipient_policy'`
      );
      if (policyCol.length && /one_match_only/.test(policyCol[0].COLUMN_TYPE)) {
        try {
          await connection.query(
            "UPDATE process_target_rules SET recipient_policy = 'one_per_unit' WHERE recipient_policy = 'one_match_only'"
          );
          await connection.query(
            `ALTER TABLE process_target_rules
               MODIFY recipient_policy ENUM('all_matches','one_per_unit','exact_position') NOT NULL DEFAULT 'all_matches'`
          );
        } catch (error) {
          console.warn("⚠️  No se pudo deprecar recipient_policy.one_match_only:", error.message);
        }
      }
    }

    // CHECK legacy que referenciaba processes.unit_id/program_id (ya eliminadas). En un schema nuevo
    // no existe; solo se elimina si está presente (evita un warning falso por código de error variable
    // entre MariaDB/MySQL al hacer DROP de una constraint inexistente).
    const [processCheckRows] = await connection.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processes'
         AND CONSTRAINT_NAME = 'chk_process_unit_program'`
    );
    if (processCheckRows.length) {
      try {
        await connection.query("ALTER TABLE processes DROP CONSTRAINT chk_process_unit_program");
      } catch (error) {
        console.warn("⚠️  No se pudo eliminar CHECK de processes:", error.message);
      }
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
