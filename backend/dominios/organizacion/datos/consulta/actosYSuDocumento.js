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
            ad.document_version_id AS firmado_version_id,
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

// LOS ACTOS QUE CITA UN NODO: el que ordena su inicio, el que ordena su fin y los que lo cuelgan de
// su padre o lo sacan de él. El rótulo no lleva tiempo verbal ni género: la fecha puede ser futura
// y el nodo, una unidad o un proceso. Vale para una unidad y para un proceso, que guardan lo mismo con otros
// nombres; por eso las tablas y sus columnas SE INTERPOLAN, de esta lista cerrada y de ninguna otra
// parte. Ojo: `check:sql-aliases` y `check:sql-comments` no ven estas dos consultas —buscan nombres
// literales—; las cubre esta lista.
const DONDE_CITA = Object.freeze({
  unidad: { vidas: "unit_vigencias", nodo: "unit_id", relaciones: "unit_relations", hijo: "child_unit_id" },
  proceso: { vidas: "process_vigencias", nodo: "process_id", relaciones: "process_relations", hijo: "child_process_id" }
});
const citasDe = (clase) => {
  const t = DONDE_CITA[clase];
  if (!t) throw new Error(`No se sabe qué actos cita un nodo de clase «${clase}».`);
  const fecha = (columna) => `TO_CHAR(${columna}, 'YYYY-MM-DD')`;
  return `SELECT v.${t.nodo} AS nodo_id, v.inicio_acto_id AS acto_id, 'Ordena su inicio, el ' || ${fecha("v.vigente_desde")} AS papel
            FROM ${t.vidas} v WHERE v.inicio_acto_id IS NOT NULL
          UNION ALL
          SELECT v.${t.nodo}, v.fin_acto_id, 'Ordena su fin, el ' || ${fecha("v.vigente_hasta")}
            FROM ${t.vidas} v WHERE v.fin_acto_id IS NOT NULL
          UNION ALL
          SELECT r.${t.hijo}, r.inicio_acto_id, 'Ordena que dependa de su padre, desde el ' || ${fecha("r.vigente_desde")}
            FROM ${t.relaciones} r WHERE r.inicio_acto_id IS NOT NULL
          UNION ALL
          SELECT r.${t.hijo}, r.fin_acto_id, 'Ordena que deje de depender de su padre, el ' || ${fecha("r.vigente_hasta")}
            FROM ${t.relaciones} r WHERE r.fin_acto_id IS NOT NULL`;
};

// Los actos que cita UN nodo, cada uno con su papel en él y con su documento.
export const listarActosDeUnNodo = async (ejecutor, clase, nodoId) => {
  const [filas] = await ejecutor.query(
    `SELECT a.id, a.numero, a.asunto, ta.name AS tipo,
            TO_CHAR(a.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
            COALESCE(u.name, a.emisor_externo) AS emisor,
            CASE WHEN ad.acto_id IS NOT NULL THEN 'firmado'
                 WHEN aa.id IS NOT NULL THEN 'adjunto'
                 ELSE NULL END AS documento,
            aa.file_name AS adjunto_nombre, aa.size_bytes AS adjunto_bytes,
            ad.document_version_id AS firmado_version_id,
            STRING_AGG(DISTINCT c.papel, ' · ' ORDER BY c.papel) AS papel
       FROM (${citasDe(clase)}) c
       JOIN actos a ON a.id = c.acto_id
       JOIN tipos_de_acto ta ON ta.id = a.tipo_de_acto_id
       LEFT JOIN units u ON u.id = a.unidad_emisora_id
       LEFT JOIN acto_documentos ad ON ad.acto_id = a.id
       LEFT JOIN acto_adjuntos aa ON aa.acto_id = a.id
      WHERE c.nodo_id = ?
      GROUP BY a.id, ta.name, u.name, ad.acto_id, ad.document_version_id, aa.id
      ORDER BY a.fecha_emision DESC, a.id DESC`,
    [Number(nodoId)]
  );
  // Lo cita este nodo, así que ya ordena algo: cambiar su fichero es una corrección.
  return filas.map((fila) => ({ ...fila, ordena_algo: true, adjunto_bytes: fila.adjunto_bytes == null ? null : Number(fila.adjunto_bytes) }));
};

// Cuántos actos SIN DOCUMENTO cita cada nodo de esa clase: lo que avisa el nodo en el mapa.
export const contarActosSinDocumentoPorNodo = async (ejecutor, clase) => {
  const [filas] = await ejecutor.query(
    `SELECT c.nodo_id, COUNT(DISTINCT c.acto_id) AS n
       FROM (${citasDe(clase)}) c
      WHERE NOT EXISTS (SELECT 1 FROM acto_documentos ad WHERE ad.acto_id = c.acto_id)
        AND NOT EXISTS (SELECT 1 FROM acto_adjuntos aa WHERE aa.acto_id = c.acto_id)
      GROUP BY c.nodo_id`
  );
  return new Map(filas.map((fila) => [Number(fila.nodo_id), Number(fila.n)]));
};
