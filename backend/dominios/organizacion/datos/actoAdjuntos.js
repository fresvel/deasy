// EL FICHERO DE UN ACTO EXTERNO: el único escritor de `acto_adjuntos` (frente 27, D-05; F27.P4.T11).
//
// Aquí sólo hay SQL de esa tabla. Lo que decide si un cambio es libre o es una corrección está en la
// base (`proteger_adjunto_de_acto`) y, antes, en el servicio, que es quien puede explicarlo.
const COLUMNAS_DEL_FICHERO = ["file_path", "file_name", "mime_type", "size_bytes", "sha256"];

// Con `FOR UPDATE`: quien lo lee va a cambiarlo en la misma transacción.
export const leerAdjuntoDelActo = async (ejecutor, actoId) => {
  const [filas] = await ejecutor.query(
    `SELECT a.id, a.acto_id, a.file_path, a.file_name, a.mime_type, a.size_bytes, a.sha256
       FROM acto_adjuntos a
      WHERE a.acto_id = ?
        FOR UPDATE`,
    [Number(actoId)]
  );
  return filas[0] || null;
};

export const insertarAdjunto = async (ejecutor, actoId, fichero, subidoPor) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO acto_adjuntos (acto_id, file_path, file_name, mime_type, size_bytes, sha256, subido_por_person_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Number(actoId), ...COLUMNAS_DEL_FICHERO.map((columna) => fichero[columna]), subidoPor || null]
  );
  return Number(resultado.insertId);
};

// Reemplazar es apuntar la fila a otro objeto del almacén; el anterior no se toca.
export const reemplazarAdjunto = async (ejecutor, adjuntoId, fichero, subidoPor) => {
  await ejecutor.query(
    `UPDATE acto_adjuntos
        SET file_path = ?, file_name = ?, mime_type = ?, size_bytes = ?, sha256 = ?, subido_por_person_id = ?
      WHERE id = ?`,
    [...COLUMNAS_DEL_FICHERO.map((columna) => fichero[columna]), subidoPor || null, Number(adjuntoId)]
  );
};

export const quitarAdjunto = async (ejecutor, adjuntoId) => {
  await ejecutor.query(
    `DELETE FROM acto_adjuntos
      WHERE id = ?`,
    [Number(adjuntoId)]
  );
};

export const leerAdjuntoParaDescargar = async (ejecutor, actoId) => {
  const [filas] = await ejecutor.query(
    `SELECT a.file_path, a.file_name, a.mime_type, a.size_bytes
       FROM acto_adjuntos a
      WHERE a.acto_id = ?`,
    [Number(actoId)]
  );
  return filas[0] || null;
};
