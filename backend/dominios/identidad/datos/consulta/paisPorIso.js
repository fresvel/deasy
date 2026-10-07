// EL PAÍS POR SU CÓDIGO ISO.
//
// ⚠️ `datos/consulta/` porque `paises` es de **organizacion**. Es una lectura de catálogo, y aquí
// hace falta constantemente: el documento nacional, el prefijo del teléfono y la nacionalidad se
// resuelven todos contra el mismo catálogo.
//
// ⚠️ Y no es la misma consulta que `idDePaisPorIsoONombre` de `ubicacionDeLaDireccion.js`: aquélla
// acepta también el nombre, porque el formulario de direcciones enseña nombres. Ésta no, porque
// quien la llama ya tiene un ISO.
export const idDePaisPorIso = async (ejecutor, iso) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM paises WHERE iso_alpha2 = ? LIMIT 1`,
    [String(iso).trim().toUpperCase()]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

// Y la inversa: el ISO a partir del id. Hace falta para ELEGIR EL VALIDADOR, que va por país — sin
// esto no se puede saber si un número de documento está bien formado.
export const isoDelPais = async (ejecutor, paisId) => {
  const [filas] = await ejecutor.query(
    `SELECT iso_alpha2 FROM paises WHERE id = ? LIMIT 1`,
    [Number(paisId)]
  );
  return filas?.length ? filas[0].iso_alpha2 : null;
};
