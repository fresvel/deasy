// LA SUBIDA DEL ARCHIVO DE UN ENTREGABLE: su número de corrección y su asiento en la bitácora.
//
// ⚠️ ESTO VIVÍA EN `controllers/users/user_controler.js` HASTA EL 2026-10-07 (F7.2), con sus tres
// consultas y su transacción abierta a mano. Y una de esas tres escrituras era la que
// `_deuda_escritura` señalaba por fichero y línea: «controllers/users/user_controler.js:727 hace un
// UPDATE que corresponde a services/documents. Un controller es transporte no por norma, sino porque
// la regla queda fuera del sitio por donde pasan los demás caminos».
//
// Lo que NO está aquí, a propósito: resolver el entregable accesible, construir la ruta del objeto y
// subirlo a MinIO. Eso pasa ANTES y FUERA de la transacción, porque una transacción de base de datos
// no puede deshacer un objeto ya escrito en MinIO: abarcarla sería prometer una atomicidad que no
// existe.
import { conTransaccion } from "../../config/postgres.js";
import { transitionDocumentVersionState } from "./DocumentStateService.js";

// Los estados desde los que una subida ARRANCA el llenado. Era una condición suelta en el controller.
const ESTADOS_QUE_PASAN_A_EN_LLENADO = new Set(["Borrador", "Pendiente de llenado", "Observado"]);

// CADA SUBIDA ES UNA CORRECCION, y tiene su numero (2026-08-23). El siguiente menor se calcula ANTES
// de subir porque forma parte de la ruta del objeto: `…/v0001/m0003/working/pdf/…`, que se lee
// «ronda 1, correccion 3» sin consultar nada. Por eso esta lectura va fuera de la transacción.
export const nextUploadMinor = async (ejecutor, documentVersionId) => {
  const [rows] = await ejecutor.query(
    `SELECT COALESCE(MAX(minor), 0) + 1 AS siguiente
       FROM document_version_uploads
      WHERE document_version_id = ?`,
    [Number(documentVersionId)]
  );
  return Number(rows?.[0]?.siguiente || 1);
};

export const registrarSubidaDelEntregable = async ({
  documentVersionId,
  minor,
  filePath,
  fileName,
  mimeType,
  sizeBytes,
  uploadedByPersonId,
  currentStatus,
}) =>
  conTransaccion(async (conexion) => {
    // La BITACORA. Es lo que hasta el 2026-08-23 no existia: quien elaboro el documento no constaba
    // en ninguna parte, mientras que un ANEXO —material de apoyo— si guardaba quien lo subio.
    await conexion.query(
      `INSERT INTO document_version_uploads
         (document_version_id, minor, file_path, file_name, mime_type, size_bytes, uploaded_by_person_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(documentVersionId), minor, filePath, fileName, mimeType, sizeBytes, uploadedByPersonId]
    );

    // `working_file_path` sigue siendo EL ARCHIVO VIGENTE y no se mueve de sitio: son 74 lecturas en
    // el backend, y ninguna necesita saber de la bitacora. Lo que se sobrescribia y se perdia era el
    // puntero al anterior; ahora ese puntero vive en la bitacora, con su autor y su fecha.
    await conexion.query(
      `UPDATE document_versions
       SET working_file_path = ?,
           version_minor = ?
       WHERE id = ?`,
      [filePath, minor, Number(documentVersionId)]
    );

    if (ESTADOS_QUE_PASAN_A_EN_LLENADO.has(String(currentStatus || "").trim())) {
      await transitionDocumentVersionState(conexion, Number(documentVersionId), "En llenado");
    }
  });
