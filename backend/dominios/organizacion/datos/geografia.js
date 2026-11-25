// EL CATÁLOGO GEOGRÁFICO: países y las divisiones administrativas de cada uno.
//
// Lectura, sin una regla dentro: se pregunta y se devuelven filas. Quien decide el 400 de «hace falta
// el país» o el «ese país no está en el catálogo» es `services/GeografiaService.js`, que es su único
// llamador.
//
// ⚠️ Vive en `datos/` y NO en `datos/consulta/` porque las seis consultas nombran **sólo** tablas de
// `organizacion` —`paises`, `provincias`, `cantones`, `parroquias`, `clases_parroquia`,
// `nomenclatura_territorial`—. Eso lo comprueba la comprobación **E**.

export const paisesActivos = async (ejecutor) => {
  const [filas] = await ejecutor.query(
    `SELECT id, iso_alpha2, name, phone_code
       FROM paises
      WHERE is_active = 1
      ORDER BY name ASC`
  );
  return filas ?? [];
};

// Por ISO, para cuando el cliente manda `?pais=EC` en vez del id.
export const idDePaisPorIso = async (ejecutor, iso) => {
  const [filas] = await ejecutor.query(
    "SELECT id FROM paises WHERE iso_alpha2 = ? LIMIT 1",
    [String(iso).trim().toUpperCase()]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

export const provinciasDelPais = async (ejecutor, paisId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, dpa_code, name
       FROM provincias
      WHERE pais_id = ? AND is_active = 1
      ORDER BY name ASC`,
    [Number(paisId)]
  );
  return filas ?? [];
};

export const cantonesDeLaProvincia = async (ejecutor, provinciaId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, dpa_code, name
       FROM cantones
      WHERE provincia_id = ? AND is_active = 1
      ORDER BY name ASC`,
    [Number(provinciaId)]
  );
  return filas ?? [];
};

// La parroquia se pide POR CANTON y no por provincia: son 1 314 en Ecuador y listarlas todas no le
// sirve a nadie. Devuelve tambien la clase, que es lo que deja al formulario separar la cabecera
// de las urbanas y las rurales sin hacer aritmetica con el codigo DPA.
export const parroquiasDelCanton = async (ejecutor, cantonId) => {
  const [filas] = await ejecutor.query(
    `SELECT p.id, p.dpa_code, p.name, cl.code AS clase, cl.name AS clase_nombre
       FROM parroquias p
       LEFT JOIN clases_parroquia cl ON cl.id = p.clase_id
      WHERE p.canton_id = ? AND p.is_active = 1
      ORDER BY cl.orden ASC, p.name ASC`,
    [Number(cantonId)]
  );
  return filas ?? [];
};

// COMO SE LLAMA CADA NIVEL en el pais de la institucion. Sin esto el formulario tendria que
// escribir "Canton" a fuego, y eso solo vale para Ecuador: en España el nivel 2 es la provincia.
export const nomenclaturaDelPais = async (ejecutor, paisId) => {
  const [filas] = await ejecutor.query(
    `SELECT nivel, singular, plural
       FROM nomenclatura_territorial
      WHERE pais_id = ? AND is_active = 1
      ORDER BY nivel ASC`,
    [Number(paisId)]
  );
  return filas ?? [];
};
