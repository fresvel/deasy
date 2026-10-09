// EL SQL DE `firmas` QUE CRUZA A OTROS DOMINIOS, separado aqui a proposito.
//
// POR QUE ESTA SEPARADO Y NO MEZCLADO CON `datos/`. La regla de propiedad dice que una tabla la
// escribe solo el `datos/` de su dominio dueño; la de lectura dice que leer fuera es LIBRE pero
// tiene que estar APARTE. Si lo que cruza vive revuelto con lo propio, nada distingue una lectura
// legitima de un error — y la asimetria esta medida: el 3 % de las escrituras del backend cruza
// dominios, el 29 % de las lecturas.
//
// LAS DOS CONSULTAS DE AQUI LEEN `tareas`, ni una escribe: `document_versions`, `task_items`,
// `tasks`, `recorridos` y `turnos`. Firmar un PDF necesita saber DONDE esta el archivo y QUIEN
// puede bajarlo, y esas dos cosas son hechos de la tarea, no de la firma.
import { getPostgresPool } from "../../../../config/postgres.js";

// Ver el porqué en `datos/lotes.js`: al primer uso, nunca al importar.
const pool = () => {
  const p = getPostgresPool();
  if (!p) throw new Error("La conexión a PostgreSQL no está disponible.");
  return p;
};

// Donde vive el archivo de una ronda: el de trabajo y el final.
export const rutasDeLaRonda = async (documentVersionId) => {
  const [rows] = await pool().query(
    `SELECT id, working_file_path, final_file_path
     FROM document_versions
     WHERE id = ?
     LIMIT 1`,
    [Number(documentVersionId)]
  );
  return rows?.[0] || null;
};

// ¿Puede esta persona bajar este documento firmado? Tres formas de responder sí, y las tres son
// participacion real en el entregable.
//
// ⚠️ ESTA CONSULTA ES UN GUARDIA DE ACCESO, no un detalle de almacenamiento: si devuelve `true` de
// mas, alguien baja el documento de otro. Hubo un IDOR aqui --el guardia miraba la TAREA y no el
// ENTREGABLE, asi que un docente bajaba el documento de su companero-- y por eso los tres terminos
// cuelgan del entregable y no de la tarea.
//
// La version cuelga DIRECTAMENTE del entregable desde el 2026-08-23: la tabla `documents` que habia
// en medio era una cascara 1:1 sin ni una columna propia, y se retiro con ella el JOIN que hacia
// falta para saltarla.
export const puedeAccederAlDocumento = async ({ userId, requestedPath }) => {
  const [rows] = await pool().query(
    `SELECT dv.id
     FROM document_versions dv
     LEFT JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN recorridos r ON r.document_version_id = dv.id AND r.accion = 'firma'
     LEFT JOIN turnos sr ON sr.recorrido_id = r.id
     WHERE (
       dv.working_file_path = ?
       OR dv.final_file_path = ?
     )
       AND (
         -- El d.owner_person_id = ? que abria este OR se retiro el 2026-08-23: era una COPIA de
         -- ti.assigned_person_id, el termino de al lado, tomada al crear el documento y
         -- refrescada por uno solo de los cuatro relevos. O sea que aportaba exactamente cero
         -- casos nuevos y podia dar acceso a quien ya no responde del entregable.
         ti.assigned_person_id = ?
         -- Quien ENCARGO el entregable. Antes era el creador de la TAREA, retirado el 2026-08-23:
         -- estaba NULL en el camino automatico, asi que como predicado de propiedad casi nunca
         -- respondia. El dato equivalente vive en la misma fila del entregable.
         OR ti.created_by_person_id = ?
         OR sr.persona_id = ?
       )
     LIMIT 1`,
    [requestedPath, requestedPath, Number(userId), Number(userId), Number(userId)]
  );
  return Boolean(rows?.length);
};
