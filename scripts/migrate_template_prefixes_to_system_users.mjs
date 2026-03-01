#!/usr/bin/env node
import fs from "fs";
import path from "path";
import mysql from "../backend/node_modules/mysql2/promise.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(REPO_ROOT, "backend", ".env");

const parseEnvFile = (filePath) => {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    env[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
  }
  return env;
};

const rewritePrefix = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }
  return value
    .replace(/^PlantillasUsuario\//, "Users/")
    .replace(/^Plantillas\//, "System/");
};

const rewriteAvailableFormats = (value) => {
  if (!value) {
    return value;
  }
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return value;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return value;
  }
  for (const formats of Object.values(parsed)) {
    if (!formats || typeof formats !== "object" || Array.isArray(formats)) {
      continue;
    }
    for (const metadata of Object.values(formats)) {
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        continue;
      }
      if (metadata.entry_object_key) {
        metadata.entry_object_key = rewritePrefix(metadata.entry_object_key);
      }
    }
  }
  return JSON.stringify(parsed);
};

const main = async () => {
  const fileEnv = parseEnvFile(ENV_PATH);
  const connection = await mysql.createConnection({
    host: process.env.MARIADB_HOST || fileEnv.MARIADB_HOST || "localhost",
    port: Number(process.env.MARIADB_PORT || fileEnv.MARIADB_PORT || 3306),
    user: process.env.MARIADB_USER || fileEnv.MARIADB_USER || "deasy",
    password: process.env.MARIADB_PASSWORD || fileEnv.MARIADB_PASSWORD || "",
    database: process.env.MARIADB_DATABASE || fileEnv.MARIADB_DATABASE || "deasy",
    timezone: "Z"
  });

  let updated = 0;
  try {
    const [rows] = await connection.query(
      `SELECT id, base_object_prefix, schema_object_key, meta_object_key, available_formats
       FROM template_artifacts`
    );

    for (const row of rows) {
      const nextBase = rewritePrefix(row.base_object_prefix);
      const nextSchema = rewritePrefix(row.schema_object_key);
      const nextMeta = rewritePrefix(row.meta_object_key);
      const nextFormats = rewriteAvailableFormats(row.available_formats);

      const currentFormats = typeof row.available_formats === "string"
        ? row.available_formats
        : JSON.stringify(row.available_formats);

      if (
        nextBase === row.base_object_prefix
        && nextSchema === row.schema_object_key
        && nextMeta === row.meta_object_key
        && nextFormats === currentFormats
      ) {
        continue;
      }

      await connection.query(
        `UPDATE template_artifacts
         SET base_object_prefix = ?,
             schema_object_key = ?,
             meta_object_key = ?,
             available_formats = ?
         WHERE id = ?`,
        [nextBase, nextSchema, nextMeta, nextFormats, row.id]
      );
      updated += 1;
    }

    console.log(JSON.stringify({ updated }, null, 2));
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
