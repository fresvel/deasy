// EXPERIMENTO F7 (2026-10-06) · El `datos/` de `tareas` para las versiones documentales.
// Movido tal cual desde `services/documents/DocumentWorkflowResetService.js`: mismas consultas,
// mismos nombres, misma forma de retorno. Aqui NO hay reglas: no se decide nada, solo se pregunta
// y se escribe. La conexion llega por parametro y nunca se pide un pool.

export const getMaxDocumentVersionForTaskItem = async (connection, taskItemId) => {
  const [rows] = await connection.query(
    `SELECT MAX(version) AS max_version
     FROM document_versions
     WHERE task_item_id = ?`,
    [taskItemId]
  );
  return Number(rows?.[0]?.max_version || 0);
};

export const insertDocumentVersion = async (connection, fila) => {
  const [insertResult] = await connection.query(
    `INSERT INTO document_versions (
       task_item_id,
       version,
       edicion_id,
       payload_hash,
       payload_object_path,
       working_file_path,
       final_file_path,
       format,
       render_engine,
       status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fila.taskItemId,
      fila.version,
      fila.templateArtifactId,
      fila.payloadHash,
      fila.payloadObjectPath,
      fila.workingFilePath,
      fila.finalFilePath,
      fila.format,
      fila.renderEngine,
      fila.status,
    ]
  );
  return Number(insertResult.insertId);
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// LAS DOS ESCRITURAS QUE HACÍA `services/documents` POR SU CUENTA.
//
// Las destapó la comprobación C al integrar el piloto: `document_versions` la escribían DOS sitios,
// este `datos/` y `services/documents`. No se declara como deuda —callar la puerta con una línea es
// exactamente lo que no hay que hacer—: el escritor vuelve a ser uno y los de fuera piden por la
// puerta del dominio.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// El archivo vigente y su minor. `working_file_path` ES EL ARCHIVO VIGENTE y no se mueve de sitio:
// son 74 lecturas en el backend y ninguna necesita saber de la bitácora. Lo que se sobrescribía y se
// perdía era el puntero al anterior; ahora ese puntero vive en la bitácora, con su autor y su fecha.
export const actualizarArchivoVigente = async (connection, documentVersionId, filePath, minor) => {
  await connection.query(
    `UPDATE document_versions
     SET working_file_path = ?,
         version_minor = ?
     WHERE id = ?`,
    [filePath, minor, Number(documentVersionId)]
  );
};

// El estado. QUIÉN decide si la transición es válida es `services/documents/DocumentStateService.js`,
// que es la máquina de estados: aquí sólo se escribe el destino que ya se validó.
export const actualizarEstado = async (connection, documentVersionId, targetStatus) => {
  await connection.query(
    `UPDATE document_versions
     SET status = ?
     WHERE id = ?`,
    [targetStatus, documentVersionId]
  );
};

// LOS FICHEROS QUE UNA VERSIÓN TIENE EN EL ALMACÉN (frente 27, F27.P4.T25): los tres que apunta ella
// misma —el de trabajo, el final y el de datos— y los de sus subidas y sus anexos. Se leen ANTES de
// borrarla, porque la cascada se lleva las filas que los nombran.
export const listarFicherosDeLaVersion = async (ejecutor, documentVersionId) => {
  const [filas] = await ejecutor.query(
    `SELECT dv.working_file_path AS ruta FROM document_versions dv WHERE dv.id = ?
     UNION SELECT dv.final_file_path FROM document_versions dv WHERE dv.id = ?
     UNION SELECT dv.payload_object_path FROM document_versions dv WHERE dv.id = ?
     UNION SELECT u.file_path FROM document_version_uploads u WHERE u.document_version_id = ?
     UNION SELECT a.file_path FROM document_attachments a WHERE a.document_version_id = ?`,
    Array(5).fill(Number(documentVersionId))
  );
  return filas.map((fila) => fila.ruta).filter(Boolean);
};

// De esas rutas, las que TODAVÍA nombra alguna fila: otra versión, otra subida u otro anexo. Un
// fichero compartido no se borra porque desaparezca uno de los que lo apuntan.
// Va ruta a ruta, y no con una lista: la capa de consultas reparte un arreglo en varios parámetros,
// así que un solo marcador no puede llevarlo. Son pocas —las de una versión—.
export const rutasQueSiguenEnUso = async (ejecutor, rutas) => {
  const enUso = [];
  for (const ruta of rutas) {
    const [filas] = await ejecutor.query(
      `SELECT (EXISTS (SELECT 1 FROM document_versions dv
                        WHERE dv.working_file_path = ? OR dv.final_file_path = ? OR dv.payload_object_path = ?)
            OR EXISTS (SELECT 1 FROM document_version_uploads u WHERE u.file_path = ?)
            OR EXISTS (SELECT 1 FROM document_attachments a WHERE a.file_path = ?)) AS en_uso`,
      Array(5).fill(ruta)
    );
    if (filas[0]?.en_uso) enUso.push(ruta);
  }
  return enUso;
};
