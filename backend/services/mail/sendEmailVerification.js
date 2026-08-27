import fs from "node:fs";
import path from "node:path";
import { transporter } from "../../lib/mailer.js";
import { generateVerificationCode } from "../../utils/email/generateCode.js";
import { saveEmailVerificationCode } from "./saveEmailVerificationCode.js";
import { getPostgresPool } from "../../config/postgres.js";

// El codigo cuelga del CORREO, no de la persona. Se resuelve aqui el correo principal para que los
// llamadores -que tienen el id de la persona- no tengan que enterarse.
const resolvePrincipalEmailId = async (personId) => {
  const [filas] = await getPostgresPool().query(
    "SELECT id FROM emails WHERE person_id = ? AND principal = 1 AND is_active = 1 LIMIT 1",
    [personId]
  );
  if (!filas?.length) {
    throw new Error(`La persona ${personId} no tiene un correo principal al que enviar la verificación.`);
  }
  return Number(filas[0].id);
};

export const sendEmailVerification = async ({ personId, email }) => {
  // 1️⃣ Generar código
  const code = generateVerificationCode();

  // 2️⃣ Guardar código
  await saveEmailVerificationCode(await resolvePrincipalEmailId(personId), code);

  // 3️⃣ Cargar template
  const templatePath = path.resolve(
    process.cwd(),
    "templates",
    "email",
    "verification-code.html"
  );

  let html = fs.readFileSync(templatePath, "utf-8");
  html = html.replace("{{CODE}}", code);

  // 4️⃣ Enviar email
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Verifica tu correo 🔐",
    html
  });
};

