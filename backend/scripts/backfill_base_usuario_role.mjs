import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const mysql = backendRequire("mysql2/promise");

const envPath = path.join(backendRoot, ".env");

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
  const required = ["MARIADB_HOST", "MARIADB_PORT", "MARIADB_USER", "MARIADB_PASSWORD", "MARIADB_DATABASE"];
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

// Asigna el rol base "Usuario" a toda persona activa que no lo tenga. El rol "Usuario" gobierna el dossier personal
// (dossier.read/create/update); sin él, una persona con solo roles funcionales (Gestor*) recibe 403 al cargar su
// propio dossier en Home. La unidad del nuevo vínculo se toma de un rol vigente de la persona, o de la primera unidad
// como respaldo. Idempotente: el UNIQUE (person_id, role_id, unit_id, source, current_flag) + NOT EXISTS evitan duplicados.
const main = async () => {
  await loadEnv();
  const connection = await mysql.createConnection(getConfig());
  try {
    const [roleRows] = await connection.query(
      "SELECT id FROM roles WHERE name = 'Usuario' AND is_active = 1 LIMIT 1"
    );
    const usuarioRoleId = roleRows?.[0]?.id;
    if (!usuarioRoleId) {
      console.warn("⚠️  No existe el rol 'Usuario' activo; no se realizó backfill.");
      return;
    }

    const [result] = await connection.query(
      `INSERT IGNORE INTO role_assignments
         (role_id, unit_id, source, person_id, max_depth, start_date, is_current, assigned_at)
       SELECT
         ?,
         COALESCE(
           (SELECT ra2.unit_id FROM role_assignments ra2
              WHERE ra2.person_id = p.id AND ra2.is_current = 1
              ORDER BY ra2.id LIMIT 1),
           (SELECT id FROM units ORDER BY id LIMIT 1)
         ),
         'manual', p.id, 0, CURDATE(), 1, NOW()
       FROM persons p
       WHERE p.is_active = 1
         AND NOT EXISTS (
           SELECT 1 FROM role_assignments ra
             INNER JOIN roles r ON r.id = ra.role_id
             WHERE ra.person_id = p.id AND ra.is_current = 1 AND r.name = 'Usuario'
         )`,
      [usuarioRoleId]
    );

    console.log(`✅ Rol base 'Usuario' asignado a ${result.affectedRows} persona(s).`);
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo asignar el rol base 'Usuario': ${error.message}`);
  process.exitCode = 1;
});
