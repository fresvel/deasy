// LOS PUESTOS DE UNA UNIDAD CON SU OCUPANTE, con nombre y documento.
//
// ⚠️ Está en `datos/consulta/` y no en `datos/` porque CRUZA: `unit_positions` y
// `position_assignments` son de `organizacion`, pero `cargos`, `persons` y `documentos_identidad`
// son de **identidad**. Leer hacia otro dominio con un JOIN está permitido —el 29 % de las lecturas
// lo hace—; lo que no está permitido es ESCRIBIRLO, y aquí no se escribe nada.
//
// Es una lectura y nada más: la comprobación **E** deja pasar esto porque está bajo
// `datos/consulta/`, y la **C** no se queja porque no hay ni un INSERT/UPDATE/DELETE.
export const listarPuestosConOcupante = async (ejecutor, unitId) => {
  const [filas] = await ejecutor.query(
    `SELECT p.id, p.slot_no, p.title, p.is_unit_head, p.is_active, p.position_type, p.cargo_id, p.profile,
            c.name AS cargo_name, c.code AS cargo_code,
            pa.id AS assignment_id, pa.start_date,
            pers.id AS person_id, pdoc.numero AS cedula,
            CONCAT(COALESCE(pers.first_name, ''), ' ', COALESCE(pers.last_name, '')) AS person_name
     FROM unit_positions p
     LEFT JOIN cargos c ON c.id = p.cargo_id
     LEFT JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
     LEFT JOIN persons pers ON pers.id = pa.person_id
     LEFT JOIN documentos_identidad pdoc ON pdoc.person_id = pers.id AND pdoc.principal = 1 AND pdoc.is_active = 1
     WHERE p.unit_id = ?
     ORDER BY p.is_unit_head DESC, c.name ASC, p.slot_no ASC`,
    [unitId]
  );
  return filas ?? [];
};
