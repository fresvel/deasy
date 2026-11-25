// Bootstrap del schema PostgreSQL.
//
// El schema (postgres_schema.sql) es IDEMPOTENTE: CREATE TABLE/INDEX IF NOT
// EXISTS, CREATE OR REPLACE FUNCTION/TRIGGER, seeds con ON CONFLICT / WHERE NOT
// EXISTS. Por eso se aplica en cada arranque.
//
// Se usa el protocolo simple de pg (client.query con un string multi-statement
// y SIN parámetros), que ejecuta todas las sentencias en una llamada y respeta
// los bloques $$...$$ de plpgsql — no hace falta trocear.
//
// La base de datos `deasy` la crea el contenedor postgres (POSTGRES_DB), así que
// el schema no necesita crear la base (no hay CREATE DATABASE).

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPostgresPool, ESQUEMAS } from "../config/postgres.js";

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
      // ⚠️ SE TIRAN LOS OCHO ESQUEMAS DE TEMA, NO SOLO 'public'.
      //
      // Desde el 2026-10-04 las tablas viven en el esquema de su tema. Un reset que solo tirara
      // 'public' dejaria las 93 tablas con todos sus datos en pie, y el sistema arrancaria
      // creyendo que esta recien instalado sobre una base llena: el bootstrap fallaria con
      // violaciones de unicidad que no explican nada.
      //
      // Se construye de ESQUEMAS y no de una lista escrita aqui, para que no haya un tercer sitio
      // que se quede atras cuando se añada un tema.
      const aTirar = ESQUEMAS.map((e) => `DROP SCHEMA IF EXISTS ${e} CASCADE;`).join(" ");
      await client.query(`${aTirar} CREATE SCHEMA public;`);
    }
    await client.query(schemaSql);
    console.log("✅ Schema PostgreSQL aplicado");
  } finally {
    client.release();
  }
};
