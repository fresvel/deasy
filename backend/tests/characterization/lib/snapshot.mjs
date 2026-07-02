// Motor de golden-master. Sin dependencias externas.
//
// - En modo "update" (SNAPSHOT_MODE=update) escribe/actualiza el snapshot y pasa.
// - En modo "compare" (por defecto) lee el snapshot y lo compara; si no existe,
//   FALLA pidiendo que primero se capture el golden contra el sistema actual.
//
// Los snapshots se guardan como JSON legible bajo __snapshots__/<suite>.json,
// una clave por caso. JSON versionable → el diff en git ES la evidencia de un
// cambio de comportamiento durante la migración/refactor.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { SNAPSHOT_MODE } from "../config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = join(__dirname, "..", "__snapshots__");

function fileFor(suite) {
  return join(SNAP_DIR, `${suite}.json`);
}

function load(suite) {
  const file = fileFor(suite);
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, "utf8"));
}

function save(suite, data) {
  mkdirSync(SNAP_DIR, { recursive: true });
  const ordered = Object.fromEntries(Object.keys(data).sort().map((k) => [k, data[k]]));
  writeFileSync(fileFor(suite), `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
}

// matchSnapshot(suite, key, actual)
// `actual` ya debe venir normalizado (ver lib/normalize.mjs).
export function matchSnapshot(suite, key, actual) {
  const store = load(suite);

  if (SNAPSHOT_MODE === "update") {
    store[key] = actual;
    save(suite, store);
    return;
  }

  if (!(key in store)) {
    assert.fail(
      `No hay golden-master para "${suite} :: ${key}". ` +
        `Captúralo primero contra el sistema ACTUAL con SNAPSHOT_MODE=update.`,
    );
  }

  assert.deepEqual(
    actual,
    store[key],
    `Regresión de comportamiento en "${suite} :: ${key}" respecto al golden-master.`,
  );
}
