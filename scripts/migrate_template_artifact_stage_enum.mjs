import { getMariaDBPool, closeMariaDBPool } from "../backend/config/mariadb.js";

const pool = getMariaDBPool();

async function run() {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      `ALTER TABLE template_artifacts
       MODIFY COLUMN artifact_stage
       ENUM('draft','review','approved','published','archived')
       NOT NULL DEFAULT 'published'`
    );

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM template_artifacts`
    );

    console.log(JSON.stringify({
      migrated: true,
      total: Number(rows?.[0]?.total || 0)
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
