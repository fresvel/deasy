import bcrypt from "bcrypt";
import { getPostgresPool } from "../../config/postgres.js";

export const verifyEmailCode = async (personId, code) => {
  const pool = getPostgresPool();

  // 0️⃣ El código ya no cuelga de la persona sino de SU CORREO, porque desde que hay varios,
  // "verificar a la persona" no dice cuál. La firma sigue tomando `personId` a propósito: quien
  // llama tiene el id de la persona, no el del correo, y el que se verifica es el principal.
  const [correos] = await pool.query(
    "SELECT id FROM emails WHERE person_id = ? AND principal = 1 AND is_active = 1 LIMIT 1",
    [personId]
  );
  if (!correos.length) {
    throw new Error("NO_CODE");
  }
  const emailId = Number(correos[0].id);

  // 1️⃣ Buscar código activo
  const [rows] = await pool.query(
    `
    SELECT id, code_hash, expires_at
    FROM email_verification_codes
    WHERE email_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [emailId]
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

  // 4️⃣ Marcar EL CORREO como verificado, y a la persona como verificada. Son dos cosas
  // distintas desde el paso 5: el correo lleva su propia marca y su fecha; el estado de la persona
  // sigue siendo el de siempre.
  await pool.query(
    "UPDATE emails SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?",
    [emailId]
  );
  await pool.query(
    `
    UPDATE persons
    SET status = 'Verificado'
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
