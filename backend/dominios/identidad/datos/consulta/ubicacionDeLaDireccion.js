// EL CATÁLOGO TERRITORIAL visto desde una dirección, y la dirección ya resuelta a nombres.
//
// ⚠️ `datos/consulta/` porque CRUZA: `paises`, `provincias` y `cantones` son de **organizacion**. De
// `identidad` sólo nombra `direcciones`. Son lecturas; no se escribe nada ajeno.
//
// ⚠️ Y no se reutiliza `organizacion/datos/geografia.js` aunque se parezca, por dos razones: un
// dominio sólo se importa por su `index.js` —y el `datos/` de otro dominio no sale por ahí—, y
// además las consultas no son las mismas: allí el país se resuelve por ISO, y aquí por **ISO o
// nombre**, porque el formulario de registro enseña nombres.

// CADA NIVEL SE RESUELVE ACOTADO POR EL DE ARRIBA, nunca suelto, y eso no es celo: el nombre de un
// cantón sólo es único DENTRO de su provincia —en Ecuador hay un «Bolívar» en Carchi y otro en
// Manabí, y un «Olmedo» en Loja y otro en Manabí—.
export const idDePaisPorIsoONombre = async (ejecutor, clave) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM paises WHERE iso_alpha2 = ? OR name = ? LIMIT 1`,
    [clave.toUpperCase(), clave]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

export const idDeProvinciaEnElPais = async (ejecutor, paisId, nombre) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM provincias WHERE pais_id = ? AND name = ? LIMIT 1`,
    [paisId, nombre]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

export const idDeCantonEnLaProvincia = async (ejecutor, provinciaId, nombre) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM cantones WHERE provincia_id = ? AND name = ? LIMIT 1`,
    [provinciaId, nombre]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

// Las direcciones ya resueltas a nombres, que es lo que se enseña. El id se conserva para poder
// editarlas sin volver a buscarlas por nombre.
export const listarConNombres = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT d.id, d.tipo, d.principal,
            d.pais_id, pa.iso_alpha2 AS pais_iso, pa.name AS pais,
            d.provincia_id, pr.name AS provincia,
            d.canton_id, ca.name AS canton,
            d.sector, d.barrio,
            d.calle_primaria, d.calle_secundaria, d.referencia,
            d.latitud, d.longitud
       FROM direcciones d
       LEFT JOIN paises pa ON pa.id = d.pais_id
       LEFT JOIN provincias pr ON pr.id = d.provincia_id
       LEFT JOIN cantones ca ON ca.id = d.canton_id
      WHERE d.person_id = ? AND d.is_active = 1
      ORDER BY d.principal DESC, d.id ASC`,
    [personId]
  );
  return filas ?? [];
};
