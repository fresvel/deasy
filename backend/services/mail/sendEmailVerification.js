import fs from "node:fs";
import path from "node:path";
import { transporter } from "../../lib/mailer.js";
import { generateVerificationCode } from "../../utils/email/generateCode.js";
import { saveEmailVerificationCode } from "./saveEmailVerificationCode.js";
import { getPostgresPool } from "../../config/postgres.js";

// El codigo cuelga del CORREO, no de la persona. Se resuelve aqui el correo principal --su id Y su
// direccion-- para que los llamadores, que tienen el id de la persona, no tengan que enterarse.
//
// ⚠️ LA DIRECCION SE LEE AQUI, Y NO SE ACEPTA DE FUERA. Hasta el 2026-08-31 el destinatario llegaba
// como argumento (`email`), y el registro se lo pasaba desde `createdUser.email` --un campo que YA
// NO EXISTE, porque el correo dejo de ser columna de `persons` y se mudo a `emails`. El resultado
// era `to: undefined`, y nodemailer respondiendo "No recipients defined" en un `catch` que lo
// escribia en el log del servidor y seguia.
//
// O sea: el correo de verificacion no se envio NUNCA. No se noto porque tampoco habia `SMTP_*`
// configurado, asi que los dos fallos se tapaban el uno al otro.
//
// Leerla aqui cierra la clase entera del problema: el unico sitio que sabe a donde se envia es el
// que lo consulta, y no puede desincronizarse de un campo que alguien mueva.
const resolvePrincipalEmail = async (personId) => {
  const [filas] = await getPostgresPool().query(
    "SELECT id, direccion FROM emails WHERE person_id = ? AND principal = 1 AND is_active = 1 LIMIT 1",
    [personId]
  );
  if (!filas?.length) {
    throw new Error(`La persona ${personId} no tiene un correo principal al que enviar la verificación.`);
  }
  return { id: Number(filas[0].id), direccion: String(filas[0].direccion) };
};

export const sendEmailVerification = async ({ personId }) => {
  const correo = await resolvePrincipalEmail(personId);
  // 1️⃣ Generar código
  const code = generateVerificationCode();

  // 2️⃣ Guardar código
  await saveEmailVerificationCode(correo.id, code);

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
    to: correo.direccion,
    subject: "Verifica tu correo 🔐",
    html
  });
};

