// LOS DOCUMENTOS YA FIRMADOS, PARA ELEGIR EL DE UN ACTO (frente 27, F27.P4.T24).
//
// Quien enlaza un acto con su documento no conoce el id de una versión: conoce el entregable, el
// proceso del que salió y la unidad. Esta lectura los junta, para buscar por cualquiera de los tres.
//
// ⚠️ `datos/consulta/` porque CRUZA: de `tareas` son `document_versions`, `task_items`, `tasks` y
// `acto_documentos`; el nombre del entregable sale de `plantillas`, el del proceso de `procesos` y
// el de la unidad de `organizacion`. Aquí no se escribe nada.
//
// Sólo entran las versiones cuya firma terminó, y sólo las que no están ya enlazadas a otro acto.
export const ESTADOS_CON_FIRMA_COMPLETA = Object.freeze(["Firmado completo", "Final", "Archivado"]);

export const buscarDocumentosFirmados = async (ejecutor, texto = "") => {
  const buscado = String(texto || "").trim();
  const [filas] = await ejecutor.query(
    `SELECT dv.id, dv.version_label, dv.status,
            TO_CHAR(dv.created_at, 'YYYY-MM-DD') AS fecha,
            COALESCE(NULLIF(ti.title, ''), cd.display_name) AS entregable,
            p.name AS proceso, u.name AS unidad
       FROM document_versions dv
       JOIN task_items ti ON ti.id = dv.task_item_id
       JOIN tasks t ON t.id = ti.task_id
       JOIN units u ON u.id = t.scope_unit_id
       JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       JOIN lineas lin ON lin.id = pdv.linea_id
       JOIN processes p ON p.id = lin.process_id
       JOIN vinculos vin ON vin.id = ti.vinculo_id
       JOIN ediciones ed ON ed.id = vin.edicion_id
       JOIN catalogo_documental cd ON cd.id = ed.catalogo_documental_id
      WHERE dv.status IN (?, ?, ?)
        AND NOT EXISTS (SELECT 1 FROM acto_documentos ad WHERE ad.document_version_id = dv.id)
        AND (? = '' OR (COALESCE(NULLIF(ti.title, ''), cd.display_name) || ' ' || p.name || ' ' || u.name) ILIKE ?)
      ORDER BY dv.created_at DESC, dv.id DESC
      LIMIT 30`,
    [...ESTADOS_CON_FIRMA_COMPLETA, buscado, `%${buscado}%`]
  );
  return filas;
};
