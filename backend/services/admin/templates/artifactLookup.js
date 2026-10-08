// Las dos búsquedas por id que necesitan las descargas y la edición del contrato jinja2.
// Lectura, sin reglas: devuelven la fila o `null`, y quien decide el 404 es su llamador.
//
// ⚠️ VIVÍAN EN `controllers/admin/sql_admin_controller.js` HASTA EL 2026-10-07 (F7.2). No van en
// `artifacts.js`, que declara ser de «funciones puras (sin BD ni this)» y lo es.
//
// ⚠️ Y AQUÍ SÍ HUBO UNA FUSIÓN, no sólo un traslado: el controller tenía la MISMA consulta DOS veces
// —una con `d.display_name` y otra sin él, mismo FROM, mismo WHERE, mismo LIMIT—. Queda una, que
// proyecta la columna de más; quien no la usa la ignora. Lo confirman los goldens.

export const findTemplateArtifactById = async (pool, id) => {
  const [rows] = await pool.query(
    `SELECT ta.id, d.code AS template_code, d.display_name, ta.available_formats
       FROM ediciones ta LEFT JOIN catalogo_documental d ON d.id = ta.catalogo_documental_id
      WHERE ta.id = ? LIMIT 1`,
    [id]
  );
  return rows?.[0] ?? null;
};

export const findGeneradorDeDocumentoById = async (pool, id) => {
  const [rows] = await pool.query(
    "SELECT id, code, nombre, source_path FROM generadores_de_documento WHERE id = ? LIMIT 1",
    [id]
  );
  return rows?.[0] ?? null;
};
