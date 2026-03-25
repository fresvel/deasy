import crypto from "crypto";
import { getMariaDBPool } from "../config/mariadb.js";

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 10;

const generateRawToken = () => {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let result = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    result += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
  }
  return result;
};

/**
 * Genera un token de 10 caracteres único en la tabla persons.
 * Se guarda limpio en BD. El formato !-token-! se aplica externamente
 * solo cuando se pasa al servicio de firma.
 */
export const generateUniqueToken = async () => {
  const pool = getMariaDBPool();

  if (!pool) {
    throw new Error("Pool de MariaDB no disponible al generar token.");
  }

  let token;
  let exists = true;
  let attempts = 0;

  while (exists) {
    if (++attempts > 10) {
      throw new Error("No se pudo generar un token único tras 10 intentos.");
    }

    token = generateRawToken();

    const [rows] = await pool.query(
      "SELECT id FROM persons WHERE token = ? LIMIT 1",
      [token]
    );

    exists = rows.length > 0;
  }

  return token;
};

/**
 * Formatea el token para enviarlo al servicio de firma.
 * Ejemplo: "aB3xKp9mQr" → "!-aB3xKp9mQr-!"
 */
export const formatTokenForSigner = (token) => `!-${token}-!`;