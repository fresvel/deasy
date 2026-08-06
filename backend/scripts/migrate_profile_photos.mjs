// Migracion one-shot de las fotos de perfil heredadas a MinIO.
//
// Recorre persons.photo_url y sube a MinIO lo que siga viviendo fuera de el:
//   - rutas en disco (uploads/profile_photos/...)
//   - data URI en base64 embebidas en la propia columna
// Las referencias minio:// ya migradas y las URL externas se dejan como estan.
//
// Uso (dentro del contenedor del backend):
//   node scripts/migrate_profile_photos.mjs --dry-run     # solo informa
//   node scripts/migrate_profile_photos.mjs               # migra
//   node scripts/migrate_profile_photos.mjs --delete-source   # ademas borra el fichero de disco
//   node scripts/migrate_profile_photos.mjs --clear-missing   # pone a NULL las referencias rotas
//
// Es idempotente: volver a ejecutarlo no duplica nada porque lo ya migrado empieza
// por minio:// y se salta.
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getPostgresPool, closePostgresPool } from "../config/postgres.js";
import {
  parsePhotoReference,
  resolveLegacyPhotoPath,
  storeProfilePhoto
} from "../services/users/profilePhotoStorage.js";

const options = new Set(process.argv.slice(2));
const DRY_RUN = options.has("--dry-run");
const DELETE_SOURCE = options.has("--delete-source");
const CLEAR_MISSING = options.has("--clear-missing");

const pool = getPostgresPool();

const summary = {
  total: 0,
  yaEnMinio: 0,
  externas: 0,
  migradasDeDisco: 0,
  migradasDeDataUri: 0,
  rotas: 0,
  limpiadas: 0,
  fallidas: 0
};

const problems = [];

const migrateFile = async ({ cedula, filePath }) => {
  if (DRY_RUN) {
    return "(dry-run)";
  }
  const stored = await storeProfilePhoto({ cedula, filePath });
  await pool.query("UPDATE persons SET photo_url = ? WHERE cedula = ?", [stored.reference, cedula]);
  return stored.reference;
};

const migrateLegacyFile = async (person, reference) => {
  const absolutePath = resolveLegacyPhotoPath(reference.relativePath);
  if (!absolutePath || !(await fs.pathExists(absolutePath))) {
    summary.rotas += 1;
    problems.push(`${person.cedula}: fichero inexistente (${reference.relativePath})`);
    if (CLEAR_MISSING && !DRY_RUN) {
      await pool.query("UPDATE persons SET photo_url = NULL WHERE cedula = ?", [person.cedula]);
      summary.limpiadas += 1;
    }
    return;
  }

  const stored = await migrateFile({ cedula: person.cedula, filePath: absolutePath });
  summary.migradasDeDisco += 1;
  console.log(`  ${person.cedula}: ${reference.relativePath} -> ${stored}`);

  if (DELETE_SOURCE && !DRY_RUN) {
    await fs.remove(absolutePath);
  }
};

const migrateDataUri = async (person, reference) => {
  const buffer = Buffer.from(reference.payload, reference.isBase64 ? "base64" : "utf8");
  if (!buffer.length) {
    summary.rotas += 1;
    problems.push(`${person.cedula}: data URI vacia`);
    return;
  }

  const tempPath = path.join(os.tmpdir(), `photo-migration-${randomUUID()}`);
  try {
    await fs.writeFile(tempPath, buffer);
    const stored = await migrateFile({ cedula: person.cedula, filePath: tempPath });
    summary.migradasDeDataUri += 1;
    console.log(`  ${person.cedula}: data URI (${buffer.length} B) -> ${stored}`);
  } finally {
    await fs.remove(tempPath).catch(() => {});
  }
};

const run = async () => {
  const [rows] = await pool.query(
    `SELECT cedula, photo_url
       FROM persons
      WHERE photo_url IS NOT NULL AND photo_url <> ''
      ORDER BY id`
  );

  summary.total = rows.length;
  console.log(
    `Fotos a revisar: ${rows.length}${DRY_RUN ? " (dry-run: no se escribe nada)" : ""}`
  );

  for (const person of rows) {
    const reference = parsePhotoReference(person.photo_url);
    try {
      if (!reference || reference.kind === "minio") {
        summary.yaEnMinio += 1;
        continue;
      }
      if (reference.kind === "external") {
        summary.externas += 1;
        problems.push(`${person.cedula}: URL externa, se deja sin tocar (${reference.url})`);
        continue;
      }
      if (reference.kind === "legacy-file") {
        await migrateLegacyFile(person, reference);
        continue;
      }
      if (reference.kind === "data-uri") {
        await migrateDataUri(person, reference);
      }
    } catch (error) {
      summary.fallidas += 1;
      problems.push(`${person.cedula}: ${error?.message || error}`);
    }
  }

  console.log("\nResumen:");
  for (const [key, value] of Object.entries(summary)) {
    console.log(`  ${key}: ${value}`);
  }

  if (problems.length) {
    console.log("\nIncidencias:");
    problems.forEach((problem) => console.log(`  - ${problem}`));
  }

  // Salida distinta de 0 solo si algo fallo de verdad: las rotas y las externas son
  // informativas y no deben tumbar un despliegue.
  return summary.fallidas === 0 ? 0 : 1;
};

run()
  .then(async (exitCode) => {
    await closePostgresPool();
    process.exit(exitCode);
  })
  .catch(async (error) => {
    console.error("La migración de fotos falló:", error);
    await closePostgresPool();
    process.exit(1);
  });
