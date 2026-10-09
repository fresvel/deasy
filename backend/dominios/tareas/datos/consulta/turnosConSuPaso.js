// CRUZAN A `plantillas`: un turno se lee SIEMPRE con lo que su paso declara --el orden, el
// resolutor, el hueco-- y `pasos_declarados` y `participantes_declarados` son de ese dominio. Por
// eso las tres viven aqui y no en `datos/`: es la regla E del mapa de tablas.
//
// Y la asimetria que esa regla describe se ve bien en este fichero: ESCRIBIR no cruza nunca --los
// turnos los escribe `tareas` y solo `tareas`-- pero LEER cruza en las tres consultas que de verdad
// se usan. Separarlo es lo que distingue una lectura legitima de un error.


// Los turnos de un recorrido, con lo que el paso declara. Es la consulta que alimenta tanto el
// avance como las pantallas: el estado vive en el turno y el ORDEN en el paso.
export const leerTurnosDelRecorrido = async (connection, recorridoId) => {
  const [filas] = await connection.query(
    `SELECT t.id, t.participante_id, t.persona_id, t.estado, t.manual,
            t.solicitado, t.notificado, t.respondido, t.nota_respuesta,
            pa.orden AS participante_orden, pa.resolver_type, pa.slot,
            p.id AS paso_id, p.orden AS paso_orden, p.code, p.nombre
       FROM turnos t
       INNER JOIN participantes_declarados pa ON pa.id = t.participante_id
       INNER JOIN pasos_declarados p ON p.id = pa.paso_id
      WHERE t.recorrido_id = ?
      ORDER BY p.orden ASC, pa.orden ASC, t.id ASC`,
    [recorridoId]
  );
  return filas;
};


// Reabrir los turnos de UN paso que quedaron devueltos: es la reactivacion del paso anterior.
// LOS IDS DE LOS TURNOS DE UN PASO. Es la mitad que CRUZA de «reabrir el paso anterior»: para
// saber que turnos son hay que mirar el paso declarado, que es de `plantillas`. La escritura se
// queda en `datos/` y recibe ids, asi que no cruza nada.
export const idsDeTurnosDelPaso = async (connection, recorridoId, pasoOrden, { soloDevueltos = false } = {}) => {
  const [filas] = await connection.query(
    `SELECT t.id
       FROM turnos t
       INNER JOIN participantes_declarados pa ON pa.id = t.participante_id
       INNER JOIN pasos_declarados p ON p.id = pa.paso_id
      WHERE t.recorrido_id = ?
        AND p.orden = ?
        ${soloDevueltos ? "AND t.estado = 'devuelto'" : ""}`,
    [recorridoId, pasoOrden]
  );
  return filas.map((f) => Number(f.id));
};


// ¿TIENE EL USUARIO EL TURNO QUE TOCA? Vino de `plantillas/datos/flujoDeLlenado.js`, que se disolvio
// con la unificacion: la pregunta es la misma en los dos lados, asi que la funcion es una.
//
// «El que toca» es el PASO ACTUAL del recorrido, no cualquiera: un turno abierto de un paso
// posterior existe --se materializan todos al abrir-- pero todavia no le toca a nadie.
export const turnoAbiertoDelUsuarioEnPasoActual = async (connection, documentVersionId, accion, userId) => {
  const [filas] = await connection.query(
    `SELECT r.id AS recorrido_id, r.paso_actual, t.id AS turno_id
       FROM recorridos r
       INNER JOIN turnos t ON t.recorrido_id = r.id
       INNER JOIN participantes_declarados pa ON pa.id = t.participante_id
       INNER JOIN pasos_declarados p ON p.id = pa.paso_id
      WHERE r.document_version_id = ?
        AND r.accion = ?
        AND p.orden = r.paso_actual
        AND t.persona_id = ?
        AND t.estado IN ('pendiente', 'en_progreso')
      LIMIT 1`,
    [documentVersionId, accion, userId]
  );
  return filas?.[0] || null;
};
