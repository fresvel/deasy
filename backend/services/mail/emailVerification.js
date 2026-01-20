import bcrypt from "bcrypt";
import { getMariaDBPool } from "../../config/mariadb.js";

export const verifyEmailCode = async (userId, code) => {
  const pool = getMariaDBPool();

  // 1️⃣ Buscar código activo
  const [rows] = await pool.query(
    `
    SELECT id, code_hash, expires_at
    FROM email_verification_codes
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  if (!rows.length) {
    throw new Error("NO_CODE");
  }

  const record = rows[0];

  // 2️⃣ Verificar expiración
  if (new Date(record.expires_at) < new Date()) {
    // limpiar código expirado
    await pool.query(
      `DELETE FROM email_verification_codes WHERE id = ?`,
      [record.id]
    );
    throw new Error("CODE_EXPIRED");
  }

  // 3️⃣ Comparar código
  const isValid = await bcrypt.compare(code, record.code_hash);

  if (!isValid) {
    throw new Error("INVALID_CODE");
  }

  // 4️⃣ Marcar usuario como verificado
  await pool.query(
    `
    UPDATE users
    SET verify_email = 1,
        status = 'Verificado'
    WHERE id = ?
    `,
    [userId]
  );

  // 5️⃣ Eliminar código (one-time use)
  await pool.query(
    `DELETE FROM email_verification_codes WHERE id = ?`,
    [record.id]
  );

  return true;
};
