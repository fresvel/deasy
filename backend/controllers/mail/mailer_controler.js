import fs from 'fs';
import path from 'path';
import { transporter } from '../../lib/mailer.js';
import { generateNumericCode } from '../../utils/email/generateCode.js';

export const sendVerificationEmail = async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: 'Email requerido',
      });
    }

    // 1️⃣ Generar código
    const code = generateNumericCode(6);

    // 2️⃣ Leer template HTML
    const templatePath = path.resolve(
      process.cwd(),
      'templates',
      'email',
      'verification-code.html'
    );

    let html = fs.readFileSync(templatePath, 'utf-8');

    // 3️⃣ Inyectar código
    html = html.replace('{{CODE}}', code);

    // 4️⃣ Enviar email
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: 'Tu código de verificación 🔐',
      html,
    });

    // ⚠️ Aquí normalmente guardarías el código en DB o cache (Redis)
    // junto con expiración

    return res.json({
      ok: true,
      message: 'Código enviado',
      // ⚠️ SOLO para pruebas, luego se quita
      code,
    });
  } catch (error) {
    console.error('Error enviando email:', error);

    return res.status(500).json({
      ok: false,
      error: 'Error enviando correo',
    });
  }
};
