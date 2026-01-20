import fs from 'fs';
import path from 'path';
import { transporter } from '../../lib/mailer.js';
import { generateVerificationCode } from '../../utils/email/generateCode.js';
import { saveEmailVerificationCode } from '../../services/mail/saveEmailVerificationCode.js';
import { verifyEmailCode } from "../../services/mail/emailVerification.js";

import { getMariaDBPool } from "../../config/mariadb.js";

export const sendVerificationEmail = async (req, res) => {
  try {
    const { user_id, to } = req.body;

    if (!user_id || !to) {
      return res.status(400).json({
        ok: false,
        error: 'user_id y email son requeridos',
      });
    }

    // 1️⃣ Generar código
    const code = generateVerificationCode();

    // 2️⃣ Guardar código en DB (ANTES de enviar)
    await saveEmailVerificationCode(user_id, code);

    // 3️⃣ Leer template HTML
    const templatePath = path.resolve(
      process.cwd(),
      'templates',
      'email',
      'verification-code.html'
    );

    let html = fs.readFileSync(templatePath, 'utf-8');

    // 4️⃣ Inyectar código
    html = html.replace('{{CODE}}', code);

    // 5️⃣ Enviar email
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: 'Tu código de verificación 🔐',
      html,
    });

    return res.json({
      ok: true,
      message: 'Código enviado correctamente',
    });

  } catch (error) {
    console.error('Error enviando email:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error enviando correo',
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { user_id, code } = req.body;

    if (!user_id || !code) {
      return res.status(400).json({
        ok: false,
        error: "user_id y código son requeridos",
      });
    }

    await verifyEmailCode(user_id, code);

    return res.json({
      ok: true,
      message: "Correo verificado correctamente",
    });

  } catch (error) {
    console.error("Error verificando email:", error.message);

    let message = "Error verificando código";

    if (error.message === "NO_CODE") {
      message = "No existe un código activo";
    } else if (error.message === "CODE_EXPIRED") {
      message = "El código ha expirado";
    } else if (error.message === "INVALID_CODE") {
      message = "Código incorrecto";
    }

    return res.status(400).json({
      ok: false,
      error: message,
    });
  }
};
