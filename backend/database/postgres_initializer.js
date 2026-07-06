// Bootstrap del schema PostgreSQL (espejo de mariadb_initializer.js).
//
// El schema (postgres_schema.sql) es IDEMPOTENTE: CREATE TABLE/INDEX IF NOT
// EXISTS, CREATE OR REPLACE FUNCTION/TRIGGER, seeds con ON CONFLICT / WHERE NOT
// EXISTS. Por eso se aplica en cada arranque, igual que la variante MariaDB.
//
// Se usa el protocolo simple de pg (client.query con un string multi-statement
// y SIN parámetros), que ejecuta todas las sentencias en una llamada y respeta
// los bloques $$...$$ de plpgsql — no hace falta trocear.
//
// La base de datos `deasy` la crea el contenedor postgres (POSTGRES_DB), así que
// no hay equivalente de ensureMariaDBDatabase (CREATE DATABASE).

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPostgresPool } from "../config/postgres.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, "postgres_schema.sql");

export const ensurePostgresSchema = async ({ reset = false } = {}) => {
  const wrapped = getPostgresPool();
  if (!wrapped) {
    throw new Error("PostgreSQL no está configurado correctamente. Revisa las variables POSTGRES_*.");
  }
  const pool = wrapped._pool; // Pool crudo de pg (sin la traducción del adaptador)
  const schemaSql = await readFile(SCHEMA_PATH, "utf8");

  const client = await pool.connect();
  try {
    if (reset) {
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    }
    await client.query(schemaSql);
    console.log("✅ Schema PostgreSQL aplicado");
  } finally {
    client.release();
  }
};
