// LOS DATOS PERSONALES del titular y la coherencia de su lugar de nacimiento.
//
// ⚠️ `datos/consulta/` porque las dos consultas miran `cantones` —y una también `provincias`—, que
// son de **organizacion**. De `identidad` nombran `persons` y `persona_autoidentificacion`.

// `fecha_nacimiento` sale como AAAA-MM-DD, que es lo que se escribe: el DATE crudo llega al JSON como
// marca de tiempo con zona, y un formulario lo pintaría un día antes o después.
//
// `nacimiento_provincia_id` NO se guarda: se DEDUCE del cantón, y el PATCH la ignora. Por eso sale de
// un JOIN y no de una columna.
export const datosPersonalesDe = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
            p.nacimiento_pais_id, p.nacimiento_canton_id, ca.provincia_id AS nacimiento_provincia_id,
            p.sexo, p.estado_civil_id,
            aut.genero_id, aut.autoidentificacion_etnica_id
       FROM persons p
       LEFT JOIN cantones ca ON ca.id = p.nacimiento_canton_id
       LEFT JOIN persona_autoidentificacion aut ON aut.person_id = p.id
      WHERE p.id = ?
      LIMIT 1`,
    [personId]
  );
  return filas?.[0] ?? null;
};

// De qué país es un cantón. Lo usa la comprobación de que el cantón de nacimiento cuelgue del país de
// nacimiento; quien decide los dos 400 es el servicio.
export const paisDelCanton = async (ejecutor, cantonId) => {
  const [filas] = await ejecutor.query(
    `SELECT p.pais_id
       FROM cantones c
       INNER JOIN provincias p ON p.id = c.provincia_id
      WHERE c.id = ?
      LIMIT 1`,
    [Number(cantonId)]
  );
  return filas?.length ? Number(filas[0].pais_id) : null;
};
