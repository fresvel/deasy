import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

import { closeMariaDBPool, getMariaDBPool } from "../config/mariadb.js";
import UserCertificateRepository from "../services/auth/UserCertificateRepository.js";
import { ensureBucketExists, uploadFileToMinio } from "../services/storage/minio_service.js";

const execFileAsync = promisify(execFile);

const PERSON_ID = 1;
const MINIO_CERTIFICATES_BUCKET = process.env.MINIO_CERTIFICATES_BUCKET || "deasy-certificates";
const CERT_PASSWORD = "Demo1234!";
const CERT_LABEL = "Demo Autofirmado";

const certificateRepository = new UserCertificateRepository();
const pool = getMariaDBPool();

if (!pool) {
  throw new Error("La conexión MariaDB no está configurada.");
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

const getPerson = async () => {
  const [rows] = await pool.query(
    `SELECT id, cedula, first_name, last_name, email
     FROM persons
     WHERE id = ?
     LIMIT 1`,
    [PERSON_ID]
  );
  return rows?.[0] || null;
};

const createPkcs12 = async (person) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "deasy-demo-cert-person1-"));
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
      "3650",
      "-nodes",
      "-subj",
      buildSubject(person),
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
      `${CERT_LABEL} ${person.cedula || person.id}`,
    ]);

    return { tempDir, p12Path };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
};

const main = async () => {
  const person = await getPerson();
  if (!person) {
    throw new Error("Persona Demo Uno no existe.");
  }

  const { tempDir, p12Path } = await createPkcs12(person);
  try {
    const originalFilename = sanitizeFileName(`demo_autofirmado_${person.cedula || person.id}.p12`);
    const objectName = `users/${person.cedula}/certificates/${Date.now()}-${originalFilename}`;

    await ensureBucketExists(MINIO_CERTIFICATES_BUCKET);
    await uploadFileToMinio(MINIO_CERTIFICATES_BUCKET, objectName, p12Path, {
      "Content-Type": "application/x-pkcs12",
    });

    await certificateRepository.clearDefaultForPerson(PERSON_ID);
    const created = await certificateRepository.create({
      person_id: PERSON_ID,
      label: CERT_LABEL,
      original_filename: originalFilename,
      bucket: MINIO_CERTIFICATES_BUCKET,
      object_name: objectName,
      is_default: 1,
    });

    console.log(
      JSON.stringify(
        {
          certificate_id: created.id,
          person_id: PERSON_ID,
          label: created.label,
          object_name: created.object_name,
          is_default: created.is_default,
          password: CERT_PASSWORD,
        },
        null,
        2
      )
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

main()
  .catch((error) => {
    console.error("Error generando certificado demo para Persona Demo Uno:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMariaDBPool().catch(() => {});
  });
