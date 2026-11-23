// El listado de unidades con su tipo. Lectura, sin reglas.
//
// ⚠️ VIVÍA EN `controllers/empresa/program_controler.js` HASTA EL 2026-10-07 (F7.2), que componía el
// WHERE a mano dentro del controller. Se movió tal cual.
export const listUnits = async (pool, filtros = {}) => {
  const condiciones = [];
  const params = [];
  if (filtros.unitTypeId !== undefined) {
    condiciones.push("u.unit_type_id = ?");
    params.push(Number(filtros.unitTypeId));
  }
  if (filtros.unitType !== undefined) {
    condiciones.push("ut.name = ?");
    params.push(String(filtros.unitType));
  }
  if (filtros.isActive !== undefined) {
    // El parametro HTTP sigue llamandose `is_active`; lo que pregunta ahora es si la unidad RIGE
    // hoy (frente 27, D-03), que es lo que aquella bandera queria decir.
    condiciones.push("unidad_rige(u.id) = ?");
    params.push(Number(filtros.isActive) === 1);
  }
  const whereClause = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT u.*, ut.name AS unit_type_name, COALESCE(v.estado, 'borrador') AS estado
     FROM units u
     LEFT JOIN unit_types ut ON ut.id = u.unit_type_id
     LEFT JOIN unit_vigencia_actual v ON v.unit_id = u.id
     ${whereClause}
     ORDER BY u.name ASC`,
    params
  );
  return rows || [];
};
