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
        WHERE pdv.process_id = ?
          AND t.scope_unit_id = ?`,
  params: ({ processId, scopeUnitId }) => [Number(processId), Number(scopeUnitId)],
};

// El tercero: **correlacionado**. No lleva parámetro — el entregable lo pone la consulta de
// fuera, que ya lo tiene a mano. Es lo que necesitan las consultas de LISTA (el panel, el centro
// de documentos), que filtran muchos entregables de una vez y no pueden pasar un id por cada uno.
const scopeByCorrelatedItem = (outerAlias) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(String(outerAlias))) {
    throw new Error(`Alias externo inválido: ${outerAlias}`);
  }
  return {
    key: "correlated_item",
    cte: `SELECT ti_acc.id AS task_item_id, ti_acc.task_id
          FROM task_items ti_acc
          WHERE ti_acc.id = ${outerAlias}.id`,
    params: () => [],
  };
};

// ── Las fuentes ─────────────────────────────────────────────────────────────────────────
// Cada fila: de dónde sale la persona y con qué etiqueta entra. Ninguna lleva parámetros
// propios a propósito — todas cuelgan de `alcance`, así que el conteo de parámetros de la
// consulta final es SIEMPRE el del ancla. Es lo que impide que el defecto 1.11 (parámetros de
// más ignorados en silencio) se cuele por aquí.
//
// El orden es el de la vida del entregable: a quién se dirigió → quién lo tiene → quién lo
// trabajó → quién habló de él.

// Los dos niveles, del más estrecho al más ancho. `conversacion` INCLUYE a `entregable`.
//
// **Decisión del dueño (2026-08-22): participar en un entregable da las DOS cosas, verlo y
// comentarlo.** Antes eran umbrales distintos —quien lanzaba la tarea veía el entregable y no
// podía comentarlo— y la distinción se retira a propósito: si alguien pinta en el conjunto de
// participantes, participa.
//
// Lo que NO entra aquí: resolver una observación. Eso depende de la observación concreta (su
// autor), no de la relación con el entregable, así que sigue decidiéndose en su sitio.
export const ACCESS_LEVELS = Object.freeze({
  ENTREGABLE: "entregable",
  CONVERSACION: "conversacion",
});

export const ACCESS_SOURCES = Object.freeze([
  {
    key: "entregable_destinatario",
    grants: ACCESS_LEVELS.ENTREGABLE,
    reason: "El entregable nombra a esta persona",
    sql: `SELECT ti_src.target_person_id AS person_id
          FROM task_items ti_src
          INNER JOIN alcance a ON a.task_item_id = ti_src.id
          WHERE ti_src.target_person_id IS NOT NULL`,
  },
  {
    key: "entregable_asignado",
    grants: ACCESS_LEVELS.ENTREGABLE,
    reason: "Es quien tiene asignado el entregable",
    sql: `SELECT ti_src.assigned_person_id AS person_id
          FROM task_items ti_src
          INNER JOIN alcance a ON a.task_item_id = ti_src.id
          WHERE ti_src.assigned_person_id IS NOT NULL`,
  },
  {
    // ── EL ARREGLO DEL IDOR, y por eso esta fuente está ACOTADA ────────────────────────
    // No es «los asignados de la tarea»: es «el asignado del puesto responsable DE ESTE
    // entregable». La diferencia se midió y es enorme: el entregable 4 tiene once personas
    // asignadas a su tarea. Un proceso dirigido a un cargo crea UNA tarea por unidad con UN
    // entregable por persona, y todos sus responsables cuelgan de esa MISMA tarea; sin la
    // acotación, cualquiera de ellos pasaba el guard del entregable ajeno y descargaba su PDF
    // (verificado en su día: HTTP 200 con el documento de otro).
    //
    // La excepción del `IS NULL` es la de `getAccessibleTaskItemForUser` y se copia tal cual:
    // si el entregable no tiene responsable propio, la tarea es de responsable único y el
    // alcance de tarea SÍ vale.
    key: "puesto_responsable_asignado",
    grants: ACCESS_LEVELS.ENTREGABLE,
    reason: "Tiene asignado el puesto responsable de este entregable",
    sql: `SELECT ta.assigned_person_id AS person_id
          FROM task_assignments ta
          INNER JOIN alcance a ON a.task_id = ta.task_id
          INNER JOIN task_items ti_src ON ti_src.id = a.task_item_id
          WHERE ta.assigned_person_id IS NOT NULL
            AND (ti_src.responsible_position_id IS NULL
                 OR ta.position_id = ti_src.responsible_position_id)`,
  },
  {
    // La otra mitad del guard real: cuando la asignación de la tarea está VACÍA, cuenta quien
    // OCUPA hoy ese puesto. Es la fuente 8 del diseño — y resulta que ya existía aquí, cosa que
    // el diagnóstico inicial daba por ausente en los dos guards.
    key: "puesto_responsable_ocupante",
    grants: ACCESS_LEVELS.ENTREGABLE,
    reason: "Ocupa hoy el puesto responsable, y su asignación está vacía",
    sql: `SELECT pa.person_id AS person_id
          FROM task_assignments ta
          INNER JOIN alcance a ON a.task_id = ta.task_id
          INNER JOIN task_items ti_src ON ti_src.id = a.task_item_id
          INNER JOIN position_assignments pa
            ON pa.position_id = ta.position_id
           AND pa.is_current = 1
          WHERE ta.assigned_person_id IS NULL
            AND (ti_src.responsible_position_id IS NULL
                 OR ta.position_id = ti_src.responsible_position_id)`,
  },
  {
    // La ANCHA, y sólo para la conversación del proceso: un hilo de proceso es más ancho que un
    // documento a propósito. Al nivel de entregable esto ES el IDOR.
    key: "tarea_asignado",
    grants: ACCESS_LEVELS.CONVERSACION,
    reason: "Quedó asignada a algún puesto de la tarea (sólo alcanza al hilo del proceso)",
    sql: `SELECT ta.assigned_person_id AS person_id
          FROM task_assignments ta
          INNER JOIN alcance a ON a.task_id = ta.task_id
          WHERE ta.assigned_person_id IS NOT NULL`,
  },
  {
    // ⚠️ Nivel de ENTREGABLE, y no es una ampliación: `getAccessibleTaskItemForUser` ya lo
    // incluye en su WHERE, así que dejarlo fuera le quitaría al creador de la tarea una
    // visibilidad que hoy tiene — un 404 donde hoy hay un 200.
    key: "tarea_creador",
    grants: ACCESS_LEVELS.ENTREGABLE,
    reason: "Lanzó la tarea que produjo el entregable",
    sql: `SELECT t.created_by_user_id AS person_id
          FROM tasks t
          INNER JOIN alcance a ON a.task_id = t.id
          WHERE t.created_by_user_id IS NOT NULL`,
  },
  // ── `documento_dueno` NO es una fuente, y esto se midió ───────────────────────────────
  // Estuvo en la lista durante P1 y se retiró al comparar contra la base: en el entregable 4,
  // `documents.owner_person_id` vale 24 mientras la cascada resuelve 3 — el valor está RANCIO,
  // que es exactamente el modo de fallo por el que esa columna se muere en P6. Concederle
  // acceso sería repartir un permiso por un dato desincronizado.
  //
  // Y no se pierde nada: la cascada que esa columna materializa ya está cubierta entera por
  // `entregable_destinatario`, `entregable_asignado` y las dos del puesto responsable.
  {
    key: "flujo_entrega",
    grants: ACCESS_LEVELS.ENTREGABLE,
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
    grants: ACCESS_LEVELS.ENTREGABLE,
    reason: "Participó en el flujo de firma",
    sql: `SELECT sr.assigned_person_id AS person_id
          FROM signature_requests sr
          INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
          INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
          INNER JOIN documents d ON d.id = dv.document_id
          INNER JOIN alcance a ON a.task_item_id = d.task_item_id
          WHERE sr.assigned_person_id IS NOT NULL`,
  },
  // ── LAS DOS FUENTES DE OBSERVACION SE RETIRARON el 2026-08-23 ─────────────────────────
  // `observacion_autor` era REDUNDANTE: para escribir una observacion hay que haber pasado el
  // guard, asi que nunca anadia a nadie que no estuviera ya dentro.
  //
  // `observacion_destinatario` era peor que redundante. La columna salia del cuerpo de la
  // peticion SIN VALIDAR, asi que cualquiera con acceso podia nombrar a CUALQUIERA: usarla como
  // fuente de acceso habria sido una via de escalada de privilegios —te doy permiso poniendote
  // de destinatario de un comentario—. La columna se borro entera: 2 observaciones, cero con
  // destinatario, y el frontend no la pintaba en ningun sitio.
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
  if (level === ACCESS_LEVELS.ENTREGABLE) {
    return ACCESS_SOURCES.filter((source) => source.grants === ACCESS_LEVELS.ENTREGABLE);
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
 * El SQL del conjunto de participantes de UN entregable, para incrustarlo en una consulta mayor
 * que ya tiene el entregable a mano. Lleva **un** placeholder (el id del entregable) y hay que
 * pasarlo en su posición.
 *
 * Existe porque `getAccessibleTaskItemForUser` filtra Y proyecta treinta columnas en la misma
 * consulta: partirla en dos viajes por un guard de una fila no compensa.
 */
export const accessSubqueryForTaskItem = (level = ACCESS_LEVELS.ENTREGABLE) =>
  buildAccessQuery(SCOPE_BY_TASK_ITEM, sourcesForLevel(level));

/**
 * El SQL del conjunto de participantes **correlacionado** con el entregable de la consulta de
 * fuera. **No lleva ningún placeholder**: el ancla es el alias que se le pasa.
 *
 * Para las consultas de lista, donde cada fila es un entregable distinto y pasar un parámetro por
 * fila no es posible.
 */
export const accessSubqueryCorrelated = (outerAlias, level = ACCESS_LEVELS.ENTREGABLE) =>
  buildAccessQuery(scopeByCorrelatedItem(outerAlias), sourcesForLevel(level));

// ⚠️ Aquí vivieron `listDeliverableParticipants` y `isDeliverableParticipant`, y se retiraron
// el mismo día que nacieron (2026-08-22). No sobraban por error de diseño: sobran porque al
// cablear los guards la comprobación subió al ÚNICO sitio por el que pasan todos —el gate que
// devuelve 404— y abajo dejó de haber nada que preguntar. Un booleano por entregable no tiene
// hoy ningún llamador, y este repositorio borra lo que no se ve.
//
// Si vuelve a hacer falta, son cuatro líneas sobre `accessSubqueryForTaskItem`.

/** Sólo para pruebas y para depurar: la consulta que se va a ejecutar. */
export const __buildAccessQuery = buildAccessQuery;
export const __SCOPES = Object.freeze({ SCOPE_BY_TASK_ITEM, SCOPE_BY_PROCESS_UNIT });
