import fs from "fs";
import path from "path";
import { transporter } from "../../lib/mailer.js";
import { generateVerificationCode } from "../../utils/email/generateCode.js";
import { saveEmailVerificationCode } from "./saveEmailVerificationCode.js";

export const sendEmailVerification = async ({ userId, email }) => {
  // 1️⃣ Generar código
  const code = generateVerificationCode();

  // 2️⃣ Guardar código
  await saveEmailVerificationCode(userId, code);

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

