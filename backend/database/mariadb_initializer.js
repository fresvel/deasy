import mysql from "mysql2/promise";
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

const ADD_PHOTO_COLUMN_SQL = `
ALTER TABLE users
ADD COLUMN IF NOT EXISTS photo_url LONGTEXT DEFAULT NULL;
`;

const MODIFY_PHOTO_COLUMN_SQL = `
ALTER TABLE users
MODIFY COLUMN photo_url LONGTEXT DEFAULT NULL;
`;

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
    await connection.query(ADD_PHOTO_COLUMN_SQL);
    await connection.query(MODIFY_PHOTO_COLUMN_SQL);
    console.log("✅ Tabla 'users' verificada/creada en MariaDB");
  } finally {
    connection.release();
  }
};

