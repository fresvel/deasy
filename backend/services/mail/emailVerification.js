import bcrypt from "bcrypt";
import { getMariaDBPool } from "../../config/mariadb.js";

export const verifyEmailCode = async (personId, code) => {
  const pool = getMariaDBPool();

  // 1️⃣ Buscar código activo
  const [rows] = await pool.query(
    `
    SELECT id, code_hash, expires_at
    FROM email_verification_codes
    WHERE person_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [personId]
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

  // 4️⃣ Marcar a la persona como verificada
  await pool.query(
    `
    UPDATE persons
    SET verify_email = 1,
        status = 'Verificado'
    WHERE id = ?
    `,
    [personId]
  );

  // 5️⃣ Eliminar código (one-time use)
  await pool.query(
    `DELETE FROM email_verification_codes WHERE id = ?`,
    [record.id]
  );

  return true;
};
