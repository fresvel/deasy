// LOS DOCUMENTOS DE IDENTIDAD de una persona (`documentos_identidad`). Sólo SQL.
//
// Las reglas están todas en `services/DocumentoIdentidadService.js` y son muchas: qué tipos acreditan
// identidad, que el país se resuelva ANTES de validar el número, que cambiar de documento desverifique
// y además suelte el escaneo. Aquí no se decide nada de eso.
//
// Vive en `datos/` porque nombra sólo `documentos_identidad`. Lo que mira el catálogo territorial está
// en `datos/consulta/`.

// Cuántas personas distintas tienen ESE número, hasta dos. `LIMIT 2` y `DISTINCT` no son adorno: con
// dos basta para saber que es ambiguo, y una misma persona puede tener dos documentos con el mismo
// número —un pasaporte y un documento extranjero— que no es ambigüedad, es la misma respuesta dos
// veces. Quien interpreta el resultado es el servicio.
export const personasConElNumero = async (ejecutor, numero) => {
  const [filas] = await ejecutor.query(
    `SELECT DISTINCT person_id FROM documentos_identidad WHERE numero = ? AND is_active = 1 LIMIT 2`,
    [numero]
  );
  return filas ?? [];
};

// Por la TERNA COMPLETA, donde la ambigüedad no puede existir: `uq_documentos_numero` es único sobre
// (tipo, país, número), así que o hay una fila o no hay ninguna.
export const personaPorTerna = async (ejecutor, tipo, paisId, numero) => {
  const [filas] = await ejecutor.query(
    `SELECT person_id FROM documentos_identidad
      WHERE tipo = ? AND pais_id = ? AND numero = ? AND is_active = 1
      LIMIT 1`,
    [tipo, paisId, numero]
  );
  return filas?.length ? Number(filas[0].person_id) : null;
};

export const otroDuenoDelDocumento = async (ejecutor, tipo, paisId, numero, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT d.id FROM documentos_identidad d
      WHERE d.tipo = ? AND d.pais_id = ? AND d.numero = ?
        AND d.person_id <> ? LIMIT 1`,
    [tipo, paisId, numero, personId]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

// El principal tal cual está, con su escaneo, para decidir si el número cambia y qué pasa con el PDF.
export const principalCrudo = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, numero, verificado, escaneo_ref FROM documentos_identidad WHERE person_id = ? AND principal = 1 LIMIT 1`,
    [personId]
  );
  return filas?.[0] ?? null;
};

// `desverificar` lo decide el servicio, y arrastra el escaneo con él: ese PDF es del documento viejo,
// y dejarlo colgando del nuevo sería peor que no tenerlo —parece que hay respaldo y no lo hay—.
export const actualizarPrincipal = async (ejecutor, documentoId, { tipo, paisId, numero, desverificar }) => {
  await ejecutor.query(
    `UPDATE documentos_identidad
        SET tipo = ?, pais_id = ?, numero = ?${desverificar ? ", verificado = 0, verificado_at = NULL, escaneo_ref = NULL, escaneo_subido_at = NULL" : ""}
      WHERE id = ?`,
    [tipo, paisId, numero, Number(documentoId)]
  );
};

export const insertarPrincipal = async (ejecutor, personId, tipo, paisId, numero) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO documentos_identidad (person_id, tipo, pais_id, numero, principal) VALUES (?, ?, ?, ?, 1)`,
    [personId, tipo, paisId, numero]
  );
  return resultado?.insertId ?? null;
};

export const referenciaDeEscaneo = async (ejecutor, documentoId) => {
  const [filas] = await ejecutor.query(
    `SELECT escaneo_ref FROM documentos_identidad WHERE id = ? LIMIT 1`,
    [Number(documentoId)]
  );
  return filas?.[0]?.escaneo_ref ?? null;
};

export const guardarReferenciaDeEscaneo = async (ejecutor, documentoId, referencia) => {
  await ejecutor.query(
    `UPDATE documentos_identidad SET escaneo_ref = ?, escaneo_subido_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [referencia, Number(documentoId)]
  );
};

// La referencia cruda, para el handler que hace el stream. No sale por la API.
export const documentoParaDescarga = async (ejecutor, documentoId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, person_id, escaneo_ref FROM documentos_identidad WHERE id = ? AND is_active = 1 LIMIT 1`,
    [Number(documentoId)]
  );
  return filas?.[0] ?? null;
};

export const principalVigente = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, person_id, numero, escaneo_ref
       FROM documentos_identidad
      WHERE person_id = ? AND principal = 1 AND is_active = 1
      LIMIT 1`,
    [personId]
  );
  return filas?.[0] ?? null;
};

export const marcarVerificado = async (ejecutor, documentoId) => {
  await ejecutor.query(
    `UPDATE documentos_identidad SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [Number(documentoId)]
  );
};
