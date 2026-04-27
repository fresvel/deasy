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

async function run() {
  const connection = await pool.getConnection();
  try {
    const added = [];

    if (!(await columnExists(connection, "task_items", "start_date"))) {
      await connection.query(
        "ALTER TABLE task_items ADD COLUMN start_date DATE NULL AFTER assigned_person_id"
      );
      added.push("start_date");
    }

    if (!(await columnExists(connection, "task_items", "end_date"))) {
      await connection.query(
        "ALTER TABLE task_items ADD COLUMN end_date DATE NULL AFTER start_date"
      );
      added.push("end_date");
    }

    if (!(await columnExists(connection, "task_items", "user_started_at"))) {
      await connection.query(
        "ALTER TABLE task_items ADD COLUMN user_started_at DATETIME NULL AFTER end_date"
      );
      added.push("user_started_at");
    }

    if (!(await indexExists(connection, "task_items", "idx_task_items_dates"))) {
      await connection.query(
        "ALTER TABLE task_items ADD INDEX idx_task_items_dates (start_date, end_date)"
      );
      added.push("idx_task_items_dates");
    }

    if (!(await indexExists(connection, "task_items", "idx_task_items_user_started"))) {
      await connection.query(
        "ALTER TABLE task_items ADD INDEX idx_task_items_user_started (user_started_at)"
      );
      added.push("idx_task_items_user_started");
    }

    const [backfillResult] = await connection.query(
      `UPDATE task_items ti
       INNER JOIN tasks t ON t.id = ti.task_id
       SET ti.start_date = COALESCE(ti.start_date, t.start_date),
           ti.end_date = COALESCE(ti.end_date, t.end_date)
       WHERE ti.start_date IS NULL
          OR ti.end_date IS NULL`
    );

    await connection.query(
      "ALTER TABLE task_items MODIFY COLUMN start_date DATE NOT NULL"
    );

    const [pendingRows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM task_items
       WHERE start_date IS NULL`
    );

    console.log(JSON.stringify({
      migrated: true,
      added,
      backfilled: Number(backfillResult?.affectedRows || 0),
      pending_start_dates: Number(pendingRows?.[0]?.total || 0)
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
