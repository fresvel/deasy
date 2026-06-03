#!/usr/bin/env node
// Siembra (idempotente) el proceso raíz "General" para tareas libres/derivadas (Fase B).
// - processes: 'general' (parent_id NULL)
// - process_definition_series: serie 'general'
// - process_definition_versions: definición activa "Tarea general"
// - template_artifacts: contenedor genérico (artifact_origin='general', sin render real)
// - process_definition_templates: vincula la definición con el contenedor (creates_task=1)
// - process_definition_triggers: manual_custom_term (permite tareas manuales con periodo propio)
// - process_target_rules: all_units (cualquier unidad puede usarlo)

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const mysql = backendRequire("mysql2/promise");

const parseEnvFile = (filePath) => {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
};

const env = { ...parseEnvFile(path.join(backendRoot, ".env")), ...process.env };

const GENERAL_SLUG = "general";
const GENERAL_SERIES_CODE = "general";
const GENERAL_TEMPLATE_CODE = "tpl_general_tarea_libre";
const GENERAL_VARIATION = "general";
const GENERAL_DEFINITION_VERSION = "1.0.0";

const fetchOne = async (conn, sql, params = []) => {
  const [rows] = await conn.query(sql, params);
  return rows?.[0] ?? null;
};

async function run() {
  const conn = await mysql.createConnection({
    host: env.MARIADB_HOST || "127.0.0.1",
    port: Number(env.MARIADB_PORT || 3306),
    user: env.MARIADB_USER,
    password: env.MARIADB_PASSWORD,
    database: env.MARIADB_DATABASE,
    multipleStatements: false,
  });

  try {
    await conn.beginTransaction();

    // 1. processes
    let process = await fetchOne(conn, `SELECT id FROM processes WHERE slug = ? LIMIT 1`, [GENERAL_SLUG]);
    if (!process) {
      const [r] = await conn.query(
        `INSERT INTO processes (name, slug, parent_id, is_active) VALUES (?, ?, NULL, 1)`,
        ["General", GENERAL_SLUG]
      );
      process = { id: r.insertId };
    }
    const processId = process.id;

    // 2. process_definition_series
    let series = await fetchOne(conn, `SELECT id FROM process_definition_series WHERE code = ? LIMIT 1`, [GENERAL_SERIES_CODE]);
    if (!series) {
      const [r] = await conn.query(
        `INSERT INTO process_definition_series (source_type, unit_type_id, cargo_id, code, is_active)
         VALUES ('legacy', NULL, NULL, ?, 1)`,
        [GENERAL_SERIES_CODE]
      );
      series = { id: r.insertId };
    }
    const seriesId = series.id;

    // 3. process_definition_versions (active)
    let definition = await fetchOne(
      conn,
      `SELECT id, status FROM process_definition_versions
       WHERE process_id = ? AND variation_key = ? AND definition_version = ? LIMIT 1`,
      [processId, GENERAL_VARIATION, GENERAL_DEFINITION_VERSION]
    );
    if (!definition) {
      const [r] = await conn.query(
        `INSERT INTO process_definition_versions
          (process_id, series_id, variation_key, definition_version, name, description,
           has_document, status, effective_from)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'active', CURDATE())`,
        [processId, seriesId, GENERAL_VARIATION, GENERAL_DEFINITION_VERSION,
         "Tarea general", "Tareas libres y derivaciones sin clasificar."]
      );
      definition = { id: r.insertId, status: "active" };
    } else if (definition.status !== "active") {
      await conn.query(`UPDATE process_definition_versions SET status = 'active' WHERE id = ?`, [definition.id]);
    }
    const definitionId = definition.id;

    // 4. template_artifacts (contenedor genérico, sin render real)
    let artifact = await fetchOne(
      conn,
      `SELECT id FROM template_artifacts WHERE template_code = ? AND storage_version = 'v0001' LIMIT 1`,
      [GENERAL_TEMPLATE_CODE]
    );
    if (!artifact) {
      const [r] = await conn.query(
        `INSERT INTO template_artifacts
          (template_seed_id, owner_person_id, template_code, display_name, description, owner_ref,
           source_version, storage_version, artifact_origin, artifact_stage, bucket, base_object_prefix,
           available_formats, schema_object_key, meta_object_key, is_active)
         VALUES (NULL, NULL, ?, ?, ?, NULL, '1.0.0', 'v0001', 'general', 'published',
                 'deasy-documents', ?, ?, ?, ?, 1)`,
        [
          GENERAL_TEMPLATE_CODE,
          "Tarea general",
          "Contenedor de tarea libre: título, descripción y anexos.",
          `System/${GENERAL_TEMPLATE_CODE}/v0001/`,
          JSON.stringify({}),
          `System/${GENERAL_TEMPLATE_CODE}/v0001/schema.json`,
          `System/${GENERAL_TEMPLATE_CODE}/v0001/meta.yaml`,
        ]
      );
      artifact = { id: r.insertId };
    }
    const artifactId = artifact.id;

    // 5. process_definition_templates (vínculo, creates_task=1, sin requerir documento renderizado)
    let pdt = await fetchOne(
      conn,
      `SELECT id FROM process_definition_templates
       WHERE process_definition_id = ? AND template_artifact_id = ? AND usage_role = 'primary' LIMIT 1`,
      [definitionId, artifactId]
    );
    if (!pdt) {
      const [r] = await conn.query(
        `INSERT INTO process_definition_templates
          (process_definition_id, template_artifact_id, usage_role, instance_mode, creates_task, is_required, sort_order)
         VALUES (?, ?, 'primary', 'single_document', 1, 1, 1)`,
        [definitionId, artifactId]
      );
      pdt = { id: r.insertId };
    }

    // 6. process_definition_triggers (manual_custom_term)
    const trigger = await fetchOne(
      conn,
      `SELECT id FROM process_definition_triggers
       WHERE process_definition_id = ? AND trigger_mode = 'manual_custom_term' AND normalized_term_type_id = 0 LIMIT 1`,
      [definitionId]
    );
    if (!trigger) {
      await conn.query(
        `INSERT INTO process_definition_triggers (process_definition_id, trigger_mode, term_type_id, is_active)
         VALUES (?, 'manual_custom_term', NULL, 1)`,
        [definitionId]
      );
    }

    // 7. process_target_rules (all_units)
    const rule = await fetchOne(
      conn,
      `SELECT id FROM process_target_rules
       WHERE process_definition_id = ? AND unit_scope_type = 'all_units' LIMIT 1`,
      [definitionId]
    );
    if (!rule) {
      await conn.query(
        `INSERT INTO process_target_rules
          (process_definition_id, unit_scope_type, recipient_policy, priority, is_active)
         VALUES (?, 'all_units', 'all_matches', 1, 1)`,
        [definitionId]
      );
    }

    await conn.commit();
    console.log("✅ Proceso General sembrado.");
    console.log(`   process_id=${processId} definition_id=${definitionId} template_artifact_id=${artifactId}`);
  } catch (error) {
    await conn.rollback();
    console.error("❌ Error sembrando proceso General:", error.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

run();
