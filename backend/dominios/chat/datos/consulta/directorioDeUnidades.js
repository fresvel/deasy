// LECTURAS QUE CRUZAN: el organigrama, visto desde `chat`.
//
// ⚠️ ESTO VIVE EN `datos/consulta/` Y NO EN `datos/` A PROPÓSITO, y es toda la razón de que esa
// subcarpeta exista. Las tres consultas de aquí no nombran **ni una** tabla de `chat`: leen
// `units`, `unit_positions` y `position_assignments`, que son de `organizacion`. La regla es que
// `datos/` sólo nombre tablas de su dominio —lo comprueba la comprobación **E** de
// `check-mapa-tablas.mjs`— y que lo que cruza esté **separado**, no prohibido: medido el 2026-10-07,
// el 29 % de las consultas del backend cruza dominios.
//
// Leer de otro dominio no necesita permiso ni declaración; ESCRIBIR sí, y aquí no se escribe nada.
// Vinieron de `services/ChatUnitDirectoryService.js`, que se queda con las reglas —el 400, el 404 y
// el 403 de «no perteneces a esta unidad»— y con la forma de la respuesta.

// La membresía: una persona pertenece a una unidad si tiene una asignación de puesto VIGENTE sobre un
// puesto de esa unidad. El `member_count` se cuenta aparte, por unidad, en una subconsulta.
export const unidadesDeLaPersona = async (ejecutor, personId) => {
  const [rows] = await ejecutor.query(
    `SELECT
       u.id AS unit_id,
       COALESCE(u.label, u.name) AS unit_label,
       (
         SELECT COUNT(DISTINCT pa2.person_id)
         FROM position_assignments pa2
         INNER JOIN unit_positions up2 ON up2.id = pa2.position_id
         WHERE up2.unit_id = u.id
           AND pa2.is_current = 1
       ) AS member_count
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     INNER JOIN units u ON u.id = up.unit_id
     WHERE pa.person_id = ?
       AND pa.is_current = 1
       AND u.is_active = 1
     GROUP BY u.id, unit_label
     ORDER BY unit_label`,
    [personId]
  );
  return rows || [];
};

// La etiqueta de una unidad ACTIVA. Devuelve `null` si no existe o está inactiva: el 404 lo decide
// quien pregunta, no esta consulta.
export const etiquetaDeUnidadActiva = async (ejecutor, unitId) => {
  const [rows] = await ejecutor.query(
    `SELECT COALESCE(u.label, u.name) AS unit_label
     FROM units u
     WHERE u.id = ?
       AND u.is_active = 1
     LIMIT 1`,
    [unitId]
  );
  return rows?.[0]?.unit_label ?? null;
};

// Quién está en la unidad, y quién la encabeza. El `MAX(is_unit_head)` es porque una persona puede
// ocupar varios puestos de la misma unidad y basta con que UNO sea el de cabeza.
export const miembrosDeUnidad = async (ejecutor, unitId) => {
  const [rows] = await ejecutor.query(
    `SELECT pa.person_id, MAX(up.is_unit_head) AS is_unit_head
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     WHERE up.unit_id = ?
       AND pa.is_current = 1
     GROUP BY pa.person_id`,
    [unitId]
  );
  return rows || [];
};
