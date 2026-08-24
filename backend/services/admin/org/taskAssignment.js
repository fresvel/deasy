// TaskAssignmentService — asignacion/reconciliacion de task items, handover, task items atascados y
// resolucion del jefe inmediato; ademas mapas de referencia (cargo/unit-type) y resolucion de scope y
// cargos resolubles de una configuracion. Extraido de SqlAdminService.js (God #1) por Extract Class
// (cut #6). Cluster AUTOCONTENIDO: solo this.pool + normalizeNumericId (import); cero colaboradores
// inyectados. SqlAdminService mantiene delegadores; el controller, saveTemplateArtifactDraft y el
// WorkflowSyncService (que llaman getCargoCodeMap/getProcessTargetScope/... via this.) no se tocan.
import { normalizeNumericId, slugify } from "../kernel/primitives.js";
import { isDocumentPending } from "../../documents/DocumentStateService.js";

export default class TaskAssignmentService {
  constructor(pool) {
    this.pool = pool;
  }


  async getCargoCodeMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, code, name
       FROM cargos
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedCode = slugify(row.code || "");
      const normalizedName = slugify(row.name || "");
      if (normalizedCode && !map.has(normalizedCode)) {
        map.set(normalizedCode, Number(row.id));
      }
      if (normalizedName && !map.has(normalizedName)) {
        map.set(normalizedName, Number(row.id));
      }
    }
    return map;
  }


  async getUnitTypeNameMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, name
       FROM unit_types
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedName = String(row.name || "").trim().toLowerCase();
      if (normalizedName && !map.has(normalizedName)) {
        map.set(normalizedName, Number(row.id));
      }
    }
    return map;
  }


  // Sets de ids válidos (activos) para validar EN AUTORÍA que las referencias del flujo existen en la
  // DB, antes de escribir las filas (no solo confiar en el select del front ni en las FKs al
  // materializar). Espejo de `getCargoCodeMap` para persona/unidad/tipo de unidad.
  //
  // VIVÍA EN `WorkflowSyncService` y se muda aquí con el sub-paso 8 del §0.8: es el único método de
  // aquella clase que no era andamiaje —lo consume `_validateAuthoredWorkflows`, que sobrevive—, y
  // este servicio es donde ya viven sus tres hermanos de catálogo.
  //
  // Traía un cuarto set, `positionIds`, para el resolutor `position`. Ese resolutor se retira en el
  // mismo sub-paso (decisión 1: lo que la web no autora, no existe), así que la consulta a
  // `unit_positions` se va con él: era la única que lo consumía.
  async getWorkflowReferenceIdSets(connection = this.pool) {
    const [persons, units, unitTypes] = await Promise.all([
      connection.query("SELECT id FROM persons WHERE is_active = 1"),
      connection.query("SELECT id FROM units WHERE is_active = 1"),
      connection.query("SELECT id FROM unit_types WHERE is_active = 1")
    ]);
    const toSet = (result) => new Set((result?.[0] || []).map((row) => Number(row.id)));
    return {
      personIds: toSet(persons),
      unitIds: toSet(units),
      unitTypeIds: toSet(unitTypes)
    };
  }


  // Ámbito resoluble de un proceso a partir de sus reglas objetivo activas: la unión de unidades que
  // las reglas pueden alcanzar (lo que en runtime fija la posición responsable → scope_unit_id). Se usa
  // para (a) habilitar/validar los ámbitos de contexto del flujo y (b) acotar el select de unidades a
  // las unidades realmente cubiertas. Sin reglas, los ámbitos de contexto resolverían null.
  async getProcessTargetScope(processDefinitionId, connection = this.pool) {
    const defId = normalizeNumericId(processDefinitionId);
    if (!defId) {
      return { has_rules: false, supports_context: false, all_units: false, unit_ids: [], cargo_ids: [] };
    }
    const [rules] = await connection.query(
      `SELECT unit_scope_type, unit_id, unit_type_id, cargo_id, position_id
         FROM process_target_rules
        WHERE process_definition_id = ? AND is_active = 1`,
      [defId]
    );
    if (!rules.length) {
      return { has_rules: false, supports_context: false, all_units: false, unit_ids: [], cargo_ids: [] };
    }
    const unitIds = new Set();
    const cargoIds = new Set();
    let allUnits = false;
    for (const rule of rules) {
      if (rule.cargo_id) {
        cargoIds.add(Number(rule.cargo_id));
      }
      const scope = String(rule.unit_scope_type || "unit_exact");
      const useSubtree = scope === "unit_subtree";
      if (scope === "all_units") {
        allUnits = true;
        continue;
      }
      if (useSubtree && rule.unit_id) {
        const [rows] = await connection.query(
          `WITH RECURSIVE scoped_units AS (
             SELECT id FROM units WHERE id = ?
             UNION ALL
             SELECT ur.child_unit_id
               FROM unit_relations ur
               INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id AND rt.code = 'org'
               INNER JOIN scoped_units su ON su.id = ur.parent_unit_id
           )
           SELECT id FROM units WHERE id IN (SELECT id FROM scoped_units) AND is_active = 1`,
          [rule.unit_id]
        );
        rows.forEach((row) => unitIds.add(Number(row.id)));
      } else if (scope === "unit_exact" && rule.unit_id) {
        unitIds.add(Number(rule.unit_id));
      } else if (scope === "unit_type" && rule.unit_type_id) {
        const [rows] = await connection.query(
          "SELECT id FROM units WHERE unit_type_id = ? AND is_active = 1",
          [rule.unit_type_id]
        );
        rows.forEach((row) => unitIds.add(Number(row.id)));
      }
    }
    return {
      has_rules: true,
      supports_context: true,
      all_units: allUnits,
      unit_ids: Array.from(unitIds),
      cargo_ids: Array.from(cargoIds)
    };
  }


  // Cargos AUTORIZABLES en una ubicación: los que tienen un PUESTO activo (`unit_positions`) ahí. NO se exige
  // ocupante vigente — el modelo es late-binding: se autoriza contra el puesto y la persona se enlaza después
  // (al ocuparse el puesto, un trigger reconcilia los task_items abiertos). Con `unitId` = esa unidad;
  // `unitTypeId` = cualquier unidad de ese tipo; sin ambos = las unidades del alcance del proceso.
  async listResolvableCargos(processDefinitionId, { unitId = null, unitTypeId = null } = {}, connection = this.pool) {
    const directUnitId = normalizeNumericId(unitId);
    const directUnitTypeId = normalizeNumericId(unitTypeId);
    let unitIdList = null; // null = sin restricción de unidad (alcance "todas las unidades")
    if (!directUnitTypeId) {
      if (directUnitId) {
        unitIdList = [directUnitId];
      } else {
        const scope = await this.getProcessTargetScope(processDefinitionId, connection);
        if (!scope.has_rules) {
          return [];
        }
        if (!scope.all_units) {
          unitIdList = Array.isArray(scope.unit_ids) ? scope.unit_ids : [];
          if (!unitIdList.length) {
            return [];
          }
        }
      }
    }
    const params = [];
    let unitFilter = "";
    if (directUnitTypeId) {
      // Cargos resolubles en CUALQUIER unidad de ese tipo (para revisores "por tipo de unidad" en proceso).
      unitFilter = "AND u.unit_type_id = ?";
      params.push(directUnitTypeId);
    } else if (Array.isArray(unitIdList)) {
      unitFilter = "AND up.unit_id IN (?)";
      params.push(unitIdList);
    }
    const [rows] = await connection.query(
      `SELECT DISTINCT c.id, c.name, c.code
         FROM unit_positions up
         INNER JOIN units u ON u.id = up.unit_id
         INNER JOIN cargos c ON c.id = up.cargo_id
        WHERE up.is_active = 1 AND c.is_active = 1 ${unitFilter}
        ORDER BY c.name ASC`,
      params
    );
    return rows.map((row) => ({ id: Number(row.id), name: row.name, code: row.code || "" }));
  }


  // Mapa unidad → conjunto de cargo_ids con PUESTO en ella (mismo criterio que listResolvableCargos, sin exigir
  // ocupante). Lo usa la validación de autoría para rechazar un cargo que no tiene puesto en la unidad elegida.
  async getResolvableCargoIdsByUnit(connection, unitIds = []) {
    const list = [...new Set((unitIds || []).map((id) => normalizeNumericId(id)).filter(Boolean))];
    const map = new Map();
    if (!list.length) {
      return map;
    }
    const [rows] = await connection.query(
      `SELECT DISTINCT up.unit_id, up.cargo_id
         FROM unit_positions up
         INNER JOIN cargos c ON c.id = up.cargo_id
        WHERE up.is_active = 1 AND c.is_active = 1 AND up.unit_id IN (?)`,
      [list]
    );
    for (const row of rows) {
      const unit = Number(row.unit_id);
      if (!map.has(unit)) {
        map.set(unit, new Set());
      }
      map.get(unit).add(Number(row.cargo_id));
    }
    return map;
  }


  // F-B (backfill idempotente): reconcilia los task_items ABIERTOS y NO INICIADOS al ocupante vigente de su
  // puesto. El trigger de `position_assignments` reconcilia hacia adelante; esto arregla huérfanos creados con
  // el puesto vacante. No toca cerradas ni YA INICIADAS (no romper la cadena). `positionId` acota.
  //
  // "No iniciada" es `ti.user_started_at IS NULL`. Antes se preguntaba por la ausencia de documento, y eso
  // NUNCA se cumplía: el documento nace en la misma transacción que el entregable, así que este backfill
  // devolvía 0 siempre. `user_started_at` lo sella el `start` de un paso de entrega, que es de verdad el
  // momento en que alguien empieza.
  async reconcileOpenTaskItemAssignments({ positionId = null, performedByUserId = null } = {}, connection = this.pool) {
    const pid = normalizeNumericId(positionId);
    const params = [];
    let posFilter = "";
    if (pid) {
      posFilter = "AND ti.responsible_position_id = ?";
      params.push(pid);
    }
    // CERRAR y ABRIR, en dos sentencias. Antes esto era un solo `WITH ... UPDATE` porque el asiento
    // de auditoria y la reasignacion tenian que ir juntos; con tenencias el asiento ES la
    // reasignacion, asi que la razon desaparecio. Y separarlas es obligatorio: el indice
    // `uq_task_item_tenure_current` no admite dos tenencias abiertas del mismo entregable, y en un
    // CTE que modifica datos el orden en que se aplican los efectos al indice no esta garantizado.
    //
    // `UPDATE ... SET ... FROM`, no `UPDATE ... INNER JOIN ... SET` (eso es MySQL y PostgreSQL lo
    // rechaza al ejecutarlo). No multiplica filas: `uq_position_current` garantiza como mucho una
    // asignacion vigente por puesto.
    await connection.query(
      `UPDATE task_item_tenures t
          SET ended_at = now()
         FROM task_items ti
        INNER JOIN position_assignments pa
           ON pa.position_id = ti.responsible_position_id
          AND pa.is_current = 1
          AND pa.person_id IS NOT NULL
        WHERE ti.id = t.task_item_id
          AND t.ended_at IS NULL
          AND ti.responsible_position_id IS NOT NULL
          AND ti.document_status IN ('Inicial', 'Pendiente de llenado', 'En proceso', 'Observado', 'Listo para firma')
          AND (t.person_id IS NULL OR t.person_id <> pa.person_id)
          ${posFilter}`,
      params
    );

    // ⚠️ EL CONTEO ES POR `affectedRows`, Y ES EL CONTRARIO DE LO QUE ERA. Esta misma linea ya dio
    // un `{reconciled: 0}` silencioso una vez, y al cambiar la sentencia volvio a darlo por el
    // motivo OPUESTO — asi que conviene entender el mecanismo y no copiar la solucion anterior.
    //
    // El adaptador (`config/postgres.js:493`) decide por el PRIMER VERBO del texto: si empieza por
    // INSERT/UPDATE/DELETE devuelve una CABECERA `{affectedRows}`; si empieza por otra cosa
    // —SELECT, y tambien `WITH`— devuelve FILAS.
    //   · Antes esto era un `WITH ... UPDATE ... RETURNING`: empezaba por `WITH`, o sea filas, y
    //     contar por `affectedRows` daba 0 siempre. De ahi el defecto 1.10.
    //   · Ahora es un `INSERT ... SELECT ... RETURNING`: empieza por INSERT, o sea cabecera, y
    //     contar por la longitud del array daba 0 otra vez.
    // El `RETURNING id` se conserva a proposito aunque no se lea: sin el, el adaptador le añade uno
    // suyo dentro de un SAVEPOINT para adivinar el `insertId`.
    //
    // Aqui `performed_by_user_id` SI se rellena —a diferencia de los relevos por trigger— porque
    // este camino lo dispara alguien a proposito.
    const [result] = await connection.query(
      `INSERT INTO task_item_tenures
         (task_item_id, person_id, position_id, opened_by, reason, performed_by_user_id, work_started)
       SELECT ti.id, pa.person_id, ti.responsible_position_id,
              'reconcile', 'Reconciliacion de responsables', ?,
              CASE WHEN ti.user_started_at IS NULL THEN 0 ELSE 1 END
         FROM task_items ti
        INNER JOIN position_assignments pa
           ON pa.position_id = ti.responsible_position_id
          AND pa.is_current = 1
          AND pa.person_id IS NOT NULL
        WHERE ti.responsible_position_id IS NOT NULL
          AND ti.document_status IN ('Inicial', 'Pendiente de llenado', 'En proceso', 'Observado', 'Listo para firma')
          AND NOT EXISTS (
            SELECT 1 FROM task_item_tenures t
             WHERE t.task_item_id = ti.id AND t.ended_at IS NULL
          )
          ${posFilter}
       RETURNING id`,
      [normalizeNumericId(performedByUserId) || null, ...params]
    );
    // El conteo sale del RETURNING y NO de `affectedRows`, y no es un capricho: el adaptador decide
    // si una consulta es de escritura con `/^\s*(insert|update|delete|replace)\b/` sobre el texto
    // (`config/postgres.js`), y esta sentencia **empieza por `WITH`**. Sin el RETURNING, `affectedRows`
    // se queda en 0 aunque reasigne, y este endpoint devolvia `{reconciled: 0}` siempre — que es
    // exactamente el fallo silencioso que el propio backfill vino a arreglar. Lo destapo el control
    // positivo del defecto 1.10.
    return { reconciled: Number(result?.affectedRows || 0) };
  }


  // F-C (handover): traspasa el MISMO entregable a otra persona (NO duplica). Mueve el responsable del task_item
  // y, si ya está iniciado, el dueño del documento; deja asiento de auditoría. Conserva versiones/firmas/historial.
  // No traspasa entregables cerrados (trazabilidad intacta).
  async handoverTaskItem(taskItemId, { toPersonId, reason = null, triggerKind = "manual", performedByUserId = null } = {}, connection = this.pool) {
    const tiId = normalizeNumericId(taskItemId);
    const toId = normalizeNumericId(toPersonId);
    if (!tiId) throw new Error("Entregable (task_item) inválido.");
    if (!toId) throw new Error("Debes indicar la persona destino del traspaso.");
    // ⚠️ ESTE GUARD ESTUVO ROTO, y de las dos maneras seguidas.
    //
    // Primero leia `task_items.status` contra una lista de SIETE literales —'completed',
    // 'completado', 'cancelled'...— que la columna NUNCA tomo: no tenia escritores y se quedaba en
    // 'pendiente' para siempre, asi que el guard **no bloqueaba nada** y un entregable firmado se
    // podia traspasar. Al retirar la columna (2026-08-23) el SELECT paso a fallar en ejecucion
    // —`column "status" does not exist`— y el relevo manual entero devolvia 500. Ninguna prueba lo
    // vio: la caracterizacion no toca este endpoint. Es la regla del SQL que no valida nadie.
    //
    // Ahora se pregunta a quien de verdad avanza: el DOCUMENTO. Su estado vive en el propio
    // entregable desde el 2026-08-23 (`documents` era una cascara 1:1), y arranca en 'Inicial', que
    // `isDocumentPending` considera abierto.
    const [rows] = await connection.query(
      `SELECT ti.id, ti.assigned_person_id, ti.document_status
       FROM task_items ti
       WHERE ti.id = ? LIMIT 1`,
      [tiId]
    );
    if (!rows.length) throw new Error("El entregable no existe.");
    if (!isDocumentPending(rows[0].document_status)) {
      throw new Error("El entregable ya está cerrado; no se puede traspasar.");
    }
    const fromId = rows[0].assigned_person_id ? Number(rows[0].assigned_person_id) : null;
    if (fromId === toId) {
      return { task_item_id: tiId, from_person_id: fromId, to_person_id: toId, unchanged: true };
    }
    const [personRows] = await connection.query("SELECT id FROM persons WHERE id = ? LIMIT 1", [toId]);
    if (!personRows.length) throw new Error("La persona destino no existe.");
    // CERRAR la tenencia vigente y ABRIR la nueva. `task_items.assigned_person_id` NO se escribe
    // aqui: la mantiene el trigger `trg_task_item_tenures_sync`, que es su unico escritor desde el
    // 2026-08-23. Antes este metodo la escribia a mano, y era uno de los cuatro sitios que podian
    // hacerlo — de donde salio que dos copias del responsable se pudrieran.
    await connection.query(
      "UPDATE task_item_tenures SET ended_at = now() WHERE task_item_id = ? AND ended_at IS NULL",
      [tiId]
    );
    // `position_id` se DERIVA, y ese matiz es el que distingue una suplencia de un relevo normal:
    // si la persona destino ocupa hoy el puesto responsable, responde POR EL PUESTO y se guarda;
    // si no, responde solo por el traspaso y queda `NULL`. Es el dato que el asiento viejo no tenia.
    await connection.query(
      `INSERT INTO task_item_tenures
         (task_item_id, person_id, position_id, opened_by, reason, performed_by_user_id, work_started)
       SELECT ti.id, ?,
              (SELECT pa.position_id
                 FROM position_assignments pa
                WHERE pa.position_id = ti.responsible_position_id
                  AND pa.person_id = ?
                  AND pa.is_current = 1
                LIMIT 1),
              'manual', ?, ?,
              CASE WHEN ti.user_started_at IS NULL THEN 0 ELSE 1 END
         FROM task_items ti
        WHERE ti.id = ?`,
      [toId, toId, reason || null, normalizeNumericId(performedByUserId) || null, tiId]
    );
    // El `UPDATE documents SET owner_person_id` que habia aqui se retiro con la columna. Era el
    // UNICO de los cuatro caminos de relevo que la movia — los dos triggers y el backfill no la
    // tocaban—, asi que servia justo para lo contrario de lo que parecia: hacia creer que el dueño
    // del documento seguia al responsable, cuando en tres de cada cuatro relevos no lo hacia.
    // El `INSERT INTO task_item_handovers` que habia aqui se retiro con la tabla: la tenencia que
    // se acaba de abrir ES el asiento. Y la causa sigue siendo SIEMPRE `manual` y no se acepta del
    // cliente — antes se tomaba de `triggerKind`, que viene del cuerpo de la peticion, asi que quien
    // llamaba podia declarar su traspaso como `occupancy_end` y dejar en la bitacora una causa que
    // no ocurrio. En una tabla de AUDITORIA eso es lo unico que no puede pasar (defecto 1.10).
    return { task_item_id: tiId, from_person_id: fromId, to_person_id: toId };
  }


  // El HISTORIAL de relevos de un entregable (defecto 1.10). Responde a «¿por qué esto, que era de
  // Juan, ahora es de María?».
  //
  // Sale de `task_item_tenures`, que guarda PERIODOS, pero se devuelve con la forma de EVENTOS
  // (`from`/`to`) a proposito: es la que el frontend ya pinta, y son isomorfos — el `de quien` es
  // simplemente el ocupante de la tenencia ANTERIOR, o sea un `LAG`.
  //
  // Diferencia visible: ahora aparece tambien la tenencia `original`, la del reparto inicial. El
  // asiento viejo no la tenia porque solo escribia al TRASPASAR, asi que el historial empezaba en
  // el segundo responsable y el primero no constaba en ninguna parte.
  //
  // Empieza por `SELECT` y no por `WITH` a proposito: el adaptador decide si una consulta es de
  // escritura mirando el principio del texto (`config/postgres.js`), y un `WITH` ya costo un
  // `{reconciled: 0}` silencioso.
  //
  // Resuelve los nombres aquí y no en el cliente: son dos LEFT JOIN y evita que la interfaz tenga que
  // pedir una persona por fila. Los LEFT son necesarios, no defensivos: `from_person_id` es NULL en el
  // primer relevo (nadie lo tenía antes) y `to_person_id` es NULL cuando alguien deja el puesto y el
  // entregable se queda huérfano.
  async listTaskItemHandovers(taskItemId, connection = this.pool) {
    const tiId = normalizeNumericId(taskItemId);
    if (!tiId) throw new Error("Entregable (task_item) inválido.");
    const [rows] = await connection.query(
      `SELECT te.id,
              te.task_item_id,
              te.from_person_id,
              te.person_id AS to_person_id,
              te.reason,
              te.opened_by AS trigger_kind,
              te.performed_by_user_id,
              te.started_at AS created_at,
              CONCAT(fp.first_name, ' ', fp.last_name) AS from_person_name,
              CONCAT(tp.first_name, ' ', tp.last_name) AS to_person_name
         FROM (
           SELECT t.id, t.task_item_id, t.person_id, t.reason, t.opened_by,
                  t.performed_by_user_id, t.started_at,
                  LAG(t.person_id) OVER (PARTITION BY t.task_item_id ORDER BY t.started_at, t.id)
                    AS from_person_id
             FROM task_item_tenures t
            WHERE t.task_item_id = ?
         ) te
         LEFT JOIN persons fp ON fp.id = te.from_person_id
         LEFT JOIN persons tp ON tp.id = te.person_id
        ORDER BY te.id DESC`,
      [tiId]
    );
    return rows;
  }

  // F-C (lista de atascados): task_items ABIERTOS que requieren atención — por persona (los que tiene asignados),
  // por puesto, por unidad, o (sin filtros) los huérfanos (sin persona). Marca `started` (tiene documento).
  async listStuckTaskItems({ personId = null, positionId = null, unitId = null } = {}, connection = this.pool) {
    const filters = [];
    const params = [];
    const pid = normalizeNumericId(personId);
    const posId = normalizeNumericId(positionId);
    const uId = normalizeNumericId(unitId);
    if (pid) { filters.push("ti.assigned_person_id = ?"); params.push(pid); }
    if (posId) { filters.push("ti.responsible_position_id = ?"); params.push(posId); }
    if (uId) { filters.push("up.unit_id = ?"); params.push(uId); }
    if (!pid && !posId && !uId) { filters.push("ti.assigned_person_id IS NULL AND ti.responsible_position_id IS NOT NULL"); }
    const [rows] = await connection.query(
      `SELECT ti.id, ti.task_id, ti.assigned_person_id, ti.responsible_position_id,
              up.unit_id, c.name AS cargo_name, u.name AS unit_name,
              EXISTS (SELECT 1 FROM document_versions dv WHERE dv.task_item_id = ti.id) AS started
         FROM task_items ti
         LEFT JOIN unit_positions up ON up.id = ti.responsible_position_id
         LEFT JOIN units u ON u.id = up.unit_id
         LEFT JOIN cargos c ON c.id = up.cargo_id
        WHERE ${filters.join(" AND ")}
        ORDER BY ti.id ASC
        LIMIT 500`,
      params
    );
    return rows.map((r) => ({
      id: Number(r.id),
      task_id: Number(r.task_id),
      assigned_person_id: r.assigned_person_id ? Number(r.assigned_person_id) : null,
      responsible_position_id: r.responsible_position_id ? Number(r.responsible_position_id) : null,
      status: r.status,
      unit_id: r.unit_id ? Number(r.unit_id) : null,
      unit_name: r.unit_name || null,
      cargo_name: r.cargo_name || null,
      started: Number(r.started) > 0
    }));
  }


  // F-C (jefe inmediato): sube por la jerarquía de unidades (relación, org por defecto) y devuelve el ocupante
  // vigente del PUESTO CABEZA más cercano que no sea la propia persona. Sirve para SUGERIR destino del traspaso.
  async resolveImmediateBoss({ positionId = null, unitId = null, relationCode = "org" } = {}, connection = this.pool) {
    let startUnit = normalizeNumericId(unitId);
    let selfPersonId = null;
    const posId = normalizeNumericId(positionId);
    if (posId && !startUnit) {
      const [pr] = await connection.query(
        `SELECT up.unit_id, pa.person_id
           FROM unit_positions up
           LEFT JOIN position_assignments pa ON pa.position_id = up.id AND pa.is_current = 1
          WHERE up.id = ? LIMIT 1`,
        [posId]
      );
      startUnit = pr?.[0]?.unit_id ? Number(pr[0].unit_id) : null;
      selfPersonId = pr?.[0]?.person_id ? Number(pr[0].person_id) : null;
    }
    if (!startUnit) return { boss_person_id: null };
    const [rel] = await connection.query("SELECT id FROM relation_unit_types WHERE code = ? LIMIT 1", [relationCode || "org"]);
    const relId = rel?.[0]?.id ? Number(rel[0].id) : null;
    if (!relId) return { boss_person_id: null };
    const [rows] = await connection.query(
      `WITH RECURSIVE chain AS (
         SELECT ? AS unit_id, 0 AS depth
         UNION ALL
         SELECT ur.parent_unit_id, c.depth + 1
           FROM unit_relations ur INNER JOIN chain c ON c.unit_id = ur.child_unit_id
          WHERE ur.relation_type_id = ?
       )
       SELECT pa.person_id, head.unit_id, c.depth
         FROM chain c
         INNER JOIN unit_positions head ON head.unit_id = c.unit_id AND head.is_unit_head = 1 AND head.is_active = 1
         INNER JOIN position_assignments pa ON pa.position_id = head.id AND pa.is_current = 1 AND pa.person_id IS NOT NULL
        WHERE (? IS NULL OR pa.person_id <> ?)
        ORDER BY c.depth ASC
        LIMIT 1`,
      [startUnit, relId, selfPersonId, selfPersonId]
    );
    const r = rows?.[0];
    return r
      ? { boss_person_id: Number(r.person_id), unit_id: Number(r.unit_id), depth: Number(r.depth) }
      : { boss_person_id: null };
  }


  // F-C (scope por jefe): para el usuario/persona dado, resuelve las unidades que ENCABEZA (is_unit_head con
  // ocupación vigente) + sus descendientes orgánicos, y devuelve los task_items ABIERTOS ATASCADOS ahí: sin
  // persona (huérfanos) o cuyo asignado ya NO ocupa el puesto responsable (titular que se fue). `is_supervisor`
  // indica si encabeza alguna unidad (para mostrar/ocultar el panel aunque no haya atascados).
  // El ALCANCE de un jefe: las unidades que encabeza mas sus descendientes por relacion `org`.
  // Se extrajo el 2026-08-23 porque ahora lo usan DOS cosas: el listado de atascados y el GUARD de
  // las acciones que el jefe puede ejecutar sobre ellos. Escribirlo dos veces era garantizar que
  // acabaran divergiendo — y una divergencia aqui significa que el panel te enseña algo que luego
  // no te deja tocar, o peor, al reves.
  static SCOPE_CTE = `WITH RECURSIVE headed AS (
         SELECT up.unit_id AS unit_id
           FROM unit_positions up
           INNER JOIN position_assignments pa ON pa.position_id = up.id AND pa.is_current = 1 AND pa.person_id = ?
          WHERE up.is_unit_head = 1 AND up.is_active = 1
       ),
       scope AS (
         SELECT unit_id FROM headed
         UNION
         SELECT ur.child_unit_id
           FROM unit_relations ur
           INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id AND rt.code = 'org'
           INNER JOIN scope s ON s.unit_id = ur.parent_unit_id
       )`;

  // ¿Este entregable cae dentro de las unidades que encabeza esta persona? Es el guard de las dos
  // acciones del panel de supervision. Lanza en vez de devolver false: quien llama no tiene nada
  // sensato que hacer con un `no`, y asi el mensaje sale una sola vez y bien escrito.
  async assertSupervisesTaskItem(personId, taskItemId, connection = this.pool) {
    const pid = normalizeNumericId(personId);
    const tiId = normalizeNumericId(taskItemId);
    if (!pid || !tiId) throw new Error("Falta la persona o el entregable.");
    const [rows] = await connection.query(
      `${TaskAssignmentService.SCOPE_CTE}
       SELECT 1
         FROM task_items ti
         INNER JOIN unit_positions up ON up.id = ti.responsible_position_id
        WHERE ti.id = ?
          AND up.unit_id IN (SELECT unit_id FROM scope)
        LIMIT 1`,
      [pid, tiId]
    );
    if (!rows.length) {
      throw new Error("Ese entregable no pertenece a ninguna unidad que encabeces.");
    }
    return true;
  }

  // Quien puede recibir un entregable de una unidad: los ocupantes VIGENTES de sus puestos. Acota
  // la reasignacion a la propia unidad a proposito — un jefe reparte dentro de lo suyo — y evita
  // tener que montar un buscador de personas para algo que es una lista corta y cerrada.
  async listUnitStaff(unitIds = [], connection = this.pool) {
    const ids = unitIds.map(normalizeNumericId).filter(Boolean);
    if (!ids.length) return [];
    // `IN (?, ?, ...)` y no `= ANY(?)`: el adaptador no traduce un array de JavaScript al array de
    // PostgreSQL, y el sintoma es un «malformed array literal» en ejecucion. El idiom del repo son
    // los placeholders construidos.
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await connection.query(
      `SELECT DISTINCT up.unit_id, pa.person_id,
              NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), '') AS person_name,
              c.name AS cargo_name
         FROM unit_positions up
         INNER JOIN position_assignments pa ON pa.position_id = up.id AND pa.is_current = 1
         INNER JOIN persons p ON p.id = pa.person_id
         LEFT JOIN cargos c ON c.id = up.cargo_id
        WHERE up.unit_id IN (${placeholders})
          AND up.is_active = 1
        -- El ORDER BY va por las columnas PROYECTADAS: con SELECT DISTINCT, PostgreSQL exige que
        -- lo que ordena aparezca en la lista. Ordenar por p.first_name con un DISTINCT que no lo
        -- proyecta es un error de ejecucion, no de sintaxis: otra que solo se ve al llamar.
        ORDER BY up.unit_id, person_name`,
      ids
    );
    return rows.map((r) => ({
      unit_id: Number(r.unit_id),
      person_id: Number(r.person_id),
      person_name: r.person_name || `Persona ${r.person_id}`,
      cargo_name: r.cargo_name || null,
    }));
  }

  async listSupervisorStuckTaskItems(personId, connection = this.pool) {
    const pid = normalizeNumericId(personId);
    if (!pid) return { is_supervisor: false, items: [] };
    const [headRows] = await connection.query(
      `SELECT COUNT(*) AS n
         FROM unit_positions up
         INNER JOIN position_assignments pa ON pa.position_id = up.id AND pa.is_current = 1 AND pa.person_id = ?
        WHERE up.is_unit_head = 1 AND up.is_active = 1`,
      [pid]
    );
    if (Number(headRows?.[0]?.n || 0) === 0) {
      return { is_supervisor: false, items: [] };
    }
    const [rows] = await connection.query(
      `${TaskAssignmentService.SCOPE_CTE}
       SELECT ti.id, ti.task_id, ti.assigned_person_id, ti.responsible_position_id,
              -- El OCUPANTE VIGENTE del puesto responsable, que es a quien el jefe devolvera el
              -- entregable de un clic en el caso normal («el titular se fue»). Vacio cuando la
              -- silla esta vacante, y entonces hay que elegir a alguien de la unidad.
              (SELECT pa3.person_id
                 FROM position_assignments pa3
                WHERE pa3.position_id = ti.responsible_position_id AND pa3.is_current = 1
                LIMIT 1) AS occupant_person_id,
              -- El estado del DOCUMENTO, que desde el 2026-08-23 vive en el propio entregable.
              ti.document_status AS status,
              up.unit_id, up.is_active AS position_is_active,
              u.name AS unit_name, c.name AS cargo_name,
              EXISTS (SELECT 1 FROM document_versions dv WHERE dv.task_item_id = ti.id) AS started
         FROM task_items ti
         INNER JOIN unit_positions up ON up.id = ti.responsible_position_id
         INNER JOIN units u ON u.id = up.unit_id
         LEFT JOIN cargos c ON c.id = up.cargo_id
        WHERE up.unit_id IN (SELECT unit_id FROM scope)
          AND (
            ti.assigned_person_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM position_assignments pa2
               WHERE pa2.position_id = ti.responsible_position_id
                 AND pa2.is_current = 1
                 AND pa2.person_id = ti.assigned_person_id
            )
            -- EL PUESTO SE DESACTIVO (D2). Hace falta como termino propio porque desactivar un
            -- puesto NO cierra su ocupacion: la persona sigue figurando como titular vigente de un
            -- puesto que ya no existe, asi que los dos terminos de arriba lo dan por sano. Sin esto,
            -- un entregable EN FASE DE FIRMA anclado a un puesto desactivado no aparecia en ninguna
            -- parte — y es justo el que necesita que lo mire alguien, porque el trigger no lo toca.
            OR up.is_active = 0
          )
        ORDER BY up.unit_id ASC, ti.id ASC
        LIMIT 500`,
      [pid]
    );
    const items = rows.map((r) => ({
      id: Number(r.id),
      task_id: Number(r.task_id),
      assigned_person_id: r.assigned_person_id ? Number(r.assigned_person_id) : null,
      responsible_position_id: r.responsible_position_id ? Number(r.responsible_position_id) : null,
      occupant_person_id: r.occupant_person_id ? Number(r.occupant_person_id) : null,
      status: r.status,
      unit_id: r.unit_id ? Number(r.unit_id) : null,
      unit_name: r.unit_name || null,
      cargo_name: r.cargo_name || null,
      started: Number(r.started) > 0,
      position_is_active: Number(r.position_is_active) === 1,
      // El motivo se ordena de MAS a MENOS especifico. Un puesto desactivado manda sobre los otros
      // dos: describe por que no va a llegar nadie, mientras que «sin responsable» solo dice que
      // ahora mismo no hay quien lo lleve.
      reason: Number(r.position_is_active) === 0
        ? "puesto_desactivado"
        : (r.assigned_person_id ? "titular_se_fue" : "sin_responsable")
    }));

    // La plantilla de las unidades implicadas viaja CON el listado: el panel necesita ofrecer a
    // quien reasignar y esa lista es corta y cerrada. Una consulta mas, no una por fila.
    const staff = await this.listUnitStaff([...new Set(items.map((i) => i.unit_id).filter(Boolean))], connection);

    return { is_supervisor: true, items, staff };
  }
}
