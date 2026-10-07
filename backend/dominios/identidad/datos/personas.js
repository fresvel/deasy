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
