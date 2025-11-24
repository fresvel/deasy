import mysql from "mysql2/promise";

const REQUIRED_ENV_VARS = ["MARIADB_HOST", "MARIADB_PORT", "MARIADB_USER", "MARIADB_PASSWORD", "MARIADB_DATABASE"];

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length) {
  console.warn(
    `⚠️  Configuración MariaDB incompleta. Variables faltantes: ${missingEnvVars.join(", ")}`
  );
}

const baseConfig = {
  host: process.env.MARIADB_HOST,
  port: Number(process.env.MARIADB_PORT),
  user: process.env.MARIADB_USER,
  password: process.env.MARIADB_PASSWORD,
  timezone: process.env.MARIADB_TIMEZONE || "Z"
};

const databaseName = process.env.MARIADB_DATABASE;

const pool = missingEnvVars.length
  ? null
  : mysql.createPool({
      ...baseConfig,
      database: databaseName,
      waitForConnections: true,
      connectionLimit: Number(process.env.MARIADB_CONNECTION_LIMIT || 10),
      queueLimit: 0
    });

export const getMariaDBPool = () => pool;
export const getMariaDBDatabaseName = () => databaseName;
export const getMariaDBBaseConfig = () => baseConfig;

export const assertMariaDBConnection = async () => {
  if (!pool) {
    throw new Error(
      "La conexión a MariaDB no está configurada correctamente. Revisa las variables de entorno."
    );
  }

  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
};

