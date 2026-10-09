// LA EJECUCION DEL RECORRIDO · `recorridos` y `turnos`, las dos tablas de `tareas` que sustituyen a
// las cuatro de instancia y solicitud (dos por lado).
//
// Un RECORRIDO es la ronda en marcha de UNA accion sobre UNA version de documento; un TURNO es a
// quien le toco, y apunta al PARTICIPANTE declarado que lo produjo --no solo al paso--, asi que se
// sabe de que declaracion salio.
//
// ⚠️ `accion` va en las dos tablas y la clave ajena es COMPUESTA: el `CHECK` de `devuelto` --legal
// solo en entrega-- necesita verla en `turnos`, y la compuesta impide que las dos digan cosas
// distintas. Por eso todo `INSERT` en `turnos` la lleva.

export const abrirRecorrido = async (connection, { documentVersionId, accion, pasoActual = null }) => {
  const [res] = await connection.query(
    `INSERT INTO recorridos (document_version_id, accion, estado, paso_actual)
     VALUES (?, ?, 'pendiente', ?)`,
    [documentVersionId, accion, pasoActual]
  );
  return Number(res.insertId);
};

export const buscarRecorrido = async (connection, documentVersionId, accion) => {
  const [filas] = await connection.query(
    `SELECT id, estado, paso_actual
       FROM recorridos
      WHERE document_version_id = ? AND accion = ?
      LIMIT 1`,
    [documentVersionId, accion]
  );
  return filas?.[0] || null;
};

export const actualizarAvanceDelRecorrido = async (connection, recorridoId, estado, pasoActual) => {
  await connection.query(
    `UPDATE recorridos SET estado = ?, paso_actual = ? WHERE id = ?`,
    [estado, pasoActual, recorridoId]
  );
};

export const cancelarRecorrido = async (connection, recorridoId, estadoCancelado) => {
  await connection.query(
    `UPDATE recorridos SET estado = ? WHERE id = ?`,
    [estadoCancelado, recorridoId]
  );
};

export const abrirTurno = async (connection, { recorridoId, accion, participanteId, personaId, manual = 0 }) => {
  const [res] = await connection.query(
    `INSERT INTO turnos (recorrido_id, accion, participante_id, persona_id, estado, manual)
     VALUES (?, ?, ?, ?, 'pendiente', ?)`,
    [recorridoId, accion, participanteId, personaId, manual]
  );
  return Number(res.insertId);
};

export const actualizarTurno = async (connection, turnoId, { estado, personaId, manual, respondido, nota }) => {
  await connection.query(
    `UPDATE turnos
        SET estado = ?,
            persona_id = COALESCE(?, persona_id),
            manual = COALESCE(?, manual),
            respondido = ?,
            nota_respuesta = COALESCE(?, nota_respuesta)
      WHERE id = ?`,
    [estado, personaId ?? null, manual ?? null, respondido ?? null, nota ?? null, turnoId]
  );
};

// Cancelar lo que siga abierto. Mismo criterio que tenian las dos mitades: solo lo que no ha
// respondido, y se sella la respuesta para que no quede un turno cerrado sin fecha.
export const cancelarTurnosAbiertos = async (connection, recorridoId, estadoCancelado, nota = null) => {
  await connection.query(
    `UPDATE turnos
        SET estado = ?,
            respondido = COALESCE(respondido, NOW()),
            nota_respuesta = COALESCE(nota_respuesta, ?)
      WHERE recorrido_id = ?
        AND estado IN ('pendiente', 'en_progreso', 'devuelto')`,
    [estadoCancelado, nota, recorridoId]
  );
};

// Borrar turnos que ya no corresponden a ninguna declaracion vigente. Lo usa la REPARACION, que
// corre cuando la receta cambia debajo de un recorrido ya abierto.
export const borrarTurnos = async (connection, ids = []) => {
  if (!ids.length) return 0;
  await connection.query(
    `DELETE FROM turnos WHERE id IN (${ids.map(() => "?").join(", ")})`,
    ids
  );
  return ids.length;
};

// Reabrir turnos por id. No cruza: los ids los resuelve `consulta/idsDeTurnosDelPaso`, que es la
// mitad que tiene que mirar el paso declarado.
//
// ⚠️ `conservarNota` NO es un adorno: hay DOS reaperturas y no significan lo mismo.
//   · al DEVOLVER se reabre el paso ANTERIOR, que no tiene nada que ver con el motivo: su nota se
//     limpia, o arrastraria la de otra vuelta.
//   · cuando TODOS los turnos del paso actual quedaron devueltos, se reabre ESE paso para que se
//     pueda rehacer — y ahi la nota es justo el motivo por el que volvio. Borrarla pierde el porque.
// Fundirlas en una sola lo perdia, y lo caza el golden `return_efecto`.
export const reabrirTurnos = async (connection, ids = [], { conservarNota = false } = {}) => {
  if (!ids.length) return 0;
  await connection.query(
    `UPDATE turnos
        SET estado = 'pendiente',
            respondido = NULL
            ${conservarNota ? "" : ", nota_respuesta = NULL"}
      WHERE id IN (${ids.map(() => "?").join(", ")})`,
    ids
  );
  return ids.length;
};

// LA RESPUESTA A UN TURNO: quien lo atiende, en que estado queda y con que nota. Es el write del
// camino de acciones, y entra por aqui porque `turnos` la escribe SOLO el `datos/` de su dominio.
export const responderTurno = async (connection, turnoId, { personaId, estado, respondido, nota }) => {
  await connection.query(
    `UPDATE turnos
        SET persona_id = ?, estado = ?, respondido = ?, nota_respuesta = ?
      WHERE id = ?`,
    [personaId, estado, respondido, nota, turnoId]
  );
};
