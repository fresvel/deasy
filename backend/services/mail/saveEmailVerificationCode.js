import bcrypt from "bcrypt";
import { getMariaDBPool } from "../../config/mariadb.js";

export const saveEmailVerificationCode = async (userId, code) => {
  const pool = getMariaDBPool();

  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // 🔥 Opcional: invalidar códigos anteriores
  await pool.query(
    `DELETE FROM email_verification_codes WHERE user_id = ?`,
    [userId]
  );

  await pool.query(
    `
    INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
    VALUES (?, ?, ?)
    `,
    [userId, codeHash, expiresAt]
  );
};
