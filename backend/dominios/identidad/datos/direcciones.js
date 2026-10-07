// LAS DIRECCIONES de una persona (`direcciones`). Sólo SQL, y sólo de `identidad`.
//
// Lo que resuelve el país, la provincia y el cantón contra el catálogo vive aparte, en
// `datos/consulta/ubicacionDeLaDireccion.js`, porque esas tablas son de `organizacion`.
//
// `campos` llega como el array ya normalizado por el servicio —diez valores, en el orden del
// `INSERT`— y a propósito: decidir qué es vacío y qué se recorta es suyo, no de aquí.
export const principalDeSuTipo = async (ejecutor, personId, tipo) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM direcciones WHERE person_id = ? AND tipo = ? AND principal = 1 LIMIT 1`,
    [personId, tipo]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

export const actualizarPrincipal = async (ejecutor, direccionId, campos) => {
  await ejecutor.query(
    `UPDATE direcciones
        SET pais_id = ?, provincia_id = ?, canton_id = ?,
            sector = ?, barrio = ?,
            calle_primaria = ?, calle_secundaria = ?, referencia = ?,
            latitud = ?, longitud = ?
      WHERE id = ?`,
    [...campos, Number(direccionId)]
  );
};

export const insertarPrincipal = async (ejecutor, personId, tipo, campos) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO direcciones
       (person_id, tipo, pais_id, provincia_id, canton_id,
        sector, barrio, calle_primaria, calle_secundaria, referencia, latitud, longitud, principal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [personId, tipo, ...campos]
  );
  return resultado?.insertId ?? null;
};
