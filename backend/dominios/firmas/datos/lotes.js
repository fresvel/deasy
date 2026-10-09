// EL SQL DE `firmas` — y es TODO el que este dominio tiene de suyo: tres consultas sobre
// `signature_batch_jobs`, la tabla de los lotes que se mandan al servicio que firma los PDF.
//
// La otra tabla del dominio, `signature_statuses`, NO SALE AQUI y no es un olvido: es un catalogo
// de nivel 0 que siembra el propio esquema y que nadie escribe. Lo que la lee son los vocabularios
// de estado de `services/documents/`, que es de `tareas`.
//
// Lo que CRUZA a otros dominios vive en `datos/consulta/`, separado a proposito (regla E).
import { getPostgresPool } from "../../../config/postgres.js";

// ⚠️ EL POOL SE RESUELVE AL PRIMER USO, no al importar. Los tres ficheros que este dominio
// absorbio --`PdfSigningService`, `BatchSigningService` y el controlador-- hacian
// `const pool = getPostgresPool();` EN LA COLUMNA CERO, asi que capturaban el valor del momento del
// import. Si el modulo entra antes de que la conexion exista, `pool` queda `undefined` PARA SIEMPRE
// y dos endpoints contestan «La conexion a PostgreSQL no esta disponible» mandandote a buscar un
// problema de base de datos que no existe.
//
// Funcionaba por orden de carga, y meter el dominio tras una puerta es EXACTAMENTE lo que cambia ese
// orden: la puerta solo decide quien entra primero. Es la misma forma del fallo que `check:instancias`
// persigue --que no lo ve, porque busca `new` y esto es una llamada-- y que mordio cuatro veces el
// 2026-10-07, una por cada dominio que se movio.
const pool = () => {
  const p = getPostgresPool();
  if (!p) throw new Error("La conexión a PostgreSQL no está disponible.");
  return p;
};

// Crea o actualiza el lote. El `ON DUPLICATE KEY UPDATE` es sintaxis de MySQL y PostgreSQL la
// rechaza, pero aqui NO es el defecto de siempre: `translateDialect` de `config/postgres.js` la
// reescribe a `ON CONFLICT (job_id) DO UPDATE SET … = EXCLUDED.…`, infiriendo el target de la clave
// primaria `job_id`. Comprobado el 2026-10-09, y lo cubre el golden `sign_batch`.
export const guardarLote = async (job) => {
  await pool().query(
    `INSERT INTO signature_batch_jobs
       (job_id, user_id, sign_mode, status, total, processed, success_count, failed_count, results)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id), sign_mode = VALUES(sign_mode), status = VALUES(status),
       total = VALUES(total), processed = VALUES(processed), success_count = VALUES(success_count),
       failed_count = VALUES(failed_count), results = VALUES(results)`,
    [
      job.jobId,
      job.userId ?? null,
      job.signMode ?? null,
      job.status,
      job.total ?? 0,
      job.processed ?? 0,
      job.successCount ?? 0,
      job.failedCount ?? 0,
      JSON.stringify(job.results ?? []),
    ]
  );
};

// La fila cruda del lote, o `undefined`. Quien decide si quien pregunta tiene derecho a verla es el
// servicio: aqui no hay regla, solo la lectura.
export const leerLoteCrudo = async (jobId) => {
  const [rows] = await pool().query(
    "SELECT * FROM signature_batch_jobs WHERE job_id = ? LIMIT 1",
    [jobId]
  );
  return rows?.[0];
};
