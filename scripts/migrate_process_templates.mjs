import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const mysql = require(path.join(repoRoot, "backend", "node_modules", "mysql2", "promise"));

const envPath = path.join(repoRoot, "backend", ".env");

const loadEnv = async () => {
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const [key, ...rest] = trimmed.split("=");
      if (!key || process.env[key]) {
        return;
      }
      process.env[key] = rest.join("=").trim();
    });
  } catch (error) {
    console.warn(`No se pudo leer ${envPath}: ${error.message}`);
  }
};

const getConfig = () => {
  const required = [
    "MARIADB_HOST",
    "MARIADB_PORT",
    "MARIADB_USER",
    "MARIADB_PASSWORD",
    "MARIADB_DATABASE"
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Configuracion MariaDB incompleta. Faltan: ${missing.join(", ")}`);
  }
  return {
    host: process.env.MARIADB_HOST,
    port: Number(process.env.MARIADB_PORT),
    user: process.env.MARIADB_USER,
    password: process.env.MARIADB_PASSWORD,
    database: process.env.MARIADB_DATABASE,
    timezone: process.env.MARIADB_TIMEZONE || "Z"
  };
};

const tableExists = async (connection, tableName) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
};

const getColumnNames = async (connection, tableName) => {
  const [rows] = await connection.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return new Set(rows.map((row) => row.column_name));
};

const getIndexNames = async (connection, tableName) => {
  const [rows] = await connection.query(`SHOW INDEX FROM \`${tableName}\``);
  return new Set(rows.map((row) => row.Key_name));
};

const getForeignKeys = async (connection, tableName) => {
  const [rows] = await connection.query(
    `SELECT tc.constraint_name, kcu.column_name, kcu.referenced_table_name
     FROM information_schema.table_constraints tc
     INNER JOIN information_schema.key_column_usage kcu
       ON tc.constraint_schema = kcu.constraint_schema
      AND tc.table_name = kcu.table_name
      AND tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_schema = DATABASE()
       AND tc.table_name = ?
       AND tc.constraint_type = 'FOREIGN KEY'`,
    [tableName]
  );
  return rows;
};

const dropForeignKeyIfExists = async (connection, tableName, constraintName) => {
  const fks = await getForeignKeys(connection, tableName);
  if (fks.some((row) => row.constraint_name === constraintName)) {
    await connection.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
    console.log(`FK eliminada: ${tableName}.${constraintName}`);
  }
};

const dropIndexIfExists = async (connection, tableName, indexName) => {
  const indexes = await getIndexNames(connection, tableName);
  if (indexes.has(indexName)) {
    await connection.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
    console.log(`Indice eliminado: ${tableName}.${indexName}`);
  }
};

const getRowCount = async (connection, tableName) => {
  const [rows] = await connection.query(`SELECT COUNT(*) AS c FROM \`${tableName}\``);
  return Number(rows?.[0]?.c || 0);
};

const ensureProcessDefinitionTemplates = async (connection) => {
  const hasOld = await tableExists(connection, "process_definition_template_bindings");
  const hasNew = await tableExists(connection, "process_definition_templates");

  if (hasOld && hasNew) {
    const oldRows = await getRowCount(connection, "process_definition_template_bindings");
    const newRows = await getRowCount(connection, "process_definition_templates");
    if (oldRows === 0) {
      await connection.query("DROP TABLE `process_definition_template_bindings`");
      console.log("Tabla legacy vacia eliminada: process_definition_template_bindings");
    } else if (newRows === 0) {
      await connection.query("DROP TABLE `process_definition_templates`");
      await connection.query(
        "RENAME TABLE `process_definition_template_bindings` TO `process_definition_templates`"
      );
      console.log("Tabla nueva vacia descartada y tabla legacy renombrada a process_definition_templates");
    } else {
      throw new Error(
        "Existen tanto process_definition_template_bindings como process_definition_templates con datos. Limpia una de las dos antes de migrar."
      );
    }
  }

  if (hasOld && !hasNew) {
    await connection.query(
      "RENAME TABLE `process_definition_template_bindings` TO `process_definition_templates`"
    );
    console.log("Tabla renombrada: process_definition_template_bindings -> process_definition_templates");
  }

  if (!(await tableExists(connection, "process_definition_templates"))) {
    console.log("No existe process_definition_templates. No hubo datos que migrar en esta parte.");
    return;
  }

  const columns = await getColumnNames(connection, "process_definition_templates");
  if (!columns.has("creates_task")) {
    await connection.query(
      `ALTER TABLE \`process_definition_templates\`
       ADD COLUMN \`creates_task\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`usage_role\``
    );
    console.log("Columna agregada: process_definition_templates.creates_task");
  }

  await dropForeignKeyIfExists(connection, "process_definition_templates", "fk_process_definition_template_bindings_definition");
  await dropForeignKeyIfExists(connection, "process_definition_templates", "fk_process_definition_template_bindings_artifact");
  await dropIndexIfExists(connection, "process_definition_templates", "uq_process_definition_template_bindings");

  const indexes = await getIndexNames(connection, "process_definition_templates");
  if (!indexes.has("uq_process_definition_templates")) {
    await connection.query(
      `ALTER TABLE \`process_definition_templates\`
       ADD CONSTRAINT \`uq_process_definition_templates\`
       UNIQUE (\`process_definition_id\`, \`template_artifact_id\`, \`usage_role\`)`
    );
    console.log("Indice creado: process_definition_templates.uq_process_definition_templates");
  }

  let fks = await getForeignKeys(connection, "process_definition_templates");
  if (!fks.some((row) => row.constraint_name === "fk_process_definition_templates_definition")) {
    await connection.query(
      `ALTER TABLE \`process_definition_templates\`
       ADD CONSTRAINT \`fk_process_definition_templates_definition\`
       FOREIGN KEY (\`process_definition_id\`) REFERENCES \`process_definition_versions\`(\`id\`) ON DELETE CASCADE`
    );
    console.log("FK creada: process_definition_templates.fk_process_definition_templates_definition");
  }
  fks = await getForeignKeys(connection, "process_definition_templates");
  if (!fks.some((row) => row.constraint_name === "fk_process_definition_templates_artifact")) {
    await connection.query(
      `ALTER TABLE \`process_definition_templates\`
       ADD CONSTRAINT \`fk_process_definition_templates_artifact\`
       FOREIGN KEY (\`template_artifact_id\`) REFERENCES \`template_artifacts\`(\`id\`)`
    );
    console.log("FK creada: process_definition_templates.fk_process_definition_templates_artifact");
  }
};

const ensureTasksTemplateColumn = async (connection) => {
  if (!(await tableExists(connection, "tasks"))) {
    console.log("No existe tasks. No hubo datos que migrar en tareas.");
    return;
  }

  const columns = await getColumnNames(connection, "tasks");
  const hasOld = columns.has("process_definition_template_binding_id");
  const hasNew = columns.has("process_definition_template_id");

  if (hasOld && hasNew) {
    throw new Error(
      "La tabla tasks contiene ambas columnas de plantilla. Limpia el esquema antes de migrar."
    );
  }

  await dropForeignKeyIfExists(connection, "tasks", "fk_tasks_process_definition_binding");
  await dropForeignKeyIfExists(connection, "tasks", "fk_tasks_process_definition_template");
  await dropIndexIfExists(connection, "tasks", "uq_tasks_term_binding");
  await dropIndexIfExists(connection, "tasks", "idx_tasks_binding_term");
  await dropIndexIfExists(connection, "tasks", "uq_tasks_term_template");
  await dropIndexIfExists(connection, "tasks", "idx_tasks_template_term");

  if (hasOld && !hasNew) {
    await connection.query(
      `ALTER TABLE \`tasks\`
       CHANGE COLUMN \`process_definition_template_binding_id\` \`process_definition_template_id\` INT NOT NULL`
    );
    console.log("Columna renombrada: tasks.process_definition_template_binding_id -> tasks.process_definition_template_id");
  }

  let refreshedColumns = await getColumnNames(connection, "tasks");
  if (!refreshedColumns.has("process_definition_template_id")) {
    const taskRows = await getRowCount(connection, "tasks");
    const templatesTableExists = await tableExists(connection, "process_definition_templates");
    const templateRows = templatesTableExists
      ? await getRowCount(connection, "process_definition_templates")
      : 0;

    if (taskRows > 0) {
      await connection.query("DELETE FROM `task_assignments`");
      await connection.query("DELETE FROM `tasks`");
      console.log(
        `Tareas legacy eliminadas: ${taskRows}. No se podian mapear limpiamente al nuevo modelo sin process_definition_templates.`
      );
    }

    await connection.query(
      `ALTER TABLE \`tasks\`
       ADD COLUMN \`process_definition_template_id\` INT NOT NULL AFTER \`id\``
    );
    console.log(
      templateRows > 0
        ? "Columna agregada: tasks.process_definition_template_id (pendiente de poblar en nuevas tareas)."
        : "Columna agregada: tasks.process_definition_template_id"
    );
    refreshedColumns = await getColumnNames(connection, "tasks");
  }

  if (!refreshedColumns.has("process_definition_template_id")) {
    console.log("tasks no tiene columna de plantilla de definicion. Se deja al reset recrear el esquema.");
    return;
  }

  const indexes = await getIndexNames(connection, "tasks");
  if (!indexes.has("uq_tasks_term_template")) {
    await connection.query(
      `ALTER TABLE \`tasks\`
       ADD CONSTRAINT \`uq_tasks_term_template\`
       UNIQUE (\`term_id\`, \`process_definition_template_id\`)`
    );
    console.log("Indice creado: tasks.uq_tasks_term_template");
  }
  if (!indexes.has("idx_tasks_template_term")) {
    await connection.query(
      `ALTER TABLE \`tasks\`
       ADD INDEX \`idx_tasks_template_term\` (\`process_definition_template_id\`, \`term_id\`)`
    );
    console.log("Indice creado: tasks.idx_tasks_template_term");
  }

  const fks = await getForeignKeys(connection, "tasks");
  if (!fks.some((row) => row.constraint_name === "fk_tasks_process_definition_template")) {
    await connection.query(
      `ALTER TABLE \`tasks\`
       ADD CONSTRAINT \`fk_tasks_process_definition_template\`
       FOREIGN KEY (\`process_definition_template_id\`) REFERENCES \`process_definition_templates\`(\`id\`)`
    );
    console.log("FK creada: tasks.fk_tasks_process_definition_template");
  }
};

const ensureTemplateArtifactFormatEnum = async (connection) => {
  if (!(await tableExists(connection, "template_artifacts"))) {
    console.log("No existe template_artifacts. No hubo datos que migrar en artifacts.");
    return;
  }

  await connection.query(
    `ALTER TABLE \`template_artifacts\`
     MODIFY COLUMN \`format\` ENUM('jinja2', 'docx', 'latex', 'pdf', 'xlsx') NOT NULL`
  );
  console.log("Columna ajustada: template_artifacts.format restringida a enum.");
};

const main = async () => {
  await loadEnv();
  const connection = await mysql.createConnection(getConfig());
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await ensureProcessDefinitionTemplates(connection);
    await ensureTemplateArtifactFormatEnum(connection);
    await ensureTasksTemplateColumn(connection);
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✅ Migracion de process_definition_templates completada.");
  } catch (error) {
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch {
      // noop
    }
    throw error;
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(`❌ Error en migracion: ${error.message}`);
  process.exitCode = 1;
});
