import { getMariaDBPool, closeMariaDBPool } from "../config/mariadb.js";

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

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
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

    if (!(await columnExists(connection, "template_artifacts", "owner_person_id"))) {
      await connection.query(
        "ALTER TABLE template_artifacts ADD COLUMN owner_person_id INT NULL AFTER template_seed_id"
      );
      added.push("owner_person_id");
    }

    if (!(await indexExists(connection, "template_artifacts", "idx_template_artifacts_owner_person"))) {
      await connection.query(
        "ALTER TABLE template_artifacts ADD INDEX idx_template_artifacts_owner_person (owner_person_id)"
      );
      added.push("idx_template_artifacts_owner_person");
    }

    await connection.query(
      `UPDATE template_artifacts ta
       JOIN persons p ON p.cedula = ta.owner_ref
       SET ta.owner_person_id = p.id
       WHERE ta.owner_person_id IS NULL
         AND ta.owner_ref IS NOT NULL
         AND ta.owner_ref <> ''`
    );

    if (!(await foreignKeyExists(connection, "template_artifacts", "fk_template_artifacts_owner_person"))) {
      await connection.query(
        `ALTER TABLE template_artifacts
         ADD CONSTRAINT fk_template_artifacts_owner_person
         FOREIGN KEY (owner_person_id) REFERENCES persons(id)`
      );
      added.push("fk_template_artifacts_owner_person");
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS linked
       FROM template_artifacts
       WHERE owner_person_id IS NOT NULL`
    );

    console.log(JSON.stringify({
      migrated: true,
      added,
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
