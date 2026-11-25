// LOS DOCUMENTOS DE UNA PERSONA con su país resuelto y la categoría de la visa.
//
// ⚠️ `datos/consulta/` por UNA tabla: `paises`, que es de **organizacion**. `documentos_identidad` y
// `categorias_visa` son las dos de `identidad`.
export const listarConPaisYVisa = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT d.id, d.tipo, d.numero, d.principal,
            d.pais_id, pa.iso_alpha2 AS pais_iso, pa.name AS pais,
            d.verificado, d.verificado_at, d.emitido_el, d.expira_el,
            -- La referencia minio:// NO sale al cliente: es interna y no le sirve a nadie fuera
            -- del backend. Lo que necesita quien pinta la pantalla es si HAY escaneo.
            (d.escaneo_ref IS NOT NULL) AS tiene_escaneo, d.escaneo_subido_at,
            -- La categoria SOLO la lleva la visa, y sin ella la visa no dice nada: "Visa
            -- (Ecuador)" no distingue a un residente permanente de un turista. El JOIN es LEFT
            -- porque los otros tres tipos no la tienen -- lo garantiza chk_documentos_categoria_visa.
            d.categoria_visa_id, cv.name AS categoria_visa, cv.condicion AS categoria_visa_condicion
       FROM documentos_identidad d
       LEFT JOIN paises pa ON pa.id = d.pais_id
       LEFT JOIN categorias_visa cv ON cv.id = d.categoria_visa_id
      WHERE d.person_id = ? AND d.is_active = 1
      ORDER BY d.principal DESC, d.id ASC`,
    [personId]
  );
  return filas ?? [];
};
