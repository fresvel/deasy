import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import { getMariaDBPool } from "../../config/mariadb.js";
import { transporter } from "../../lib/mailer.js";
import { generateVerificationCode } from "../../utils/email/generateCode.js";

/**
 * Enviar código de recuperación de contraseña
 */
export const sendResetCodeService = async (email) => {
  const pool = getMariaDBPool();

  const [[user]] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (!user) return;

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await pool.query(
    `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
     VALUES (?, ?, ?)`,
    [user.id, codeHash, expiresAt]
  );

  const templatePath = path.resolve(
    process.cwd(),
    "templates/email/reset-password-code.html"
  );

  let html = await fs.readFile(templatePath, "utf8");
  html = html.replace("{{CODE}}", code);

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Recuperación de contraseña 🔐",
    html
  });
};

/**
 * Verificar código de recuperación
 */
export const verifyResetCodeService = async (email, code) => {
  const pool = getMariaDBPool();

  const [[user]] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (!user) return false;

  const [[row]] = await pool.query(
    "SELECT code_hash, expires_at FROM password_reset_codes WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1",
    [user.id]
  );

  if (!row) return false;
  if (new Date() > new Date(row.expires_at)) return false;

  const valid = await bcrypt.compare(code, row.code_hash);
  return valid;
};

/**
 * Resetear contraseña
 */
export const resetPasswordService = async (email, code, password) => {
  const pool = getMariaDBPool();

  // 1️⃣ Buscar usuario
  const [[user]] = await pool.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  if (!user) throw new Error("Usuario no encontrado");

  // 2️⃣ Verificar código
  const valid = await verifyResetCodeService(email, code);
  if (!valid) throw new Error("Código inválido o expirado");

  // 3️⃣ Hash de la nueva contraseña
  const passwordHash = await bcrypt.hash(password, 10);

  // 4️⃣ Actualizar contraseña correctamente en la columna password_hash
  await pool.query(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [passwordHash, user.id]
  );

  // 5️⃣ Marcar el código como usado (opcional, mejora seguridad)
  await pool.query(
    "UPDATE password_reset_codes SET used = 1 WHERE user_id = ? AND used = 0",
    [user.id]
  );
};
