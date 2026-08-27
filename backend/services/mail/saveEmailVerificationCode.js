import bcrypt from "bcrypt";
import { getPostgresPool } from "../../config/postgres.js";

export const saveEmailVerificationCode = async (emailId, code) => {
  const pool = getPostgresPool();

  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalida códigos anteriores de ESE correo
  await pool.query(
    `DELETE FROM email_verification_codes WHERE email_id = ?`,
    [emailId]
  );

  await pool.query(
    `
    INSERT INTO email_verification_codes (email_id, code_hash, expires_at)
    VALUES (?, ?, ?)
    `,
    [emailId, codeHash, expiresAt]
  );
};
