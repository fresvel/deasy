import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

import { closeMariaDBPool, getMariaDBPool } from "../config/mariadb.js";
import UserCertificateRepository from "../services/auth/UserCertificateRepository.js";
import { ensureBucketExists, uploadFileToMinio } from "../services/storage/minio_service.js";

const execFileAsync = promisify(execFile);

const MINIO_CERTIFICATES_BUCKET = process.env.MINIO_CERTIFICATES_BUCKET || "deasy-certificates";
const CERT_PASSWORD = "Demo1234!";
const CERT_LABEL = "Demo Autofirmado";
const CERT_VALID_DAYS = 3650;

const certificateRepository = new UserCertificateRepository();
const pool = getMariaDBPool();

if (!pool) {
  throw new Error("La conexión MariaDB no está configurada. Ejecuta este script en un entorno con variables backend cargadas.");
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

const listTargetPeople = async () => {
  const [rows] = await pool.query(
    `SELECT p.id,
            p.cedula,
            p.first_name,
            p.last_name,
            p.email,
            COUNT(pc.id) AS certificate_count
       FROM persons p
       LEFT JOIN person_certificates pc ON pc.person_id = p.id
      GROUP BY p.id, p.cedula, p.first_name, p.last_name, p.email
     HAVING COUNT(pc.id) = 0
      ORDER BY p.id`
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
  const people = await listTargetPeople();
  if (!people.length) {
    console.log("No hay personas sin certificados. No se generó nada.");
    console.log(`Contraseña esperada para certificados demo: ${CERT_PASSWORD}`);
    return;
  }

  console.log(`Se generarán certificados demo autofirmados para ${people.length} persona(s).`);

  for (const person of people) {
    const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    const { tempDir, p12Path } = await createPkcs12ForPerson(person);
    try {
      const created = await registerCertificate(person, p12Path);
      console.log(
        `OK person_id=${person.id} cedula=${person.cedula} nombre="${fullName}" certificate_id=${created.id} object=${created.object_name}`
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  console.log(`Contraseña de todos los certificados demo generados: ${CERT_PASSWORD}`);
};

main()
  .catch((error) => {
    console.error("Error generando certificados demo:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMariaDBPool().catch(() => {});
  });
