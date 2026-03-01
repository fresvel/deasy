import { getMariaDBPool, closeMariaDBPool } from "../backend/config/mariadb.js";

const pool = getMariaDBPool();

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function foreignKeyExists(connection, tableName, constraintName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
     LIMIT 1`,
    [tableName, constraintName]
  );
  return rows.length > 0;
}

async function run() {
  const connection = await pool.getConnection();
  try {
    const added = [];

    if (!(await tableExists(connection, "process_definition_series"))) {
      await connection.query(`
        CREATE TABLE process_definition_series (
          id INT AUTO_INCREMENT PRIMARY KEY,
          process_id INT NOT NULL,
          source_type ENUM('unit_type', 'cargo', 'legacy') NOT NULL DEFAULT 'legacy',
          unit_type_id INT NULL,
          cargo_id INT NULL,
          code VARCHAR(120) NOT NULL,
          label VARCHAR(180) NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_process_definition_series_code (process_id, code),
          INDEX idx_process_definition_series_process (process_id, is_active),
          CONSTRAINT fk_process_definition_series_process
            FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
          CONSTRAINT fk_process_definition_series_unit_type
            FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
          CONSTRAINT fk_process_definition_series_cargo
            FOREIGN KEY (cargo_id) REFERENCES cargos(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      added.push("process_definition_series");
    }

    if (!(await columnExists(connection, "process_definition_versions", "series_id"))) {
      await connection.query(
        "ALTER TABLE process_definition_versions ADD COLUMN series_id INT NULL AFTER process_id"
      );
      added.push("process_definition_versions.series_id");
    }

    const [distinctRows] = await connection.query(
      `SELECT DISTINCT process_id, variation_key
       FROM process_definition_versions
       WHERE variation_key IS NOT NULL
         AND TRIM(variation_key) <> ''
       ORDER BY process_id, variation_key`
    );

    let createdSeries = 0;
    for (const row of distinctRows) {
      const processId = Number(row.process_id);
      const variationKey = String(row.variation_key || "").trim();
      const label = variationKey
        .split(/[-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      const [existingSeries] = await connection.query(
        `SELECT id
         FROM process_definition_series
         WHERE process_id = ?
           AND code = ?
         LIMIT 1`,
        [processId, variationKey]
      );
      if (!existingSeries?.length) {
        await connection.query(
          `INSERT INTO process_definition_series (
            process_id,
            source_type,
            unit_type_id,
            cargo_id,
            code,
            label,
            is_active
          ) VALUES (?, 'legacy', NULL, NULL, ?, ?, 1)`,
          [processId, variationKey, label || variationKey]
        );
        createdSeries += 1;
      }
      const [targetSeries] = await connection.query(
        `SELECT id
         FROM process_definition_series
         WHERE process_id = ?
           AND code = ?
         LIMIT 1`,
        [processId, variationKey]
      );
      if (targetSeries?.length) {
        await connection.query(
          `UPDATE process_definition_versions
           SET series_id = ?
           WHERE process_id = ?
             AND variation_key = ?
             AND (series_id IS NULL OR series_id <> ?)`,
          [targetSeries[0].id, processId, variationKey, targetSeries[0].id]
        );
      }
    }

    await connection.query(
      `UPDATE process_definition_versions
       SET series_id = (
         SELECT pds.id
         FROM process_definition_series pds
         WHERE pds.process_id = process_definition_versions.process_id
           AND pds.code = process_definition_versions.variation_key
         LIMIT 1
       )
       WHERE series_id IS NULL`
    );

    await connection.query(
      "ALTER TABLE process_definition_versions MODIFY COLUMN series_id INT NOT NULL"
    );

    if (!(await foreignKeyExists(connection, "process_definition_versions", "fk_process_definition_versions_series"))) {
      await connection.query(
        `ALTER TABLE process_definition_versions
         ADD CONSTRAINT fk_process_definition_versions_series
         FOREIGN KEY (series_id) REFERENCES process_definition_series(id)`
      );
      added.push("fk_process_definition_versions_series");
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS linked
       FROM process_definition_versions
       WHERE series_id IS NOT NULL`
    );

    console.log(JSON.stringify({
      migrated: true,
      added,
      createdSeries,
      linked: Number(countRows?.[0]?.linked || 0)
    }, null, 2));
  } finally {
    connection.release();
    await closeMariaDBPool();
  }
}

run().catch(async (error) => {
  console.error(JSON.stringify({
    migrated: false,
    message: error.message
  }, null, 2));
  try {
    await closeMariaDBPool();
  } catch {
    // noop
  }
  process.exit(1);
});
