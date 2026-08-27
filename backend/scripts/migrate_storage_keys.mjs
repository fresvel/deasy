import "dotenv/config";

// Mueve en MinIO los objetos que colgaban de la CEDULA a colgar del ID de la persona.
//
// POR QUE EXISTE. Hasta el 2026-08-27 tres rutas usaban la cedula como segmento:
//
//   deasy-documents  users/<cedula>/validation/...   y   users/<cedula>/signed/...
//   deasy-dossier    <prefijo>/users/<cedula>/<tipo>/<id>.pdf
//   deasy-templates  Users/<cedula>/AdHoc/...
//
// Eso convierte un identificador QUE PUEDE CAMBIAR -un pasaporte se renueva con numero nuevo, un
// extranjero se nacionaliza y obtiene cedula- en la direccion de los ficheros de una persona.
// `persons.id` no cambia nunca.
//
// El codigo nuevo ya escribe bajo el id. Este script mueve lo que quedo escrito antes.
//
//   node scripts/migrate_storage_keys.mjs           enumera lo que MOVERIA, sin tocar nada
//   node scripts/migrate_storage_keys.mjs --apply   lo mueve de verdad
//
// Es IDEMPOTENTE: un objeto que ya cuelga de un id no casa con ninguna cedula conocida y se ignora.
// Y COPIA ANTES DE BORRAR, para que un fallo a mitad no pierda ficheros.

import { getPostgresPool } from "../config/postgres.js";
import { minioClient } from "../services/storage/minio_service.js";

const APLICAR = process.argv.includes("--apply");

const BUCKETS = [
  { bucket: process.env.MINIO_BUCKET_DOCUMENTS || "deasy-documents", patron: /^users\/([^/]+)\// },
  { bucket: process.env.MINIO_BUCKET_DOSSIER || "deasy-dossier", patron: /^(?:[^/]+\/)?users\/([^/]+)\// },
  { bucket: process.env.MINIO_BUCKET_TEMPLATES || "deasy-templates", patron: /^Users\/([^/]+)\// },
];

const listarObjetos = (bucket) =>
  new Promise((resolve, reject) => {
    const nombres = [];
    const flujo = minioClient.listObjectsV2(bucket, "", true);
    flujo.on("data", (obj) => obj?.name && nombres.push(obj.name));
    flujo.on("error", reject);
    flujo.on("end", () => resolve(nombres));
  });

const main = async () => {
  const pool = getPostgresPool();
  const [personas] = await pool.query("SELECT id, cedula FROM persons WHERE cedula IS NOT NULL");
  // El indice va de CEDULA a id. Una cedula que no este aqui no se toca: puede ser un id ya migrado
  // o algo que no sabemos leer, y en los dos casos lo correcto es no inventar.
  const porCedula = new Map(personas.map((p) => [String(p.cedula), Number(p.id)]));
  const ids = new Set(personas.map((p) => String(p.id)));

  let movidos = 0;
  let ignorados = 0;

  for (const { bucket, patron } of BUCKETS) {
    let objetos;
    try {
      objetos = await listarObjetos(bucket);
    } catch (error) {
      console.log(`· ${bucket}: no accesible (${error.message}); se omite`);
      continue;
    }

    for (const nombre of objetos) {
      const casa = patron.exec(nombre);
      if (!casa) continue;
      const segmento = casa[1];
      if (ids.has(segmento) && !porCedula.has(segmento)) {
        ignorados += 1;
        continue; // ya cuelga de un id
      }
      const personId = porCedula.get(segmento);
      if (!personId) {
        ignorados += 1;
        continue;
      }
      if (String(personId) === segmento) {
        ignorados += 1;
        continue;
      }
      const destino = nombre.replace(casa[0], casa[0].replace(segmento, String(personId)));
      if (!APLICAR) {
        console.log(`  ${bucket}: ${nombre}\n            -> ${destino}`);
        movidos += 1;
        continue;
      }
      // Copiar y LUEGO borrar: si el proceso muere en medio, el fichero sigue estando.
      await minioClient.copyObject(bucket, destino, `/${bucket}/${nombre}`);
      await minioClient.removeObject(bucket, nombre);
      movidos += 1;
      console.log(`  movido ${bucket}: ${nombre} -> ${destino}`);
    }
  }

  console.log("");
  console.log(APLICAR ? `✓ ${movidos} objeto(s) movido(s), ${ignorados} ya en su sitio.`
                      : `· ${movidos} objeto(s) se moverian, ${ignorados} ya en su sitio.`);
  if (!APLICAR && movidos) {
    console.log("  Repite con --apply para moverlos.");
  }
  await pool.end?.();
};

main().catch((error) => {
  console.error("✖ Falló la migración de claves de almacenamiento:", error);
  process.exit(1);
});
