// LA PERSONA (`persons`) y lo que declara de sí misma (`persona_autoidentificacion`). Sólo SQL.
//
// Las reglas viven en `services/UserRepository.js`: qué columnas son editables, qué sale al público,
// qué es sensible y queda en la bitácora. Aquí se escribe lo que llega, ya decidido.
//
// ⚠️ LAS TRES SENTENCIAS DINÁMICAS RECIBEN LAS COLUMNAS YA FILTRADAS por la lista blanca del
// servicio, y eso es lo único que las hace seguras: aquí no se vuelve a comprobar, porque una
// comprobación repetida a medias es peor que una sola en su sitio. Si llamas a esto con claves que
// vengan del cuerpo de una petición, abres una inyección.

export const insertarPersona = async (ejecutor, columnas, valores) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO persons (${columnas.join(", ")}) VALUES (${columnas.map(() => "?").join(", ")})`,
    valores
  );
  return resultado;
};

export const actualizarPersona = async (ejecutor, personId, asignaciones, valores) => {
  await ejecutor.query(
    `UPDATE persons SET ${asignaciones.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...valores, personId]
  );
};

export const actualizarFoto = async (ejecutor, personId, photoUrl) => {
  await ejecutor.query(
    `UPDATE persons SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [photoUrl, personId]
  );
};

// Upsert por `person_id`, que es la clave primaria: la fila nace la primera vez que la persona
// declara algo.
export const guardarAutoidentificacion = async (ejecutor, personId, columnas, valores) => {
  await ejecutor.query(
    `INSERT INTO persona_autoidentificacion (person_id, ${columnas.join(", ")})
     VALUES (?, ${columnas.map(() => "?").join(", ")})
     ON CONFLICT (person_id) DO UPDATE SET ${columnas.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`,
    [personId, ...valores]
  );
};

// ¿Ya había declarado algo? Es lo que distingue un «create» de un «update» en la bitácora.
export const tieneAutoidentificacion = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT person_id FROM persona_autoidentificacion WHERE person_id = ? LIMIT 1`,
    [personId]
  );
  return Boolean(filas?.length);
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS ESCRITURAS QUE `services/mail` HACÍA POR SU CUENTA (F5.2 y F5.3, cerradas el 2026-10-07).
//
// Estaban declaradas como deuda en `scripts/docs/dominios.json → _deuda_escritura`: `reset_password.js`
// ejecutaba su propio `UPDATE persons SET password_hash` y `emailVerification.js` su propio
// `UPDATE persons SET status`. No eran reglas distintas con el mismo SQL: eran la MISMA escritura
// hecha desde fuera del dominio dueño. Ahora el correo llama aquí por la puerta.
//
// Y ésta es la mitad que de verdad importa de esa deuda: no es que el SQL estuviera duplicado, es que
// `persons` tenía dos dueños, así que un cambio en cómo se guarda una contraseña había que acordarse
// de hacerlo en dos sitios.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export const actualizarHashDeContrasena = async (ejecutor, personId, passwordHash) => {
  await ejecutor.query(
    `UPDATE persons SET password_hash = ? WHERE id = ?`,
    [passwordHash, personId]
  );
};

// El estado de la persona y la marca del correo son DOS COSAS distintas desde el paso 5: el correo
// lleva su propia marca y su fecha (`datos/emails.js`), y esto es el estado de la persona.
export const marcarPersonaVerificada = async (ejecutor, personId) => {
  await ejecutor.query(
    `UPDATE persons SET status = 'Verificado' WHERE id = ?`,
    [personId]
  );
};
