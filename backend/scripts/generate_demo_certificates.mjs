// Genera certificados PKCS#12 autofirmados para probar el flujo de firma con el signer.
// La UI solo permite SUBIR un .p12 ya existente (`/perfil` → Certificados), nunca generarlo,
// así que sin esto hay que fabricarlos a mano uno por uno.
//
//   node scripts/generate_demo_certificates.mjs                 # solo a quien no tenga ninguno
//   node scripts/generate_demo_certificates.mjs --force         # reemite a todo el mundo
//   node scripts/generate_demo_certificates.mjs --person 1122334459   # una persona (cédula o id)
//
// POR QUÉ EXISTE --force. `reset.mjs storage` vacía el bucket `deasy-certificates` pero NO
// borra las filas de `person_certificates`. Sin --force, el filtro por defecto
// (HAVING COUNT = 0) da por "atendidas" a esas personas y no regenera nada: se quedan con un
// certificado que la UI oculta porque su objeto ya no está en MinIO, y sin forma de recuperarlo.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { closePostgresPool, getPostgresPool } from "../config/postgres.js";
import UserCertificateRepository from "../services/auth/UserCertificateRepository.js";
import { ensureBucketExists, uploadFileToMinio } from "../services/storage/minio_service.js";

const execFileAsync = promisify(execFile);

const MINIO_CERTIFICATES_BUCKET = process.env.MINIO_CERTIFICATES_BUCKET || "deasy-certificates";
const CERT_PASSWORD = "Demo1234!";
const CERT_LABEL = "Demo Autofirmado";
const CERT_VALID_DAYS = 3650;

const certificateRepository = new UserCertificateRepository();
const pool = getPostgresPool();

if (!pool) {
  throw new Error("La conexión PostgreSQL no está configurada. Ejecuta este script en un entorno con variables backend cargadas.");
}

const sanitizeFileName = (value) =>
  String(value || "certificate.p12")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");

const escapeDnValue = (value) =>
  String(value || "")
    .replace(/[\\"]/g, "\\$&")
    .replace(/[,+<>;]/g, " ");

const buildSubject = (person) => {
  const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || `Persona ${person.id}`;
  return `/C=EC/O=PUCESE/OU=DEASY DEMO/CN=${escapeDnValue(fullName)}/emailAddress=${escapeDnValue(person.email || `demo.${person.cedula}@pucese.edu.ec`)}/serialNumber=${escapeDnValue(person.cedula || person.id)}`;
};

const parseArgs = () => {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const index = argv.indexOf("--person");
  const person = index >= 0 ? argv[index + 1] : null;
  if (index >= 0 && !person) {
    throw new Error("Falta el valor de --person (cédula o id).");
  }
  return { force, person };
};

// Sin --force solo se atiende a quien no tenga NINGÚN certificado. Con --force se reemite a
// todos los que casen con el filtro, degradando antes su default (ver clearDefaultForPerson).
const listTargetPeople = async ({ force, person }) => {
  const params = [];
  let filter = "";
  if (person) {
    // La cédula es varchar y el id int: se acepta cualquiera de los dos como referencia.
    const asId = Number(person);
    filter = "WHERE d.numero = ? OR p.id = ?";
    params.push(String(person), Number.isSafeInteger(asId) && asId <= 2147483647 ? asId : 0);
  }
  const [rows] = await pool.query(
    `SELECT p.id,
            d.numero AS cedula,
            p.first_name,
            p.last_name,
            e.direccion AS email,
            COUNT(pc.id) AS certificate_count
       FROM persons p
       LEFT JOIN emails e ON e.person_id = p.id AND e.principal = 1 AND e.is_active = 1
       LEFT JOIN documentos_identidad d ON d.person_id = p.id AND d.principal = 1 AND d.is_active = 1
       LEFT JOIN person_certificates pc ON pc.person_id = p.id
      ${filter}
      GROUP BY p.id, d.numero, p.first_name, p.last_name, e.direccion
      ${force ? "" : "HAVING COUNT(pc.id) = 0"}
      ORDER BY p.id`,
    params
  );
  return rows;
};

const createPkcs12ForPerson = async (person) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `deasy-demo-cert-${person.cedula || person.id}-`));
  const keyPath = path.join(tempDir, "private.key");
  const certPath = path.join(tempDir, "certificate.crt");
  const p12Path = path.join(tempDir, "certificate.p12");

  try {
    await execFileAsync("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-keyout",
      keyPath,
      "-out",
      certPath,
      "-days",
      String(CERT_VALID_DAYS),
      "-nodes",
      "-subj",
      buildSubject(person)
    ]);

    await execFileAsync("openssl", [
      "pkcs12",
      "-export",
      "-out",
      p12Path,
      "-inkey",
      keyPath,
      "-in",
      certPath,
      "-passout",
      `pass:${CERT_PASSWORD}`,
      "-name",
      `${CERT_LABEL} ${person.cedula || person.id}`
    ]);

    return { tempDir, p12Path };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
};

const registerCertificate = async (person, p12Path) => {
  const originalFilename = sanitizeFileName(`demo_autofirmado_${person.cedula || person.id}.p12`);
  const objectName = `users/${person.cedula}/certificates/${Date.now()}-${originalFilename}`;

  await ensureBucketExists(MINIO_CERTIFICATES_BUCKET);
  await uploadFileToMinio(MINIO_CERTIFICATES_BUCKET, objectName, p12Path, {
    "Content-Type": "application/x-pkcs12"
  });

  return certificateRepository.create({
    person_id: person.id,
    label: CERT_LABEL,
    original_filename: originalFilename,
    bucket: MINIO_CERTIFICATES_BUCKET,
    object_name: objectName,
    is_default: 1
  });
};

const main = async () => {
  const options = parseArgs();
  const people = await listTargetPeople(options);
  if (!people.length) {
    if (options.person && !options.force) {
      // Distinguir "no existe" de "existe pero ya tiene certificado": sin esto el mensaje
      // acusa de referencia inválida a una cédula perfectamente válida.
      const existing = await listTargetPeople({ ...options, force: true });
      console.log(
        existing.length
          ? `'${options.person}' ya tiene certificado. Usa --force para reemitir.`
          : `No se encontró ninguna persona con la referencia '${options.person}'.`
      );
    } else if (options.person) {
      console.log(`No se encontró ninguna persona con la referencia '${options.person}'.`);
    } else {
      console.log("No hay personas sin certificados. No se generó nada. Usa --force para reemitir.");
    }
    console.log(`Contraseña esperada para certificados demo: ${CERT_PASSWORD}`);
    return;
  }

  console.log(`Se generarán certificados demo autofirmados para ${people.length} persona(s).`);

  const failures = [];
  for (const person of people) {
    const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    // Un fallo aislado (openssl, MinIO) no debe abortar el lote: se anota y se sigue.
    try {
      // Reemisión: el certificado anterior deja de ser el default, pero NO se borra — su
      // objeto en MinIO puede seguir referenciado por firmas ya hechas.
      if (Number(person.certificate_count) > 0) {
        await certificateRepository.clearDefaultForPerson(person.id);
      }
      const { tempDir, p12Path } = await createPkcs12ForPerson(person);
      try {
        const created = await registerCertificate(person, p12Path);
        console.log(
          `OK person_id=${person.id} cedula=${person.cedula} nombre="${fullName}" certificate_id=${created.id} object=${created.object_name}`
        );
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    } catch (error) {
      failures.push({ person, message: error?.message || String(error) });
      console.error(`FALLO person_id=${person.id} cedula=${person.cedula}: ${error?.message || error}`);
    }
  }

  console.log(`Contraseña de todos los certificados demo generados: ${CERT_PASSWORD}`);
  if (failures.length) {
    console.error(`❌ ${failures.length} de ${people.length} fallaron.`);
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error("Error generando certificados demo:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool().catch(() => {});
  });
