// CADA ACTO CON SU PAPEL, O SIN ÉL — la lectura que enseña qué actos siguen sin documento (frente 27,
// D-05 punto 3; F27.P4.T11).
//
// ⚠️ `datos/consulta/` porque CRUZA: el documento firmado en el sistema vive en `tareas`
// (`acto_documentos`), y saber si un acto ya ordena algo mira también dos tablas de `procesos`. De
// este dominio son `actos`, `tipos_de_acto`, `units` y `acto_adjuntos`. Aquí no se escribe nada.
//
// `documento` dice cuál de los tres casos es: «firmado» (se produjo aquí), «adjunto» (vino de fuera
// y se subió) o NULL (pendiente). Y `ordena_algo`, si alguna vida o relación lo cita: de eso depende
// que cambiar su fichero sea libre o sea una corrección.
export const listarActosConSuDocumento = async (ejecutor, { soloSinDocumento = false } = {}) => {
  const [filas] = await ejecutor.query(
    `SELECT a.id, a.numero, a.asunto, ta.name AS tipo,
            TO_CHAR(a.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
            TO_CHAR(a.fecha_vigencia, 'YYYY-MM-DD') AS fecha_vigencia,
            COALESCE(u.name, a.emisor_externo) AS emisor,
            CASE WHEN ad.acto_id IS NOT NULL THEN 'firmado'
                 WHEN aa.id IS NOT NULL THEN 'adjunto'
                 ELSE NULL END AS documento,
            aa.file_name AS adjunto_nombre, aa.size_bytes AS adjunto_bytes,
            acto_ordena_algo(a.id) AS ordena_algo
       FROM actos a
       JOIN tipos_de_acto ta ON ta.id = a.tipo_de_acto_id
       LEFT JOIN units u ON u.id = a.unidad_emisora_id
       LEFT JOIN acto_documentos ad ON ad.acto_id = a.id
       LEFT JOIN acto_adjuntos aa ON aa.acto_id = a.id
      WHERE (? = 0 OR (ad.acto_id IS NULL AND aa.id IS NULL))
      ORDER BY a.fecha_emision DESC, a.id DESC`,
    [soloSinDocumento ? 1 : 0]
  );
  return filas.map((fila) => ({ ...fila, ordena_algo: Boolean(fila.ordena_algo), adjunto_bytes: fila.adjunto_bytes == null ? null : Number(fila.adjunto_bytes) }));
};

// Lo que hay que saber de un acto antes de tocar su fichero.
export const leerActoParaAdjuntar = async (ejecutor, actoId) => {
  const [filas] = await ejecutor.query(
    `SELECT a.id, a.numero,
            EXISTS (SELECT 1 FROM acto_documentos ad WHERE ad.acto_id = a.id) AS tiene_documento_firmado,
            acto_ordena_algo(a.id) AS ordena_algo
       FROM actos a
      WHERE a.id = ?`,
    [Number(actoId)]
  );
  const fila = filas[0];
  return fila
    ? { id: fila.id, numero: fila.numero, tieneDocumentoFirmado: Boolean(fila.tiene_documento_firmado), ordenaAlgo: Boolean(fila.ordena_algo) }
    : null;
};
