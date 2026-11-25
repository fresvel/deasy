// LAS DIRECCIONES Y LOS TELÉFONOS DE VARIAS PERSONAS DE UNA VEZ.
//
// ⚠️ `datos/consulta/` porque CRUZA a `paises`, `provincias` y `cantones`, las tres de
// **organizacion**.
//
// ⚠️ Y EN LOTE, no una consulta por persona: en una lista de 43 usuarios eso serían 43 viajes a la
// base para pintar una tabla.
export const direccionesEnLote = async (ejecutor, personIds) => {
  const [filas] = await ejecutor.query(
    `SELECT d.person_id, d.id, d.tipo, d.principal,
            pa.iso_alpha2 AS pais_iso, pa.name AS pais,
            pr.name AS provincia, ca.name AS canton,
            d.sector, d.barrio,
            d.calle_primaria, d.calle_secundaria, d.referencia, d.latitud, d.longitud
       FROM direcciones d
       LEFT JOIN paises pa ON pa.id = d.pais_id
       LEFT JOIN provincias pr ON pr.id = d.provincia_id
       LEFT JOIN cantones ca ON ca.id = d.canton_id
      WHERE d.person_id IN (${personIds.map(() => "?").join(", ")}) AND d.is_active = 1
      ORDER BY d.principal DESC, d.id ASC`,
    personIds
  );
  return filas ?? [];
};

// Devolver `telefonos: []` aquí sería MENTIR: `whatsapp` se deriva de esa lista, así que una lista
// vacía lo dejaría en null para todo el mundo y parecería que nadie tiene número.
export const telefonosEnLote = async (ejecutor, personIds) => {
  const [filas] = await ejecutor.query(
    `SELECT t.person_id, t.id, t.tipo, t.principal, t.numero,
            pa.iso_alpha2 AS pais_iso, pa.phone_code AS prefijo,
            -- ⚠️ EL CERO NACIONAL NO VA DETRAS DEL PREFIJO: +593 seguido de 0990000000 da
            -- +5930990000000, que no es un numero. Se quita al internacionalizar y se
            -- CONSERVA cuando no hay prefijo, porque entonces la forma local es la correcta.
            -- No se veia porque hasta el 2026-08-30 el arranque creaba el telefono SIN pais.
            CASE
              WHEN COALESCE(pa.phone_code, '') = '' THEN t.numero
              ELSE pa.phone_code || regexp_replace(t.numero, '^0+', '')
            END AS numero_completo
       FROM telefonos t
       LEFT JOIN paises pa ON pa.id = t.pais_id
      WHERE t.person_id IN (${personIds.map(() => "?").join(", ")}) AND t.is_active = 1
      ORDER BY t.principal DESC, t.id ASC`,
    personIds
  );
  return filas ?? [];
};
