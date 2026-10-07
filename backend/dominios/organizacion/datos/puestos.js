// LOS PUESTOS de una unidad y QUIÉN los ocupa.
//
// Sólo SQL. Quien decide que la cabeza de unidad tiene que ser un puesto ocupable, que el perfil es
// un JSON con cuatro secciones, o que un puesto con historia no se borra sino que se desactiva, es
// `services/orgStructure.js`.
//
// Vive en `datos/` porque nombra sólo `unit_positions` y `position_assignments`, las dos de
// `organizacion`. Las OCHO tablas que pueden depender de un puesto son de cinco dominios, y por eso
// contarlas vive aparte, en `datos/consulta/dependenciasDelPuesto.js`.

// Las columnas que el editor del organigrama puede cambiar. La lista es CERRADA y es lo que permite
// construir el SET por interpolación sin abrir una inyección: una clave que no esté aquí se ignora.
const COLUMNAS_EDITABLES = ["title", "cargo_id", "position_type", "is_unit_head", "is_active", "profile"];

// El slot se autoincrementa por (unidad, cargo): "Docente 1", "Docente 2". No es un contador global.
export const siguienteSlot = async (ejecutor, unitId, cargoId) => {
  const [filas] = await ejecutor.query(
    "SELECT COALESCE(MAX(slot_no), 0) + 1 AS next_slot FROM unit_positions WHERE unit_id = ? AND cargo_id = ?",
    [unitId, cargoId]
  );
  return Number(filas?.[0]?.next_slot || 1);
};

export const insertarPuesto = async (ejecutor, { unitId, cargoId, slotNo, title, profile, positionType, isHead }) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO unit_positions (unit_id, cargo_id, slot_no, title, profile, position_type, is_unit_head, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [unitId, cargoId, slotNo, title, profile, positionType, isHead]
  );
  return Number(resultado.insertId);
};

// `cambios` llega con los valores YA normalizados por el servicio. Devuelve cuántas columnas tocó,
// para que el llamador sepa si hubo algo que escribir.
export const actualizarPuesto = async (ejecutor, positionId, cambios = {}) => {
  const columnas = COLUMNAS_EDITABLES.filter((columna) => cambios[columna] !== undefined);
  if (!columnas.length) {
    return 0;
  }
  const params = columnas.map((columna) => cambios[columna]);
  params.push(positionId);
  await ejecutor.query(
    `UPDATE unit_positions SET ${columnas.map((columna) => `${columna} = ?`).join(", ")} WHERE id = ?`,
    params
  );
  return columnas.length;
};

export const existePuesto = async (ejecutor, positionId) => {
  const [filas] = await ejecutor.query("SELECT id FROM unit_positions WHERE id = ? LIMIT 1", [positionId]);
  return filas.length > 0;
};

export const borrarPuesto = async (ejecutor, positionId) => {
  await ejecutor.query("DELETE FROM unit_positions WHERE id = ?", [positionId]);
};

// --- Ocupaciones -------------------------------------------------------------------------------
// Las dos van juntas dentro de una transacción al cambiar de ocupante: cerrar sin abrir deja el
// puesto vacante, y abrir sin cerrar deja DOS ocupantes vigentes del mismo puesto.
export const cerrarOcupacionVigente = async (ejecutor, positionId) => {
  await ejecutor.query(
    "UPDATE position_assignments SET is_current = 0, end_date = CURDATE() WHERE position_id = ? AND is_current = 1",
    [positionId]
  );
};

export const abrirOcupacion = async (ejecutor, positionId, personId) => {
  await ejecutor.query(
    "INSERT INTO position_assignments (position_id, person_id, start_date, is_current) VALUES (?, ?, CURDATE(), 1)",
    [positionId, personId]
  );
};
