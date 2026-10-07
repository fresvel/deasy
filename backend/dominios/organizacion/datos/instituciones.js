// LA INSTITUCIÓN de esta instalación, con su país ya resuelto.
//
// Lectura, sin reglas. Devuelve **todas** las activas a propósito: que haya cero o más de una es una
// decisión que toma `services/InstitucionService.js`, y la toma fallando ruidosamente —elegir «la
// primera» ante dos daría un país equivocado, y con él un validador de documento equivocado—.
//
// Vive en `datos/` porque `instituciones` y `paises` son las dos de `organizacion`.
export const institucionesActivas = async (ejecutor) => {
  const [filas] = await ejecutor.query(
    `SELECT i.id, i.nombre, i.pais_id, p.iso_alpha2 AS pais_iso, p.name AS pais_nombre
       FROM instituciones i
       INNER JOIN paises p ON p.id = i.pais_id
      WHERE i.is_active = 1
      ORDER BY i.id ASC`
  );
  return filas ?? [];
};
