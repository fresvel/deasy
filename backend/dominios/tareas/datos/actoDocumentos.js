// EL DOCUMENTO FIRMADO DE UN ACTO: el único escritor de `acto_documentos` (frente 27, D-05;
// F27.P4.T24). Cuando el papel de un acto se produjo y se firmó aquí, no se adjunta: se enlaza a la
// versión del documento. La tabla vive en `tareas` porque apunta a `document_versions`, y una clave
// ajena no sube de nivel.
//
// Lo que NO puede pasar lo impide la base: que el acto tenga además un fichero adjunto
// (`rechazar_documento_si_hay_adjunto`) y que se desenlace cuando el acto ya ordena algo
// (`proteger_documento_de_acto`).
export const enlazarDocumentoAlActo = async (ejecutor, actoId, documentVersionId) => {
  await ejecutor.query(
    `INSERT INTO acto_documentos (acto_id, document_version_id)
     VALUES (?, ?)`,
    [Number(actoId), Number(documentVersionId)]
  );
};

export const desenlazarDocumentoDelActo = async (ejecutor, actoId) => {
  const [resultado] = await ejecutor.query(
    `DELETE FROM acto_documentos
      WHERE acto_id = ?`,
    [Number(actoId)]
  );
  return Number(resultado.affectedRows || 0);
};
