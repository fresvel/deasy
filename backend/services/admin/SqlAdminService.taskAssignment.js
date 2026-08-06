// TaskAssignmentService — asignacion/reconciliacion de task items, handover, task items atascados y
// resolucion del jefe inmediato; ademas mapas de referencia (cargo/unit-type) y resolucion de scope y
// cargos resolubles de una configuracion. Extraido de SqlAdminService.js (God #1) por Extract Class
// (cut #6). Cluster AUTOCONTENIDO: solo this.pool + normalizeNumericId (import); cero colaboradores
// inyectados. SqlAdminService mantiene delegadores; el controller, saveTemplateArtifactDraft y el
// WorkflowSyncService (que llaman getCargoCodeMap/getProcessTargetScope/... via this.) no se tocan.
import { normalizeNumericId } from "./SqlAdminService.primitives.js";

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


  // F-B (backfill idempotente): reconcilia los task_items ABIERTOS y NO INICIADOS (sin documento) al ocupante
  // vigente de su puesto. El trigger de `position_assignments` reconcilia hacia adelante; esto arregla huérfanos
  // creados con el puesto vacante. No toca cerradas ni YA INICIADAS (no romper la cadena). `positionId` acota.
  async reconcileOpenTaskItemAssignments({ positionId = null } = {}, connection = this.pool) {
    const pid = normalizeNumericId(positionId);
    const params = [];
    let posFilter = "";
    if (pid) {
      posFilter = "AND ti.responsible_position_id = ?";
      params.push(pid);
    }
    const [result] = await connection.query(
      `UPDATE task_items ti
         INNER JOIN position_assignments pa
            ON pa.position_id = ti.responsible_position_id
           AND pa.is_current = 1
           AND pa.person_id IS NOT NULL
          SET ti.assigned_person_id = pa.person_id
        WHERE ti.responsible_position_id IS NOT NULL
          AND ti.status NOT IN ('completed','completado','cancelled','cancelado','finalizado','entregado','rechazado')
          AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.task_item_id = ti.id)
          AND (ti.assigned_person_id IS NULL OR ti.assigned_person_id <> pa.person_id)
          ${posFilter}`,
      params
    );
    return { reconciled: result?.affectedRows ?? 0 };
  }


  // F-C (handover): traspasa el MISMO entregable a otra persona (NO duplica). Mueve el responsable del task_item
  // y, si ya está iniciado, el dueño del documento; deja asiento de auditoría. Conserva versiones/firmas/historial.
  // No traspasa entregables cerrados (trazabilidad intacta).
  async handoverTaskItem(taskItemId, { toPersonId, reason = null, triggerKind = "manual", performedByUserId = null } = {}, connection = this.pool) {
    const tiId = normalizeNumericId(taskItemId);
    const toId = normalizeNumericId(toPersonId);
    if (!tiId) throw new Error("Entregable (task_item) inválido.");
    if (!toId) throw new Error("Debes indicar la persona destino del traspaso.");
    const [rows] = await connection.query(
      "SELECT id, assigned_person_id, status FROM task_items WHERE id = ? LIMIT 1",
      [tiId]
    );
    if (!rows.length) throw new Error("El entregable no existe.");
    const TERMINAL = ["completed", "completado", "cancelled", "cancelado", "finalizado", "entregado", "rechazado"];
    if (TERMINAL.includes(String(rows[0].status))) {
      throw new Error("El entregable ya está cerrado; no se puede traspasar.");
    }
    const fromId = rows[0].assigned_person_id ? Number(rows[0].assigned_person_id) : null;
    if (fromId === toId) {
      return { task_item_id: tiId, from_person_id: fromId, to_person_id: toId, unchanged: true };
    }
    const [personRows] = await connection.query("SELECT id FROM persons WHERE id = ? LIMIT 1", [toId]);
    if (!personRows.length) throw new Error("La persona destino no existe.");
    await connection.query("UPDATE task_items SET assigned_person_id = ? WHERE id = ?", [toId, tiId]);
    // Si ya está iniciado (tiene documento), su dueño también se mueve al nuevo responsable.
    await connection.query("UPDATE documents SET owner_person_id = ? WHERE task_item_id = ?", [toId, tiId]);
    const kind = ["occupancy_end", "position_deactivated", "manual"].includes(triggerKind) ? triggerKind : "manual";
    await connection.query(
      `INSERT INTO task_item_handovers (task_item_id, from_person_id, to_person_id, reason, trigger_kind, performed_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tiId, fromId, toId, reason || null, kind, normalizeNumericId(performedByUserId) || null]
    );
    return { task_item_id: tiId, from_person_id: fromId, to_person_id: toId };
  }


  // F-C (lista de atascados): task_items ABIERTOS que requieren atención — por persona (los que tiene asignados),
  // por puesto, por unidad, o (sin filtros) los huérfanos (sin persona). Marca `started` (tiene documento).
  async listStuckTaskItems({ personId = null, positionId = null, unitId = null } = {}, connection = this.pool) {
    const filters = ["ti.status NOT IN ('completed','completado','cancelled','cancelado','finalizado','entregado','rechazado')"];
    const params = [];
    const pid = normalizeNumericId(personId);
    const posId = normalizeNumericId(positionId);
    const uId = normalizeNumericId(unitId);
    if (pid) { filters.push("ti.assigned_person_id = ?"); params.push(pid); }
    if (posId) { filters.push("ti.responsible_position_id = ?"); params.push(posId); }
    if (uId) { filters.push("up.unit_id = ?"); params.push(uId); }
    if (!pid && !posId && !uId) { filters.push("ti.assigned_person_id IS NULL AND ti.responsible_position_id IS NOT NULL"); }
    const [rows] = await connection.query(
      `SELECT ti.id, ti.task_id, ti.assigned_person_id, ti.responsible_position_id, ti.status,
              up.unit_id, c.name AS cargo_name, u.name AS unit_name,
              EXISTS (SELECT 1 FROM documents d WHERE d.task_item_id = ti.id) AS started
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
      `WITH RECURSIVE headed AS (
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
       )
       SELECT ti.id, ti.task_id, ti.assigned_person_id, ti.responsible_position_id, ti.status,
              up.unit_id, u.name AS unit_name, c.name AS cargo_name,
              EXISTS (SELECT 1 FROM documents d WHERE d.task_item_id = ti.id) AS started
         FROM task_items ti
         INNER JOIN unit_positions up ON up.id = ti.responsible_position_id
         INNER JOIN units u ON u.id = up.unit_id
         LEFT JOIN cargos c ON c.id = up.cargo_id
        WHERE up.unit_id IN (SELECT unit_id FROM scope)
          AND ti.status NOT IN ('completed','completado','cancelled','cancelado','finalizado','entregado','rechazado')
          AND (
            ti.assigned_person_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM position_assignments pa2
               WHERE pa2.position_id = ti.responsible_position_id
                 AND pa2.is_current = 1
                 AND pa2.person_id = ti.assigned_person_id
            )
          )
        ORDER BY up.unit_id ASC, ti.id ASC
        LIMIT 500`,
      [pid]
    );
    return {
      is_supervisor: true,
      items: rows.map((r) => ({
        id: Number(r.id),
        task_id: Number(r.task_id),
        assigned_person_id: r.assigned_person_id ? Number(r.assigned_person_id) : null,
        responsible_position_id: r.responsible_position_id ? Number(r.responsible_position_id) : null,
        status: r.status,
        unit_id: r.unit_id ? Number(r.unit_id) : null,
        unit_name: r.unit_name || null,
        cargo_name: r.cargo_name || null,
        started: Number(r.started) > 0,
        reason: r.assigned_person_id ? "titular_se_fue" : "sin_responsable"
      }))
    };
  }
}
