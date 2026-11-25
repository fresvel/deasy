// EL CATÁLOGO DE PREFIJOS y los teléfonos con su número internacional ya compuesto.
//
// ⚠️ `datos/consulta/` porque `paises` es de **organizacion**. De `identidad` sólo nombra `telefonos`.

// Por prefijo, que es EL ÚLTIMO RECURSO y es AMBIGUO: «+1» lo comparten Estados Unidos, Canadá y
// media docena de islas. Devuelve TODOS los que empatan y no uno: quien decide que un empate es un
// error —en vez de elegir al azar— es el servicio.
export const paisesConPrefijo = async (ejecutor, prefijo) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM paises WHERE phone_code = ? AND is_active = 1`,
    [prefijo]
  );
  return filas ?? [];
};

// Todos los prefijos, para separar el que viene pegado a un número con «+». Se trae la lista entera
// porque hay que buscar el prefijo MÁS LARGO que case: «+1» es Estados Unidos pero «+1-684» es Samoa
// Americana, y quedarse con «+1» mandaría las dos al mismo sitio. Eso no se puede hacer en el WHERE.
export const prefijosActivos = async (ejecutor) => {
  const [filas] = await ejecutor.query(
    `SELECT id, phone_code FROM paises WHERE phone_code IS NOT NULL AND is_active = 1`
  );
  return filas ?? [];
};

export const listarConPrefijo = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT t.id, t.tipo, t.principal, t.numero,
            t.pais_id, pa.iso_alpha2 AS pais_iso, pa.phone_code AS prefijo,
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
      WHERE t.person_id = ? AND t.is_active = 1
      ORDER BY t.principal DESC, t.id ASC`,
    [personId]
  );
  return filas ?? [];
};
