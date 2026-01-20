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

const ADD_PHOTO_COLUMN_SQL = `
ALTER TABLE users
ADD COLUMN IF NOT EXISTS photo_url LONGTEXT DEFAULT NULL;
`;

const MODIFY_PHOTO_COLUMN_SQL = `
ALTER TABLE users
MODIFY COLUMN photo_url LONGTEXT DEFAULT NULL;
`;

const SCHEMA_FILE_URL = new URL("./mariadb_schema.sql", import.meta.url);

const stripSqlComments = (sql) =>
  sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

const splitSqlStatements = (sql) =>
  stripSqlComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length);

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

export const ensureMariaDBSchema = async () => {
  const pool = getMariaDBPool();

  if (!pool) {
    console.warn(
      "⚠️  Saltando inicialización MariaDB: no hay conexión configurada."
    );
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.query(CREATE_USERS_TABLE_SQL);
    await connection.query(CREATE_EMAIL_VERIFICATION_CODES_TABLE_SQL);
    await connection.query(ADD_PHOTO_COLUMN_SQL);
    await connection.query(MODIFY_PHOTO_COLUMN_SQL);
    console.log("✅ Tabla 'users' verificada/creada en MariaDB");
    console.log("✅ Tabla 'email_verification_codes' verificada/creada");

    const [columns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_versions'`
    );
    const columnNames = columns.map((col) => col.COLUMN_NAME);
    if (columnNames.includes("version_num") && !columnNames.includes("version")) {
      await connection.query(
        "ALTER TABLE document_versions CHANGE COLUMN version_num version INT NOT NULL"
      );
      console.log("✅ Columna document_versions.version_num renombrada a version");
    }
    if (columnNames.includes("version")) {
      await connection.query(
        "ALTER TABLE document_versions MODIFY COLUMN version DECIMAL(4,1) NOT NULL DEFAULT 0.1"
      );
    }

    const [processColumns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'processes'`
    );
    const processColumnNames = processColumns.map((col) => col.COLUMN_NAME);
    if (!processColumnNames.includes("unit_id")) {
      await connection.query("ALTER TABLE processes ADD COLUMN unit_id INT NULL");
    }
    if (!processColumnNames.includes("program_id")) {
      await connection.query("ALTER TABLE processes ADD COLUMN program_id INT NULL");
    }
    if (!processColumnNames.includes("person_id")) {
      await connection.query("ALTER TABLE processes ADD COLUMN person_id INT NULL");
    }
    if (!processColumnNames.includes("term_id")) {
      await connection.query("ALTER TABLE processes ADD COLUMN term_id INT NULL");
    }
    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'processes'
           AND COLUMN_NAME = 'person_id'
           AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length) {
        await connection.query(
          "ALTER TABLE processes ADD CONSTRAINT fk_processes_person FOREIGN KEY (person_id) REFERENCES persons(id)"
        );
      }
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de processes.person_id:", error.message);
    }
    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'processes'
           AND COLUMN_NAME = 'term_id'
           AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      if (!fkRows.length) {
        await connection.query(
          "ALTER TABLE processes ADD CONSTRAINT fk_processes_term FOREIGN KEY (term_id) REFERENCES terms(id)"
        );
      }
    } catch (error) {
      console.warn("⚠️  No se pudo crear FK de processes.term_id:", error.message);
    }
    try {
      await connection.query("ALTER TABLE processes DROP CONSTRAINT chk_process_unit_program");
    } catch (error) {
      if (error?.code !== "ER_CONSTRAINT_NOT_FOUND") {
        console.warn("⚠️  No se pudo eliminar el CHECK de processes:", error.message);
      }
    }

    const [templateColumns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates'`
    );
    const templateColumnNames = templateColumns.map((col) => col.COLUMN_NAME);
    if (!templateColumnNames.includes("version")) {
      await connection.query("ALTER TABLE templates ADD COLUMN version VARCHAR(10) NOT NULL DEFAULT '0.1'");
    } else {
      await connection.query("ALTER TABLE templates MODIFY COLUMN version VARCHAR(10) NOT NULL DEFAULT '0.1'");
    }

    const [processTemplateColumns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_templates'`
    );
    const processTemplateColumnNames = processTemplateColumns.map((col) => col.COLUMN_NAME);
    if (processTemplateColumnNames.includes("template_version_id")) {
      try {
        const [fkRows] = await connection.query(
          `SELECT CONSTRAINT_NAME
           FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'process_templates'
             AND COLUMN_NAME = 'template_version_id'
             AND REFERENCED_TABLE_NAME IS NOT NULL`
        );
        if (fkRows.length) {
          await connection.query(
            `ALTER TABLE process_templates DROP FOREIGN KEY ${fkRows[0].CONSTRAINT_NAME}`
          );
        }
      } catch (error) {
        console.warn("⚠️  No se pudo eliminar FK antigua de process_templates:", error.message);
      }
      try {
        await connection.query(
          "ALTER TABLE process_templates MODIFY COLUMN template_version_id INT NULL DEFAULT NULL"
        );
      } catch (error) {
        console.warn("⚠️  No se pudo ajustar template_version_id:", error.message);
      }
      try {
        await connection.query("ALTER TABLE process_templates DROP COLUMN template_version_id");
      } catch (error) {
        console.warn("⚠️  No se pudo eliminar template_version_id:", error.message);
      }
    }
    if (!processTemplateColumnNames.includes("template_id")) {
      await connection.query("ALTER TABLE process_templates ADD COLUMN template_id INT NOT NULL");
    }
    try {
      await connection.query("ALTER TABLE process_templates DROP PRIMARY KEY");
    } catch (error) {
      if (error?.code !== "ER_CANT_DROP_FIELD_OR_KEY") {
        console.warn("⚠️  No se pudo eliminar PK antigua de process_templates:", error.message);
      }
    }
    try {
      await connection.query("ALTER TABLE process_templates ADD PRIMARY KEY (process_id, template_id)");
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear PK nueva de process_templates:", error.message);
      }
    }
    try {
      await connection.query(
        "ALTER TABLE process_templates ADD CONSTRAINT fk_process_templates_template FOREIGN KEY (template_id) REFERENCES templates(id)"
      );
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear FK de process_templates:", error.message);
      }
    }
    try {
      await connection.query(
        "ALTER TABLE processes ADD CONSTRAINT chk_process_unit_program CHECK (unit_id IS NOT NULL OR program_id IS NOT NULL)"
      );
    } catch (error) {
      if (error?.code !== "ER_CHECK_CONSTRAINT_EXISTS") {
        console.warn("⚠️  No se pudo crear el CHECK de processes:", error.message);
      }
    }

    const schemaSql = await fs.readFile(SCHEMA_FILE_URL, "utf-8");
    const statements = splitSqlStatements(schemaSql);

    for (const statement of statements) {
      await connection.query(statement);
    }

    console.log("✅ Esquema MariaDB verificado/creado desde mariadb_schema.sql");
  } finally {
    connection.release();
  }
};
