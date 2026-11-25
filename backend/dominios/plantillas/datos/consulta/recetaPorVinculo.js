// CRUZA A `procesos`: para llegar a la receta AUTORADA hay que saber qué edición enlaza el vínculo,
// y `vinculos` es de ese dominio. Por eso vive aquí y no en `datos/` — es la regla E del mapa.
//
// Es el SEGUNDO escalón de la resolución. El primero --la receta del propio entregable-- no cruza
// nada y se queda en `datos/`.
export const leerRecetaPorVinculo = async (connection, vinculoId, accion, selectPasos) => {
  const [filas] = await connection.query(
    `${selectPasos}
     WHERE p.edicion_id = (SELECT edicion_id FROM vinculos WHERE id = ?)
       AND p.accion = ?
     ORDER BY p.orden ASC, pa.orden ASC`,
    [vinculoId, accion]
  );
  return filas;
};
