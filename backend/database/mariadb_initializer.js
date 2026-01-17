import mysql from "mysql2/promise";
import fs from "fs/promises";
import {
  getMariaDBPool,
  getMariaDBDatabaseName,
  getMariaDBBaseConfig
} from "../config/mariadb.js";

const ensureDatabaseSQL = (databaseName) =>
  `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

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
    try {
      await connection.query("DROP TABLE IF EXISTS users");
      console.log("✅ Tabla legacy 'users' eliminada (si existia)");
    } catch (error) {
      console.warn("⚠️  No se pudo eliminar la tabla legacy users:", error.message);
    }

    try {
      const [personTableRows] = await connection.query(
        `SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons'`
      );
      if (personTableRows.length) {
        const [personColumns] = await connection.query(
          `SELECT COLUMN_NAME
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persons'`
        );
        const personColumnNames = personColumns.map((col) => col.COLUMN_NAME);
        const addColumn = async (name, definition) => {
          if (!personColumnNames.includes(name)) {
            await connection.query(`ALTER TABLE persons ADD COLUMN ${definition}`);
          }
        };

        await addColumn("direccion", "direccion VARCHAR(255) NULL");
        await addColumn("pais", "pais VARCHAR(80) NULL");
        await addColumn("password_hash", "password_hash VARCHAR(255) NOT NULL");
        await addColumn(
          "status",
          "status ENUM('Inactivo','Activo','Verificado','Reportado') DEFAULT 'Inactivo'"
        );
        await addColumn("verify_email", "verify_email TINYINT(1) DEFAULT 0");
        await addColumn("verify_whatsapp", "verify_whatsapp TINYINT(1) DEFAULT 0");
        await addColumn("photo_url", "photo_url LONGTEXT DEFAULT NULL");
        await addColumn(
          "updated_at",
          "updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        );
      }
    } catch (error) {
      console.warn("⚠️  No se pudo ajustar el esquema de persons:", error.message);
    }

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
    if (processColumnNames.includes("term_id")) {
      try {
        const [fkRows] = await connection.query(
          `SELECT CONSTRAINT_NAME
           FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'processes'
             AND COLUMN_NAME = 'term_id'
             AND REFERENCED_TABLE_NAME IS NOT NULL`
        );
        for (const fk of fkRows) {
          await connection.query(`ALTER TABLE processes DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }
      } catch (error) {
        console.warn("⚠️  No se pudo eliminar FK de processes.term_id:", error.message);
      }
      try {
        await connection.query("ALTER TABLE processes DROP COLUMN term_id");
      } catch (error) {
        console.warn("⚠️  No se pudo eliminar columna processes.term_id:", error.message);
      }
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

    const [documentColumns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents'`
    );
    const documentColumnNames = documentColumns.map((col) => col.COLUMN_NAME);
    if (documentColumnNames.includes("process_id")) {
      try {
        const [fkRows] = await connection.query(
          `SELECT CONSTRAINT_NAME
           FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'documents'
             AND COLUMN_NAME = 'process_id'
             AND REFERENCED_TABLE_NAME IS NOT NULL`
        );
        for (const fk of fkRows) {
          await connection.query(`ALTER TABLE documents DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }
      } catch (error) {
        console.warn("⚠️  No se pudo eliminar FK de documents.process_id:", error.message);
      }
      try {
        await connection.query("ALTER TABLE documents DROP COLUMN process_id");
      } catch (error) {
        console.warn("⚠️  No se pudo eliminar columna documents.process_id:", error.message);
      }
    }
    if (!documentColumnNames.includes("task_id")) {
      try {
        await connection.query("ALTER TABLE documents ADD COLUMN task_id INT NOT NULL");
      } catch (error) {
        console.warn("⚠️  No se pudo agregar columna documents.task_id:", error.message);
      }
    }
    try {
      const [taskTableRows] = await connection.query(
        `SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'`
      );
      if (taskTableRows.length) {
        await connection.query(
          "ALTER TABLE documents ADD CONSTRAINT fk_documents_task FOREIGN KEY (task_id) REFERENCES tasks(id)"
        );
      }
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo crear FK de documents.task_id:", error.message);
      }
    }

    try {
      const [taskTableRows] = await connection.query(
        `SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'`
      );
      if (taskTableRows.length) {
        const [taskColumns] = await connection.query(
          `SELECT COLUMN_NAME
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'`
        );
        const taskColumnNames = taskColumns.map((col) => col.COLUMN_NAME);
        if (!taskColumnNames.includes("parent_task_id")) {
          try {
            await connection.query("ALTER TABLE tasks ADD COLUMN parent_task_id INT NULL AFTER term_id");
          } catch (error) {
            console.warn("⚠️  No se pudo agregar tasks.parent_task_id:", error.message);
          }
        }
        if (taskColumnNames.includes("responsible_person_id")) {
          try {
            await connection.query("ALTER TABLE tasks MODIFY COLUMN responsible_person_id INT NULL");
          } catch (error) {
            console.warn("⚠️  No se pudo ajustar tasks.responsible_person_id:", error.message);
          }
        }

        const [taskIndexes] = await connection.query(
          `SELECT INDEX_NAME,
                  NON_UNIQUE,
                  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
           FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'
           GROUP BY INDEX_NAME, NON_UNIQUE`
        );
        const uniqueProcessTerm = taskIndexes.find(
          (idx) => idx.NON_UNIQUE === 0 && idx.columns === "process_id,term_id"
        );
        if (uniqueProcessTerm) {
          try {
            await connection.query(`ALTER TABLE tasks DROP INDEX \`${uniqueProcessTerm.INDEX_NAME}\``);
          } catch (error) {
            console.warn("⚠️  No se pudo eliminar UNIQUE de tasks:", error.message);
          }
        }
        const hasProcessTermIndex = taskIndexes.some(
          (idx) => idx.columns === "process_id,term_id"
        );
        if (!hasProcessTermIndex) {
          try {
            await connection.query("ALTER TABLE tasks ADD INDEX idx_tasks_process_term (process_id, term_id)");
          } catch (error) {
            console.warn("⚠️  No se pudo crear indice tasks.process_id/term_id:", error.message);
          }
        }

        if (taskColumnNames.includes("parent_task_id")) {
          try {
            const [fkRows] = await connection.query(
              `SELECT CONSTRAINT_NAME
               FROM information_schema.KEY_COLUMN_USAGE
               WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME = 'tasks'
                 AND COLUMN_NAME = 'parent_task_id'
                 AND REFERENCED_TABLE_NAME IS NOT NULL`
            );
            if (!fkRows.length) {
              await connection.query(
                "ALTER TABLE tasks ADD CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES tasks(id)"
              );
            }
          } catch (error) {
            if (error?.code !== "ER_DUP_KEYNAME") {
              console.warn("⚠️  No se pudo crear FK de tasks.parent_task_id:", error.message);
            }
          }
        }
      }
    } catch (error) {
      console.warn("⚠️  No se pudo ajustar esquema de tasks:", error.message);
    }

    const schemaSql = await fs.readFile(SCHEMA_FILE_URL, "utf-8");
    const statements = splitSqlStatements(schemaSql);

    for (const statement of statements) {
      await connection.query(statement);
    }

    console.log("✅ Esquema MariaDB verificado/creado desde mariadb_schema.sql");

    try {
      const [fkRows] = await connection.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'documents'
           AND COLUMN_NAME = 'task_id'
           AND REFERENCED_TABLE_NAME = 'tasks'`
      );
      if (!fkRows.length) {
        await connection.query(
          "ALTER TABLE documents ADD CONSTRAINT fk_documents_task FOREIGN KEY (task_id) REFERENCES tasks(id)"
        );
      }
    } catch (error) {
      if (error?.code !== "ER_DUP_KEYNAME") {
        console.warn("⚠️  No se pudo asegurar FK documents.task_id:", error.message);
      }
    }
  } finally {
    connection.release();
  }
};
