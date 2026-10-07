// LECTURAS QUE CRUZAN: el acceso a un hilo de proceso, visto desde `chat`.
//
// ⚠️ ESTO VIVE EN `datos/consulta/` Y NO EN `datos/` A PROPÓSITO. Las tres consultas de aquí no
// nombran **ni una** tabla de `chat`: leen `tasks`, `task_items` y `process_definition_versions`
// (`procesos`/`tareas`) y `units`/`unit_positions`/`position_assignments` (`organizacion`). La regla
// es que `datos/` sólo nombre tablas de su dominio —lo comprueba la comprobación **E**— y que lo que
// cruza esté **separado**, no prohibido.
//
// Leer de otro dominio no necesita permiso; ESCRIBIR sí, y aquí no se escribe nada. Vinieron de
// `services/ChatAuthorizationService.js`, que se queda con TODAS las reglas: el 400, el 403 de «no
// tienes acceso operativo», el 409 de «más de una unidad accesible» y el cómputo de los conjuntos.
//
// El predicado de participación es `accessSubqueryCorrelated`, el MISMO que usa el guard de
// entregables: no es una copia.
import {
  ACCESS_LEVELS,
  accessSubqueryCorrelated,
} from "../../../../services/documents/DeliverableAccessService.js";

// Las tareas del proceso a las que esta persona tiene acceso, con su unidad de alcance.
export const tareasAccesiblesDelProceso = async (ejecutor, processId, personId) => {
  // AQUÍ NO VA el guard del IDOR de entregables
  // (`AND (ti.responsible_position_id IS NULL OR ta.position_id = ti.responsible_position_id)`,
  // ver `services/users/UserWorkspaceRepository.js`, en `getUserDocumentCenterRows`). No es una copia que se quedó atrás:
  // se evaluó el 2026-08-09 (plan maestro 1.9) y se descartó, por tres motivos.
  //
  // 1. Aquel guard responde «¿es TUYO este entregable?» y protege consultas cuya FILA es un
  //    entregable. Esta no lo es: el thread es del PROCESO en una unidad. El `LEFT JOIN
  //    task_items` solo abanica filas, y lo único que se proyecta —`scope_unit_id`— es IDÉNTICO
  //    en todas las filas de una tarea: hoy sale directo de `tasks.scope_unit_id`.
  // 2. La lista de participantes de más abajo mete a TODOS los que responden de algún entregable
  //    de la unidad, sin filtrar por cuál. Añadir el guard SOLO aquí dejaría gente dentro del
  //    hilo (recibe los mensajes) y con 403 al abrirlo.
  // 3. Medido contra la base de dev: no recorta el conjunto de unidades de nadie, lo VACÍA. Ocho
  //    de las diez personas asignadas a la tarea 8 (proceso 1, unidad 8) pasaban de `{8}` a
  //    ninguna unidad accesible. Y el corte dependería de datos ajenos: en la tarea 9 (misma
  //    forma, 10 asignados, 0 entregables) el `LEFT JOIN` deja `ti` a NULL y las diez conservan
  //    el acceso, así que el hilo se le caería a ocho de ellas en cuanto un COMPAÑERO creara el
  //    primer entregable.
  const [rows] = await ejecutor.query(
    `SELECT DISTINCT
       t.id AS task_id,
       t.process_definition_id,
       pdv.process_id,
       -- La unidad la tiene la tarea directamente. Antes salia de un COALESCE de TRES joins
       -- —el puesto de la tarea, el del entregable, y el del dueño del documento— para acabar
       -- en el mismo valor: medido, coincide en las 13 tareas. El primero de los tres colgaba
       -- de tasks.responsible_position_id, que se retiro el 2026-08-23.
       t.scope_unit_id,
       ti.responsible_position_id AS task_item_responsible_position_id,
       ti.created_by_person_id
     -- El LEFT JOIN documents que habia aqui solo servia para proyectar owner_person_id, que
     -- ni se filtraba ni se leia aguas abajo: quien decide la pertenencia al hilo es
     -- accessSubqueryCorrelated, mas abajo. La columna se retiro el 2026-08-23 y el join con
     -- ella.
     FROM tasks t
     INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     LEFT JOIN task_items ti ON ti.task_id = t.id
     WHERE pdv.process_id = ?
       -- El conjunto de participantes lo declara DeliverableAccessService, al nivel ANCHO
       -- (conversacion): un hilo de proceso incluye a todos los asignados de la tarea, no
       -- solo al responsable del entregable. Eso NO es el IDOR relajado, es la decision del
       -- defecto 1.9, medida y escrita justo arriba.
       --
       -- El alcance es correlacionado con ti, que el LEFT JOIN de esta consulta ya trae.
       AND EXISTS (
         SELECT 1
         FROM (${accessSubqueryCorrelated("ti", ACCESS_LEVELS.CONVERSACION)}) participantes
         WHERE participantes.person_id = ?
       )`,
    // Ocho `personId` en uno: el resto los absorbio la subconsulta.
    [processId, personId]
  );
  return rows || [];
};

// Quién MODERA el hilo: la jefatura de la unidad, más quien encargó un entregable en ella.
export const moderadoresDelHilo = async (ejecutor, processId, scopeUnitId) => {
  const [rows] = await ejecutor.query(
    `SELECT DISTINCT person_id
     FROM (
       -- Quien MODERA el hilo. Colgaba del puesto responsable de la TAREA, que el lanzamiento
       -- ponia como el puesto de menor slot_no de la unidad: o sea, moderaba quien ocupara un
       -- puesto cualquiera. Con esa columna retirada (2026-08-23) pasa a ser la JEFATURA de la
       -- unidad, que es el mismo criterio ya decidido para el custodio y para unit_head.
       SELECT pa.person_id
       FROM tasks t
       INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       INNER JOIN unit_positions up
         ON up.unit_id = t.scope_unit_id
        AND up.is_unit_head = 1
        AND up.is_active = 1
       INNER JOIN position_assignments pa
         ON pa.position_id = up.id
        AND pa.is_current = 1
       WHERE pdv.process_id = ?
         AND t.scope_unit_id = ?
       UNION
       -- Quien ENCARGO un entregable de esta unidad. Antes salia del creador de la TAREA,
       -- retirado el 2026-08-23 por estar NULL en el camino automatico.
       SELECT ti.created_by_person_id AS person_id
       FROM task_items ti
       INNER JOIN tasks t ON t.id = ti.task_id
       INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       WHERE pdv.process_id = ?
         AND t.scope_unit_id = ?
         AND ti.created_by_person_id IS NOT NULL
     ) admins
     WHERE person_id IS NOT NULL`,
    [processId, scopeUnitId, processId, scopeUnitId]
  );
  return rows || [];
};

// Los rótulos del hilo: nombre del proceso y etiqueta de la unidad. `null` si no hay fila.
export const etiquetasDelHilo = async (ejecutor, processId, scopeUnitId) => {
  const [rows] = await ejecutor.query(
    `SELECT DISTINCT
       p.name AS process_name,
       COALESCE(u.label, u.name) AS scope_unit_label
     FROM process_definition_versions pdv
     INNER JOIN processes p ON p.id = pdv.process_id
     INNER JOIN tasks t ON t.process_definition_id = pdv.id
     INNER JOIN units u ON u.id = t.scope_unit_id
     WHERE pdv.process_id = ?
       AND u.id = ?
     LIMIT 1`,
    [processId, scopeUnitId]
  );
  return rows?.[0] ?? null;
};
