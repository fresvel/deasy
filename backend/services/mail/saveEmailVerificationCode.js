import bcrypt from "bcrypt";
import { getMariaDBPool } from "../../config/mariadb.js";

export const saveEmailVerificationCode = async (personId, code) => {
  const pool = getMariaDBPool();

  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalida códigos anteriores de la persona
  await pool.query(
    `DELETE FROM email_verification_codes WHERE person_id = ?`,
    [personId]
  );

  await pool.query(
    `
    INSERT INTO email_verification_codes (person_id, code_hash, expires_at)
    VALUES (?, ?, ?)
    `,
    [personId, codeHash, expiresAt]
  );
};
