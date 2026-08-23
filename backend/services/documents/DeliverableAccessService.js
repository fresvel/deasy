// Quién tiene derecho a ver un entregable.
//
// ── Por qué existe ──────────────────────────────────────────────────────────────────────
// Hasta el 2026-08-22 esta pregunta se contestaba en DOS sitios, con DOS conjuntos distintos:
//
//   · `isUserInTaskItemChain` (DocumentObservationService) miraba entrega y firma;
//   · `ChatAuthorizationService` miraba esas dos MÁS el creador de la tarea, el asignado del
//     entregable, el asignado de la tarea por puesto y el dueño del documento.
//
// O sea: quien participaba en la conversación de un entregable podía no poder abrir su documento.
// No era una regla distinta a propósito — eran dos implementaciones de la misma que divergieron.
//
// Diseño completo y decisiones: `docs/planes/plan_data/acceso-al-entregable.md`.
//
// ── La forma, y por qué es una tabla ────────────────────────────────────────────────────
// Las fuentes se declaran como DATOS y un motor las une. Es el patrón que este repositorio ya
// tiene medido cuatro veces (`validateTableRules` 99→0, `postgres.js` 108→15): una cascada de
// condicionales sobre formas heterogéneas se cura con una tabla, no con una jerarquía.
//
// Añadir una fuente es añadir una fila. Y como cada una declara su `clave`, el resultado dice
// POR QUÉ entra cada persona, que es lo que hace auditable un permiso.
//
// ── El ancla ────────────────────────────────────────────────────────────────────────────
// Las dos preguntas vivas no tienen el mismo alcance:
//
//   · el guard del documento pregunta por UN entregable;
//   · el chat pregunta por los entregables de UN PROCESO dentro de UNA UNIDAD.
//
// Por eso el alcance viaja en un CTE (`alcance`) y las fuentes se escriben contra él sin saber
// cuál de los dos es. Si se resolviera dentro de cada fuente habría que escribirlas dos veces,
// que es exactamente el fallo que este módulo viene a cerrar.
//
// ── ⚠️ NO TODAS LAS FUENTES DAN EL MISMO ACCESO ─────────────────────────────────────────
// Medido contra la base el 2026-08-22, y es la razón de que este módulo tenga dos niveles:
// el entregable 4 tiene ONCE personas en `task_assignments` de su tarea. Dar acceso al
// DOCUMENTO por «estar asignado a algún puesto de la tarea» es **reabrir el IDOR que ya se
// cerró** —el guard miraba la TAREA y no el ENTREGABLE, y un docente descargaba el documento
// de otro—.
//
// Que el chat sí las incluya no es un descuido suyo: una CONVERSACIÓN de proceso es más ancha
// que un DOCUMENTO a propósito. Así que cada fuente declara **qué concede**:
//
//   `documento`    → ver y descargar ESE entregable. Es el nivel estrecho.
//   `conversacion` → participar en el hilo del proceso. Incluye al anterior.
//
// Mezclarlos en una sola lista es lo que habría convertido esta unificación en una regresión
// de seguridad.
//
// ⚠️ Este módulo NO se enchufa a ningún guard todavía: eso es el paso P2, y cambia
// comportamiento. Aquí sólo se construye la pieza, para que su red unitaria vaya delante.

import { getPostgresPool } from "../../config/postgres.js";

// ── Los alcances ────────────────────────────────────────────────────────────────────────
// Cada uno produce el CTE `alcance(task_item_id, task_id)` y sus parámetros. El resto del
// módulo no sabe cuál se está usando.

const SCOPE_BY_TASK_ITEM = {
  key: "task_item",
  cte: `SELECT ti.id AS task_item_id, ti.task_id
        FROM task_items ti
        WHERE ti.id = ?`,
  params: ({ taskItemId }) => [Number(taskItemId)],
};

// El chat ancla por proceso Y unidad de alcance, y la unidad sale del PUESTO RESPONSABLE DE LA
// TAREA, no del entregable. Se conserva ese criterio tal cual: cambiarlo aquí sería mover la
// frontera de una conversación sin decirlo.
const SCOPE_BY_PROCESS_UNIT = {
  key: "process_unit",
  cte: `SELECT ti.id AS task_item_id, ti.task_id
        FROM task_items ti
        INNER JOIN tasks t ON t.id = ti.task_id
        INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
        INNER JOIN unit_positions up ON up.id = t.responsible_position_id
        WHERE pdv.process_id = ?
          AND up.unit_id = ?`,
  params: ({ processId, scopeUnitId }) => [Number(processId), Number(scopeUnitId)],
};

// ── Las fuentes ─────────────────────────────────────────────────────────────────────────
// Cada fila: de dónde sale la persona y con qué etiqueta entra. Ninguna lleva parámetros
// propios a propósito — todas cuelgan de `alcance`, así que el conteo de parámetros de la
// consulta final es SIEMPRE el del ancla. Es lo que impide que el defecto 1.11 (parámetros de
// más ignorados en silencio) se cuele por aquí.
//
// El orden es el de la vida del entregable: a quién se dirigió → quién lo tiene → quién lo
// trabajó → quién habló de él.

// Los dos niveles, del más estrecho al más ancho. `conversacion` INCLUYE a `documento`.
export const ACCESS_LEVELS = Object.freeze({
  DOCUMENTO: "documento",
  CONVERSACION: "conversacion",
});

export const ACCESS_SOURCES = Object.freeze([
  {
    key: "entregable_destinatario",
    grants: ACCESS_LEVELS.DOCUMENTO,
    reason: "El entregable nombra a esta persona",
    sql: `SELECT ti.target_person_id AS person_id
          FROM task_items ti
          INNER JOIN alcance a ON a.task_item_id = ti.id
          WHERE ti.target_person_id IS NOT NULL`,
  },
  {
    key: "entregable_asignado",
    grants: ACCESS_LEVELS.DOCUMENTO,
    reason: "Es quien tiene asignado el entregable",
    sql: `SELECT ti.assigned_person_id AS person_id
          FROM task_items ti
          INNER JOIN alcance a ON a.task_item_id = ti.id
          WHERE ti.assigned_person_id IS NOT NULL`,
  },
  {
    key: "tarea_asignado",
    grants: ACCESS_LEVELS.CONVERSACION,
    reason: "Quedó asignada a un puesto de la tarea",
    sql: `SELECT ta.assigned_person_id AS person_id
          FROM task_assignments ta
          INNER JOIN alcance a ON a.task_id = ta.task_id
          WHERE ta.assigned_person_id IS NOT NULL`,
  },
  {
    key: "tarea_creador",
    grants: ACCESS_LEVELS.CONVERSACION,
    reason: "Lanzó la tarea que produjo el entregable",
    sql: `SELECT t.created_by_user_id AS person_id
          FROM tasks t
          INNER JOIN alcance a ON a.task_id = t.id
          WHERE t.created_by_user_id IS NOT NULL`,
  },
  {
    // Muere en el paso P6 con la fusión: hoy es la cascada del dueño materializada al crear el
    // documento. Se conserva mientras la columna exista para que P1 no cambie comportamiento.
    key: "documento_dueno",
    grants: ACCESS_LEVELS.DOCUMENTO,
    reason: "Consta como propietario del documento",
    sql: `SELECT d.owner_person_id AS person_id
          FROM documents d
          INNER JOIN alcance a ON a.task_item_id = d.task_item_id
          WHERE d.owner_person_id IS NOT NULL`,
  },
  {
    key: "flujo_entrega",
    grants: ACCESS_LEVELS.DOCUMENTO,
    reason: "Participó en el flujo de entrega",
    sql: `SELECT fr.assigned_person_id AS person_id
          FROM fill_requests fr
          INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
          INNER JOIN document_versions dv ON dv.id = dff.document_version_id
          INNER JOIN documents d ON d.id = dv.document_id
          INNER JOIN alcance a ON a.task_item_id = d.task_item_id
          WHERE fr.assigned_person_id IS NOT NULL`,
  },
  {
    key: "flujo_firma",
    grants: ACCESS_LEVELS.DOCUMENTO,
    reason: "Participó en el flujo de firma",
    sql: `SELECT sr.assigned_person_id AS person_id
          FROM signature_requests sr
          INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
          INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
          INNER JOIN documents d ON d.id = dv.document_id
          INNER JOIN alcance a ON a.task_item_id = d.task_item_id
          WHERE sr.assigned_person_id IS NOT NULL`,
  },
  {
    key: "observacion_autor",
    grants: ACCESS_LEVELS.DOCUMENTO,
    reason: "Escribió una observación sobre el entregable",
    sql: `SELECT o.author_person_id AS person_id
          FROM document_workflow_observations o
          INNER JOIN alcance a ON a.task_item_id = o.task_item_id
          WHERE o.author_person_id IS NOT NULL`,
  },
  {
    key: "observacion_destinatario",
    grants: ACCESS_LEVELS.DOCUMENTO,
    reason: "Una observación del entregable va dirigida a esta persona",
    sql: `SELECT o.target_person_id AS person_id
          FROM document_workflow_observations o
          INNER JOIN alcance a ON a.task_item_id = o.task_item_id
          WHERE o.target_person_id IS NOT NULL`,
  },
]);

// ── El motor ────────────────────────────────────────────────────────────────────────────

// Une las fuentes bajo el ancla. `UNION ALL` y no `UNION`: aquí NO se deduplica, porque una
// persona puede entrar por varios caminos y saber por cuántos es información — la deduplicación
// se hace arriba, al agrupar por persona.
const buildAccessQuery = (scope, sources) => {
  const branches = sources.map(
    (source) => `SELECT ${escapeSourceKey(source.key)} AS source_key, person_id
                 FROM (${source.sql}) AS ${source.key}_src`
  );
  return `WITH alcance AS (${scope.cte})
          SELECT source_key, person_id
          FROM (
            ${branches.join("\n            UNION ALL\n            ")}
          ) participantes
          WHERE person_id IS NOT NULL`;
};

// Las claves son literales del propio módulo, no entrada de usuario. Se escapan igualmente
// porque una clave nueva mal escrita reventaría la consulta entera y no una fuente.
const escapeSourceKey = (key) => {
  if (!/^[a-z_]+$/.test(String(key))) {
    throw new Error(`Clave de fuente de acceso inválida: ${key}`);
  }
  return `'${key}'`;
};

// Las fuentes que conceden un nivel: `conversacion` incluye a `documento`, no lo sustituye.
// Se escribe como inclusión explícita y no como «orden de la lista» porque un nivel nuevo entre
// medias rompería el orden en silencio, y esto decide permisos.
export const sourcesForLevel = (level) => {
  if (level === ACCESS_LEVELS.DOCUMENTO) {
    return ACCESS_SOURCES.filter((source) => source.grants === ACCESS_LEVELS.DOCUMENTO);
  }
  if (level === ACCESS_LEVELS.CONVERSACION) {
    return [...ACCESS_SOURCES];
  }
  throw new Error(`Nivel de acceso desconocido: ${level}`);
};

const runAccessQuery = async (connection, scope, anchor, level) => {
  const [rows] = await connection.query(
    buildAccessQuery(scope, sourcesForLevel(level)),
    scope.params(anchor)
  );
  return rows || [];
};

// Agrupa por persona conservando TODAS las razones por las que entra. Que una persona aparezca
// por cinco caminos y otra por uno es lo que permite explicar un permiso, y es la diferencia
// entre «tiene acceso» y «tiene acceso porque firmó el documento».
const groupBySource = (rows) => {
  const byPerson = new Map();
  for (const row of rows) {
    const personId = Number(row.person_id);
    if (!personId) continue;
    if (!byPerson.has(personId)) {
      byPerson.set(personId, { person_id: personId, sources: [] });
    }
    const entry = byPerson.get(personId);
    if (!entry.sources.includes(row.source_key)) {
      entry.sources.push(row.source_key);
    }
  }
  return [...byPerson.values()].sort((a, b) => a.person_id - b.person_id);
};

/**
 * Quiénes participan en UN entregable, y por qué.
 *
 * **Por defecto responde el nivel `documento`**, que es el estrecho — pedir el ancho tiene que
 * ser explícito. Al revés, un llamador despistado repartiría acceso al documento entre todos los
 * asignados de la tarea, que es el IDOR ya cerrado.
 *
 * Devuelve `[{ person_id, sources: ["flujo_firma", …] }]`, ordenado por id.
 */
export const listDeliverableParticipants = async (
  connection,
  taskItemId,
  level = ACCESS_LEVELS.DOCUMENTO
) => {
  const conn = connection || getPostgresPool();
  const rows = await runAccessQuery(conn, SCOPE_BY_TASK_ITEM, { taskItemId }, level);
  return groupBySource(rows);
};

/**
 * Quiénes participan en los entregables de un PROCESO dentro de una UNIDAD de alcance.
 * Es la forma que necesita el chat, con el mismo juego de fuentes que la de arriba.
 */
export const listProcessParticipants = async (connection, { processId, scopeUnitId }) => {
  const conn = connection || getPostgresPool();
  const rows = await runAccessQuery(
    conn, SCOPE_BY_PROCESS_UNIT, { processId, scopeUnitId }, ACCESS_LEVELS.CONVERSACION
  );
  return groupBySource(rows);
};

/**
 * ¿Tiene esta persona derecho a ver este entregable?
 *
 * Se resuelve en la base y no filtrando en memoria la lista completa: un entregable con muchos
 * pasos de firma puede traer decenas de filas para contestar un sí/no.
 */
export const isDeliverableParticipant = async (
  connection,
  taskItemId,
  personId,
  level = ACCESS_LEVELS.DOCUMENTO
) => {
  const person = Number(personId);
  if (!person) return false;

  const conn = connection || getPostgresPool();
  const [rows] = await conn.query(
    `SELECT 1 AS ok
     FROM (${buildAccessQuery(SCOPE_BY_TASK_ITEM, sourcesForLevel(level))}) participantes
     WHERE participantes.person_id = ?
     LIMIT 1`,
    [...SCOPE_BY_TASK_ITEM.params({ taskItemId }), person]
  );
  return Boolean(rows?.length);
};

/** Sólo para pruebas y para depurar: la consulta que se va a ejecutar. */
export const __buildAccessQuery = buildAccessQuery;
export const __SCOPES = Object.freeze({ SCOPE_BY_TASK_ITEM, SCOPE_BY_PROCESS_UNIT });
