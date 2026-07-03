// Characterization: capa de EJECUCIÓN (datos generados vía API por el setup).
//
// REQUIERE haber corrido antes: seed baseline + setup/seed_execution.mjs (que
// crea 1 tarea routed con su entregable y flujo de firma). Estos son los golden
// con "dientes": ejercitan los JOINs y lecturas SQL más sensibles a la
// migración de dialecto a PostgreSQL, sobre datos reales no vacíos.
//
// Si el setup no corrió, estos tests fallan por count=0 — es señal de que falta
// el paso de enriquecimiento, no una regresión.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape, listFingerprint } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "execution";
// Rutas de almacenamiento y hashes son volátiles/infra: enmascarar.
const STORAGE_MASK = [
  "working_file_path", "final_file_path", "payload_object_path", "payload_hash",
  "payload_mongo_id", "base_object_prefix", "schema_object_key", "meta_object_key",
  "url", "signedUrl", "downloadUrl", "path",
  // El nombre del term ad-hoc creado por general-task lleva un sufijo aleatorio
  // (p.ej. "...· #3-mr528azz") → no determinista.
  "term_name",
];
// Snapshots de objeto: además de rutas/hashes, enmascaramos genéricamente TODAS
// las claves id/_id/*Id (maskIdKeys) porque los auto-increment de la capa de
// ejecución derivan entre reseeds. El contrato de columnas por tabla lo fijan
// los tests sql_* (listFingerprint), aquí importa la forma del JOIN y los
// valores no-id (nombres, estados).
const OBJ_OPTS = { extraMask: STORAGE_MASK, maskIdKeys: true };

before(async () => {
  await waitForReady();
});

// --- Contrato de columnas de las tablas de ejecución (admin sql CRUD) ---
// Cada una debe estar poblada (count>=1) tras el setup.
const EXEC_TABLES = [
  "tasks", "task_items", "documents", "document_versions",
  "signature_flow_templates", "signature_flow_steps",
];

for (const table of EXEC_TABLES) {
  test(`GET /admin/sql/${table} -> poblado (contrato de columnas)`, async () => {
    const token = await tokenFor("admin");
    const res = await get(`/admin/sql/${table}`, { token });
    const fp = listFingerprint(res);
    assert.ok(fp.count >= 1, `${table} vacío: ¿corriste setup/seed_execution.mjs?`);
    matchSnapshot(SUITE, `sql_${table}`, fp);
  });
}

// --- Lecturas de usuario con datos reales de JOIN ---

test("GET /users/3/document-center (dueño) -> entregable con JOIN", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/users/3/document-center", { token });
  matchSnapshot(SUITE, "document_center_usuario", snapshotShape(res, OBJ_OPTS));
});

test("GET /users/3/signature-center (dueño) -> centro de firmas", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/users/3/signature-center", { token });
  matchSnapshot(SUITE, "signature_center_usuario", snapshotShape(res, OBJ_OPTS));
});

// Snapshot de firma sobre el document_version generado. El id se resuelve
// dinámicamente (robusto a que AUTO_INCREMENT no siempre reinicie).
test("GET /sign/documents/:dv/signature-flow -> snapshot de firma", async () => {
  const admin = await tokenFor("admin");
  const dvs = await get("/admin/sql/document_versions", { token: admin });
  const rows = Array.isArray(dvs.body) ? dvs.body : dvs.body?.data ?? dvs.body?.rows;
  const dvId = rows?.[0]?.id;
  assert.ok(dvId, "no hay document_version: ¿corriste el setup?");

  const res = await get(`/sign/documents/${dvId}/signature-flow`, { token: admin });
  matchSnapshot(SUITE, "signature_flow_snapshot", snapshotShape(res, OBJ_OPTS));
});
