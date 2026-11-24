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
// SIN `is_active` (frente 27, D-03): un puesto ya no se apaga con una columna. Se le pone fin a su
// vida en `position_vigencias`, que tiene su propio camino de escritura.
const COLUMNAS_EDITABLES = ["title", "cargo_id", "position_type", "is_unit_head", "profile"];

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
    // NACE EN BORRADOR (frente 27, D-03): sin ninguna vida. Ponerlo en vigor es un paso aparte.
    `INSERT INTO unit_positions (unit_id, cargo_id, slot_no, title, profile, position_type, is_unit_head)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

// TODAS LAS VIDAS de los puestos de una unidad, la más reciente primero, con el número del acto de
// cada extremo. Una sola consulta para toda la unidad: el servicio las reparte por puesto.
export const listarVidasDeLosPuestos = async (ejecutor, unitId) => {
  const [filas] = await ejecutor.query(
    `SELECT pv.id, pv.position_id, pv.vigente_desde::text AS vigente_desde, pv.vigente_hasta::text AS vigente_hasta,
            pv.inicio_origen, pv.inicio_acto_id, ai.numero AS inicio_acto_numero,
            pv.fin_origen, pv.fin_acto_id, af.numero AS fin_acto_numero,
            estado_de_vigencia(pv.vigente_desde, pv.vigente_hasta) AS estado
       FROM position_vigencias pv
       INNER JOIN unit_positions p ON p.id = pv.position_id
       LEFT JOIN actos ai ON ai.id = pv.inicio_acto_id
       LEFT JOIN actos af ON af.id = pv.fin_acto_id
      WHERE p.unit_id = ?
      ORDER BY pv.vigente_desde DESC`,
    [unitId]
  );
  return filas ?? [];
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

// SUPRIMIR DE UNA VEZ LOS PUESTOS DE UNA UNIDAD, todos con la misma fecha (frente 27).
//
// Existe porque una unidad no se suprime mientras tenga puestos que rijan, y hacerlo uno por uno en
// una unidad de diez era el coste de esa regla. Pone fin a la vida que rige ese día en cada puesto.
// Cada fin dispara lo de siempre —cierra la ocupación, deja sin responsable los entregables en
// curso—: es la misma supresión, repetida, en una sola transacción.
//
// ⚠️ No toca una vida que empiece DESPUÉS de esa fecha —un puesto programado—: ésa no rige ese día y
// no se le puede poner un fin anterior a su inicio. Si la hay, la unidad seguirá sin poder
// suprimirse y la base dirá por qué.
export const suprimirPuestosDeLaUnidad = async (ejecutor, unitId, { hasta, origen, actoId = null }) => {
  const [resultado] = await ejecutor.query(
    `UPDATE position_vigencias pv
        SET vigente_hasta = ?, fin_origen = ?, fin_acto_id = ?
       FROM unit_positions up
      WHERE up.id = pv.position_id
        AND up.unit_id = ?
        AND pv.vigente_desde <= ?
        AND (pv.vigente_hasta IS NULL OR pv.vigente_hasta > ?)`,
    [hasta, origen, actoId, unitId, hasta, hasta]
  );
  return Number(resultado.affectedRows ?? resultado.rowCount ?? 0);
};

