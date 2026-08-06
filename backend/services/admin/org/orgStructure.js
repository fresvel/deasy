// OrgStructureService — unidades, puestos y grafo de unidades. Extraido de SqlAdminService.js
// (God #1) por Extract Class (cut #2 del plan de refactor backend). El cluster era autocontenido:
// solo usa this.pool + una lectura generica del motor (getByKeys), inyectada. SqlAdminService
// mantiene delegadores finos con la misma firma, asi el controller y los grafts de create()/update()
// (que llaman this.wouldCreateUnitCycle / this.assertUnitHeadAllowed) no se tocan.
import { isUniqueViolation, isForeignKeyViolation } from "../../../errors/sqlErrors.js";
import { conflict } from "../../../errors/HttpError.js";
import { slugify } from "../kernel/primitives.js";

export default class OrgStructureService {
  constructor(pool, { getByKeys } = {}) {
    this.pool = pool;
    this._getByKeys = getByKeys;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
    }
  }


  // F-C: la cabeza de unidad debe ser un puesto OCUPABLE (real/promoción); un simbólico no resolvería a una
  // persona. Se valida en la capa de app (no en trigger, para no acoplar el schema a una columna nueva).
  assertUnitHeadAllowed(isHead, positionType) {
    if (Number(isHead) === 1 && !["real", "promocion"].includes(String(positionType))) {
      throw new Error("La cabeza de la unidad debe ser un puesto real o de promoción.");
    }
  }


  // Devuelve el grafo de unidades (nodos + aristas + catálogo de tipos) para la vista de organigrama.
  // relationTypeCode filtra las aristas por tipo (p. ej. 'org'); 'all' devuelve todas.
  async getUnitGraph(relationTypeCode = "org") {
    this.ensurePool();
    const [nodes] = await this.pool.query(
      `SELECT u.id, u.name, u.label, u.slug, u.unit_type_id, ut.name AS unit_type_name, u.is_active,
              (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_active = 1) AS positions_count,
              (SELECT COUNT(*) FROM unit_positions p
                 INNER JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
                WHERE p.unit_id = u.id AND p.is_active = 1) AS occupied_count,
              (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_unit_head = 1 AND p.is_active = 1) AS head_count
       FROM units u
       LEFT JOIN unit_types ut ON ut.id = u.unit_type_id
       ORDER BY u.id ASC`
    );
    const [relationTypes] = await this.pool.query(
      "SELECT id, code, name FROM relation_unit_types ORDER BY id ASC"
    );
    let edgeSql =
      `SELECT ur.id, ur.parent_unit_id, ur.child_unit_id, ur.relation_type_id, rt.code AS relation_type_code
       FROM unit_relations ur
       INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id`;
    const params = [];
    const code = String(relationTypeCode || "").trim();
    if (code && code !== "all") {
      edgeSql += " WHERE rt.code = ?";
      params.push(code);
    }
    edgeSql += " ORDER BY ur.id ASC";
    const [edges] = await this.pool.query(edgeSql, params);
    return { nodes, edges, relationTypes };
  }


  // Detecta si crear la arista parent->child (en un tipo de relación) cerraría un ciclo: ocurre si el padre
  // ya es descendiente del hijo dentro de ese mismo tipo. CTE recursiva acotada al relation_type.
  async wouldCreateUnitCycle(parentUnitId, childUnitId, relationTypeId, connection = this.pool) {
    if (Number(parentUnitId) === Number(childUnitId)) {
      return true;
    }
    const [rows] = await connection.query(
      `WITH RECURSIVE descendants AS (
         SELECT child_unit_id FROM unit_relations
          WHERE parent_unit_id = ? AND relation_type_id = ?
         UNION ALL
         SELECT ur.child_unit_id FROM unit_relations ur
         INNER JOIN descendants d ON ur.parent_unit_id = d.child_unit_id
          WHERE ur.relation_type_id = ?
       )
       SELECT 1 FROM descendants WHERE child_unit_id = ? LIMIT 1`,
      [childUnitId, relationTypeId, relationTypeId, parentUnitId]
    );
    return rows.length > 0;
  }


  // Detalle de una unidad para el panel del organigrama: sus puestos (cargo, slot, jefatura, activo) y el
  // ocupante actual de cada uno (position_assignments → persons).
  async getUnitDetail(unitId) {
    this.ensurePool();
    const id = Number(unitId);
    if (!id) {
      throw new Error("Unidad inválida.");
    }
    const unit = await this._getByKeys("units", { id });
    if (!unit) {
      throw new Error("La unidad no existe.");
    }
    const [positions] = await this.pool.query(
      `SELECT p.id, p.slot_no, p.title, p.is_unit_head, p.is_active, p.position_type, p.cargo_id, p.profile,
              c.name AS cargo_name, c.code AS cargo_code,
              pa.id AS assignment_id, pa.start_date,
              pers.id AS person_id, pers.cedula,
              CONCAT(COALESCE(pers.first_name, ''), ' ', COALESCE(pers.last_name, '')) AS person_name
       FROM unit_positions p
       LEFT JOIN cargos c ON c.id = p.cargo_id
       LEFT JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
       LEFT JOIN persons pers ON pers.id = pa.person_id
       WHERE p.unit_id = ?
       ORDER BY p.is_unit_head DESC, c.name ASC, p.slot_no ASC`,
      [id]
    );
    return {
      unit: { id: unit.id, name: unit.name, label: unit.label },
      positions
    };
  }


  // Procesos que aplican a una unidad: reglas de alcance (process_target_rules) que la referencian
  // directamente (unit_exact/unit_subtree por unit_id), por su tipo de unidad, o de alcance global (all_units).
  async getUnitProcesses(unitId) {
    this.ensurePool();
    const id = Number(unitId);
    if (!id) {
      throw new Error("Unidad inválida.");
    }
    const unit = await this._getByKeys("units", { id });
    if (!unit) {
      throw new Error("La unidad no existe.");
    }
    const [rows] = await this.pool.query(
      `SELECT
              ptr.id AS rule_id,
              pdv.id AS definition_id,
              p.name AS process_name,
              pdv.name AS definition_name,
              pdv.definition_version,
              pdv.variation_key,
              pdv.status,
              ptr.unit_scope_type,
              ptr.recipient_policy,
              ptr.priority,
              ptr.is_active AS rule_active,
              ptr.unit_id,
              ptr.unit_type_id,
              ptr.cargo_id,
              ptr.position_id,
              c.name AS cargo_name,
              up.title AS position_title,
              upc.name AS position_cargo_name,
              CASE
                WHEN ptr.unit_id = ? THEN 'direct'
                WHEN ptr.unit_type_id IS NOT NULL AND ptr.unit_type_id = ? THEN 'type'
                WHEN ptr.unit_scope_type = 'all_units' THEN 'global'
                ELSE 'other'
              END AS origin
       FROM process_target_rules ptr
       INNER JOIN process_definition_versions pdv ON pdv.id = ptr.process_definition_id
       INNER JOIN processes p ON p.id = pdv.process_id
       LEFT JOIN cargos c ON c.id = ptr.cargo_id
       LEFT JOIN unit_positions up ON up.id = ptr.position_id
       LEFT JOIN cargos upc ON upc.id = up.cargo_id
       WHERE ptr.unit_id = ?
          OR (ptr.unit_type_id IS NOT NULL AND ptr.unit_type_id = ?)
          OR ptr.unit_scope_type = 'all_units'
       ORDER BY (ptr.unit_id = ?) DESC,
                FIELD(pdv.status, 'active', 'draft', 'retired'),
                p.name ASC, pdv.definition_version DESC`,
      [id, unit.unit_type_id, id, unit.unit_type_id, id]
    );
    return {
      unit: { id: unit.id, name: unit.name },
      processes: rows
    };
  }


  // Configuraciones de proceso a las que se puede vincular esta unidad vía regla de alcance.
  // Dos restricciones del modelo:
  // 1) Las reglas de alcance solo se editan mientras la configuración está en 'draft' (activar congela el
  //    diseño; cambiar alcance ⇒ nueva versión). Por eso solo se ofrecen configuraciones en draft.
  // 2) Solo variaciones por cargo o default: las variaciones por tipo de unidad fijan el alcance a 'unit_type'
  //    (unit_id NULL) y aplican a todas las unidades del tipo, así que no se acotan por unidad.
  async getUnitAttachableProcesses(unitId) {
    this.ensurePool();
    const id = Number(unitId);
    if (!id) {
      throw new Error("Unidad inválida.");
    }
    const [rows] = await this.pool.query(
      `SELECT pdv.id AS definition_id,
              p.name AS process_name,
              pdv.name AS definition_name,
              pdv.definition_version,
              pdv.variation_key,
              pds.source_type AS series_source_type,
              pds.cargo_id AS series_cargo_id,
              c.name AS series_cargo_name
         FROM process_definition_versions pdv
         INNER JOIN processes p ON p.id = pdv.process_id
         INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
         LEFT JOIN cargos c ON c.id = pds.cargo_id
        WHERE pdv.status = 'draft'
          AND pds.source_type <> 'unit_type'
        ORDER BY p.name ASC, pdv.definition_version DESC`
    );
    return { definitions: rows };
  }


  // --- Gestión de puestos y ocupaciones desde el organigrama ---
  // Crea un puesto (unit_position) en una unidad. slot_no se autoincrementa por (unidad, cargo).
  // Normaliza el perfil del puesto a un JSON con las keys soportadas (formacion/experiencia/capacitacion/
  // investigacion). Acepta objeto o string JSON; devuelve un string JSON o null si queda vacío.
  normalizePositionProfile(profile) {
    if (profile === undefined || profile === null || profile === "") return null;
    let obj = profile;
    if (typeof profile === "string") {
      try {
        obj = JSON.parse(profile);
      } catch {
        throw new Error("El perfil debe ser un JSON válido.");
      }
    }
    if (typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("El perfil debe ser un objeto con secciones (formación, experiencia, etc.).");
    }
    const KEYS = ["formacion", "experiencia", "capacitacion", "investigacion"];
    const out = {};
    for (const key of KEYS) {
      const value = obj[key];
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) out[key] = text;
    }
    return Object.keys(out).length ? JSON.stringify(out) : null;
  }


  async addUnitPosition(unitId, data = {}) {
    this.ensurePool();
    const uId = Number(unitId);
    const cargoId = Number(data.cargo_id);
    if (!uId || !cargoId) {
      throw new Error("La unidad y el cargo son obligatorios.");
    }
    const positionType = ["real", "promocion", "simbolico"].includes(data.position_type) ? data.position_type : "real";
    const isHead = data.is_unit_head ? 1 : 0;
    this.assertUnitHeadAllowed(isHead, positionType);
    const profileJson = this.normalizePositionProfile(data.profile);
    const [slotRows] = await this.pool.query(
      "SELECT COALESCE(MAX(slot_no), 0) + 1 AS next_slot FROM unit_positions WHERE unit_id = ? AND cargo_id = ?",
      [uId, cargoId]
    );
    const nextSlot = Number(slotRows?.[0]?.next_slot || 1);
    try {
      const [r] = await this.pool.query(
        `INSERT INTO unit_positions (unit_id, cargo_id, slot_no, title, profile, position_type, is_unit_head, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [uId, cargoId, nextSlot, String(data.title || "").trim() || null, profileJson, positionType, isHead]
      );
      return { id: Number(r.insertId) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("La unidad ya tiene una jefatura asignada (solo se permite una).");
      }
      throw error;
    }
  }


  async updateUnitPosition(positionId, data = {}) {
    this.ensurePool();
    const pid = Number(positionId);
    const existing = await this._getByKeys("unit_positions", { id: pid });
    if (!existing) {
      throw new Error("El puesto no existe.");
    }
    const effType = data.position_type !== undefined ? data.position_type : existing.position_type;
    const effHead = data.is_unit_head !== undefined ? (data.is_unit_head ? 1 : 0) : existing.is_unit_head;
    this.assertUnitHeadAllowed(effHead, effType);
    const fields = [];
    const params = [];
    if (data.title !== undefined) { fields.push("title = ?"); params.push(String(data.title || "").trim() || null); }
    if (data.cargo_id !== undefined) { fields.push("cargo_id = ?"); params.push(Number(data.cargo_id)); }
    if (data.position_type !== undefined) { fields.push("position_type = ?"); params.push(effType); }
    if (data.is_unit_head !== undefined) { fields.push("is_unit_head = ?"); params.push(effHead); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); params.push(data.is_active ? 1 : 0); }
    if (data.profile !== undefined) { fields.push("profile = ?"); params.push(this.normalizePositionProfile(data.profile)); }
    if (!fields.length) {
      return { id: pid };
    }
    params.push(pid);
    try {
      await this.pool.query(`UPDATE unit_positions SET ${fields.join(", ")} WHERE id = ?`, params);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("La unidad ya tiene una jefatura asignada (solo se permite una).");
      }
      throw error;
    }
    return { id: pid };
  }


  // Elimina un puesto y sus ocupaciones (transacción). Antes limpia los role_assignments derivados de esas
  // ocupaciones (FK derived_from_assignment_id) y sus relation_types. Si el puesto está referenciado por
  // vacantes/contratos/reglas, se rechaza con mensaje claro (mejor desactivarlo).
  async removeUnitPosition(positionId) {
    this.ensurePool();
    const pid = Number(positionId);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `DELETE rart FROM role_assignment_relation_types rart
           INNER JOIN role_assignments ra ON ra.id = rart.role_assignment_id
          WHERE ra.derived_from_assignment_id IN (SELECT id FROM position_assignments WHERE position_id = ?)`,
        [pid]
      );
      await connection.query(
        `DELETE FROM role_assignments
          WHERE derived_from_assignment_id IN (SELECT id FROM position_assignments WHERE position_id = ?)`,
        [pid]
      );
      await connection.query("DELETE FROM position_assignments WHERE position_id = ?", [pid]);
      await connection.query("DELETE FROM unit_positions WHERE id = ?", [pid]);
      await connection.commit();
      return { id: pid };
    } catch (error) {
      await connection.rollback();
      if (isForeignKeyViolation(error)) {
        throw conflict("No se puede eliminar: el puesto está referenciado (vacantes, contratos o reglas). Desactívalo en su lugar.");
      }
      throw error;
    } finally {
      connection.release();
    }
  }


  // Asigna (o cambia) el ocupante de un puesto: cierra la ocupación vigente y crea la nueva (atómico).
  async assignUnitPosition(positionId, personId) {
    this.ensurePool();
    const pid = Number(positionId);
    const perId = Number(personId);
    if (!pid || !perId) {
      throw new Error("El puesto y la persona son obligatorios.");
    }
    const position = await this._getByKeys("unit_positions", { id: pid });
    if (!position) {
      throw new Error("El puesto no existe.");
    }
    const person = await this._getByKeys("persons", { id: perId });
    if (!person) {
      throw new Error("La persona no existe.");
    }
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE position_assignments SET is_current = 0, end_date = CURDATE() WHERE position_id = ? AND is_current = 1",
        [pid]
      );
      await connection.query(
        "INSERT INTO position_assignments (position_id, person_id, start_date, is_current) VALUES (?, ?, CURDATE(), 1)",
        [pid, perId]
      );
      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }


  // Quita el ocupante vigente de un puesto (cierra la ocupación).
  async unassignUnitPosition(positionId) {
    this.ensurePool();
    const pid = Number(positionId);
    await this.pool.query(
      "UPDATE position_assignments SET is_current = 0, end_date = CURDATE() WHERE position_id = ? AND is_current = 1",
      [pid]
    );
    return { ok: true };
  }


  // Crea una unidad y, opcionalmente, su relación con un padre en un solo paso atómico (para "+ Hijo/Hermano"
  // desde el organigrama). La nueva unidad es una hoja nueva: no puede formar ciclo ni duplicar padre.
  async createUnitWithParent({ name, label, slug, unit_type_id, parent_unit_id, relation_type_id } = {}) {
    this.ensurePool();
    const nm = String(name || "").trim();
    if (!nm) {
      throw new Error("Ingresa el nombre de la unidad.");
    }
    const unitTypeId = Number(unit_type_id);
    if (!unitTypeId) {
      throw new Error("Selecciona el tipo de unidad.");
    }
    const finalSlug = (String(slug || "").trim() || slugify(nm)).slice(0, 180);
    if (!finalSlug) {
      throw new Error("No se pudo derivar un slug para la unidad.");
    }
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [unitResult] = await connection.query(
        "INSERT INTO units (name, label, slug, unit_type_id, is_active) VALUES (?, ?, ?, ?, 1)",
        [nm.slice(0, 180), (String(label || "").trim() || nm).slice(0, 180), finalSlug, unitTypeId]
      );
      const newUnitId = Number(unitResult.insertId);
      let relationId = null;
      const parentId = Number(parent_unit_id);
      const relTypeId = Number(relation_type_id);
      if (parentId && relTypeId) {
        const [relResult] = await connection.query(
          "INSERT INTO unit_relations (relation_type_id, parent_unit_id, child_unit_id) VALUES (?, ?, ?)",
          [relTypeId, parentId, newUnitId]
        );
        relationId = Number(relResult.insertId);
      }
      await connection.commit();
      return { unit_id: newUnitId, relation_id: relationId };
    } catch (error) {
      await connection.rollback();
      if (isUniqueViolation(error)) {
        throw conflict("Ya existe una unidad con ese slug. Cambia el nombre o el slug.");
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}
