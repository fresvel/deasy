import { getMariaDBPool } from "../config/mariadb.js";

export const generateUniqueToken = async () => {
  const pool = getMariaDBPool();

  let token;
  let exists = true;

  while (exists) {
    const raw = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    token = `!-${raw}-!`;

    const [rows] = await pool.query(
      "SELECT id FROM persons WHERE token = ? LIMIT 1",
      [token]
    );

    exists = rows.length > 0;
  }

  return token;
};