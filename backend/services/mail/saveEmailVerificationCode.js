import bcrypt from "bcrypt";
import { getPostgresPool } from "../../config/postgres.js";

// CUÁNDO se envió el último código a esta persona, para el freno entre reenvíos.
//
// ⚠️ VIVÍA EN `controllers/users/verificacion_registro_controller.js` HASTA EL 2026-10-07 (F7.2).
// Vive aquí y no en `services/limites/` a propósito: el freno cuenta desde el `created_at` del último
// código ENVIADO —el hecho que se quiere frenar, y que esta tabla ya guarda—, así que lo sabe quien
// escribe la fila. Contarlo aparte crearía dos fuentes de verdad. El porqué completo, en
// `limites/reglas.js`.
export const ultimoCodigoEnviadoAt = async (personId) => {
  const [filas] = await getPostgresPool().query(
    `SELECT c.created_at
       FROM email_verification_codes c
       INNER JOIN emails e ON e.id = c.email_id
      WHERE e.person_id = ?
      ORDER BY c.created_at DESC
      LIMIT 1`,
    [personId]
  );
  return filas?.[0]?.created_at ? new Date(filas[0].created_at).getTime() : 0;
};

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
