// UserMenuService — proyección del menú de procesos de una persona.
//
// Extraído de `controllers/users/user_controler.js::getUserMenu` (374 L) en la Fase D del plan
// de calidad. Es lectura pura: no escribe nada, no abre transacción.
//
// Cruza TRES cosas:
//   1. los puestos vigentes de la persona (unidad + cargo),
//   2. las reglas de reparto de los procesos activos (`process_target_rules`) — la "regla" del
//      modelo serie → regla → flujo,
//   3. los procesos a los que la persona ya está enganchada por un paso de flujo abierto
//      (llenado o firma) aunque ninguna regla se la asigne — el acceso "operativo".
//
// El resultado va agrupado por unidad, por grupo de unidades y consolidado por cargo. La
// jerarquía se recorre por la relación `org`: el ámbito `unit_subtree` de una regla incluye toda
// la descendencia de la unidad, y por eso hace falta el árbol entero en memoria.

import HttpError from "../../errors/HttpError.js";

// -------------------------------------------------------------------------------------------
// Consultas
// -------------------------------------------------------------------------------------------

/**
 * La relación `org` es el requisito previo de todo lo demás: sin ella no hay jerarquía que
 * recorrer. Se comprueba ANTES de cualquier otra consulta para que el fallo de configuración no
 * se disfrace de "menú vacío".
 */
const assertOrgRelationTypeExists = async (pool) => {
  const [orgRelationRows] = await pool.query(
    "SELECT id FROM relation_unit_types WHERE code = 'org' LIMIT 1"
  );
  if (!orgRelationRows.length) {
    throw new HttpError(
      "No existe relation_unit_types con code='org'. Debe implementarse para construir la jerarquia de unidades.",
      500
    );
  }
};

const getUserPositions = async (pool, userId) => {
  const [positions] = await pool.query(
    `SELECT DISTINCT
       up.id AS position_id,
       up.position_type,
       u.id AS unit_id,
       u.name AS unit_name,
       u.label AS unit_label,
       u.unit_type_id,
       uol.group_unit_id AS group_unit_id,
       gu.name AS group_unit_name,
       gu.label AS group_unit_label,
       c.id AS cargo_id,
       c.name AS cargo_name
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     INNER JOIN units u ON u.id = up.unit_id
     INNER JOIN cargos c ON c.id = up.cargo_id
     LEFT JOIN unit_org_levels uol ON uol.unit_id = u.id
     LEFT JOIN units gu ON gu.id = uol.group_unit_id
     WHERE pa.person_id = ?
       AND pa.is_current = 1
       AND up.is_active = 1
       AND u.is_active = 1
       AND c.is_active = 1
     ORDER BY u.name, c.name`,
    [userId]
  );
  return positions;
};

const getOrgTreeRows = async (pool) => {
  const [orgTreeRows] = await pool.query(
    `SELECT ur.parent_unit_id, ur.child_unit_id
     FROM unit_relations ur
     INNER JOIN relation_unit_types rt
       ON rt.id = ur.relation_type_id
      AND rt.code = 'org'`
  );
  return orgTreeRows;
};

const getProcessTargetRuleRows = async (pool) => {
  const [processRuleRows] = await pool.query(
    `SELECT DISTINCT
       p.id AS process_id,
       p.name AS process_name,
       p.slug AS process_slug,
       pdv.id AS process_definition_id,
       pdv.variation_key,
       pdv.definition_version,
       ptr.id AS rule_id,
       ptr.priority,
       ptr.unit_scope_type,
       ptr.unit_id,
       ptr.unit_type_id,
       ptr.cargo_id,
       ptr.position_id,
       ptr.recipient_policy,
       EXISTS(
         SELECT 1 FROM process_definition_templates pdt
         WHERE pdt.process_definition_id = pdv.id AND pdt.item_mode = 'routed'
       ) AS is_routed
     FROM processes p
     INNER JOIN process_definition_versions pdv
       ON pdv.process_id = p.id
      AND pdv.status = 'active'
      AND pdv.effective_from <= CURDATE()
      AND (pdv.effective_to IS NULL OR pdv.effective_to >= CURDATE())
     INNER JOIN process_target_rules ptr
       ON ptr.process_definition_id = pdv.id
      AND ptr.is_active = 1
      AND (ptr.effective_from IS NULL OR ptr.effective_from <= CURDATE())
      AND (ptr.effective_to IS NULL OR ptr.effective_to >= CURDATE())
     WHERE p.is_active = 1
     ORDER BY p.name, ptr.priority, ptr.id`
  );
  return processRuleRows;
};

/**
 * Procesos a los que la persona llega por un paso de flujo ABIERTO: llenados pendientes
 * (primera rama) y firmas pendientes (segunda). Solo mira la ULTIMA version de cada
 * documento, y de cada paso deduce el origen (puesto / cargo / unidad / tipo de unidad)
 * para poder colgarlo del puesto correcto del menu.
 */
export const getUserOperationalProcessRows = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       operational.process_id,
       operational.process_name,
       operational.process_slug,
       operational.process_definition_id,
       operational.variation_key,
       operational.definition_version,
       operational.source_position_id,
       operational.source_cargo_id,
       operational.source_unit_id,
       operational.source_unit_type_id
     FROM (
       SELECT
         p.id AS process_id,
         p.name AS process_name,
         p.slug AS process_slug,
         pdv.id AS process_definition_id,
         pdv.variation_key,
         pdv.definition_version,
         COALESCE(ffs.position_id, fill_assignee_position.id) AS source_position_id,
         COALESCE(fill_position.cargo_id, ffs.cargo_id, fill_assignee_position.cargo_id, item_position.cargo_id) AS source_cargo_id,
         COALESCE(fill_position.unit_id, ffs.unit_id, fill_assignee_position.unit_id, item_position.unit_id, t.scope_unit_id) AS source_unit_id,
         COALESCE(fill_unit.unit_type_id, ffs.unit_type_id, fill_assignee_unit.unit_type_id, item_unit.unit_type_id, task_unit.unit_type_id) AS source_unit_type_id
       FROM fill_requests fr
       INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
       INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
       INNER JOIN document_versions dv ON dv.id = dff.document_version_id
       INNER JOIN (
         SELECT task_item_id, MAX(version) AS max_version
         FROM document_versions
         GROUP BY task_item_id
       ) latest_fill_dv
         ON latest_fill_dv.task_item_id = dv.task_item_id
        AND latest_fill_dv.max_version = dv.version
       INNER JOIN task_items ti ON ti.id = dv.task_item_id
       INNER JOIN tasks t ON t.id = ti.task_id
       INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       INNER JOIN processes p ON p.id = pdv.process_id
       LEFT JOIN (
         SELECT person_id, MIN(position_id) AS position_id, COUNT(*) AS total_positions
         FROM position_assignments
         WHERE is_current = 1
         GROUP BY person_id
       ) fill_assignee_ctx
         ON fill_assignee_ctx.person_id = fr.assigned_person_id
       LEFT JOIN unit_positions fill_position ON fill_position.id = ffs.position_id
       LEFT JOIN unit_positions fill_assignee_position
         ON fill_assignee_position.id = fill_assignee_ctx.position_id
        AND fill_assignee_ctx.total_positions = 1
       LEFT JOIN units fill_unit ON fill_unit.id = COALESCE(fill_position.unit_id, ffs.unit_id)
       LEFT JOIN units fill_assignee_unit ON fill_assignee_unit.id = fill_assignee_position.unit_id
       LEFT JOIN unit_positions item_position ON item_position.id = ti.responsible_position_id
       LEFT JOIN units item_unit ON item_unit.id = item_position.unit_id
        LEFT JOIN units task_unit ON task_unit.id = t.scope_unit_id
       WHERE fr.assigned_person_id = ?
         AND pdv.status = 'active'
         AND pdv.effective_from <= CURDATE()
         AND (pdv.effective_to IS NULL OR pdv.effective_to >= CURDATE())
         AND p.is_active = 1
         AND LOWER(COALESCE(dv.status, '')) IN (
           'pendiente de llenado',
           'en llenado',
           'en revisión de llenado',
           'observado',
           'listo para firma',
           'pendiente de firma',
           'firmado parcial'
         )

       UNION ALL

       SELECT
         p.id AS process_id,
         p.name AS process_name,
         p.slug AS process_slug,
         pdv.id AS process_definition_id,
         pdv.variation_key,
         pdv.definition_version,
         COALESCE(sfs.position_id, signature_assignee_position.id) AS source_position_id,
         COALESCE(signature_position.cargo_id, sfs.required_cargo_id, signature_assignee_position.cargo_id, item_position.cargo_id) AS source_cargo_id,
         COALESCE(signature_position.unit_id, sfs.unit_id, signature_assignee_position.unit_id, item_position.unit_id, t.scope_unit_id) AS source_unit_id,
         COALESCE(signature_unit.unit_type_id, sfs.unit_type_id, signature_assignee_unit.unit_type_id, item_unit.unit_type_id, task_unit.unit_type_id) AS source_unit_type_id
       FROM signature_requests sr
       INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
       INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
       INNER JOIN (
         SELECT task_item_id, MAX(version) AS max_version
         FROM document_versions
         GROUP BY task_item_id
       ) latest_signature_dv
         ON latest_signature_dv.task_item_id = dv.task_item_id
        AND latest_signature_dv.max_version = dv.version
       INNER JOIN task_items ti ON ti.id = dv.task_item_id
       INNER JOIN tasks t ON t.id = ti.task_id
       INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       INNER JOIN processes p ON p.id = pdv.process_id
       LEFT JOIN signature_request_statuses srs ON srs.id = sr.status_id
       LEFT JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
       LEFT JOIN (
         SELECT person_id, MIN(position_id) AS position_id, COUNT(*) AS total_positions
         FROM position_assignments
         WHERE is_current = 1
         GROUP BY person_id
       ) signature_assignee_ctx
         ON signature_assignee_ctx.person_id = sr.assigned_person_id
       LEFT JOIN unit_positions signature_position ON signature_position.id = sfs.position_id
       LEFT JOIN unit_positions signature_assignee_position
         ON signature_assignee_position.id = signature_assignee_ctx.position_id
        AND signature_assignee_ctx.total_positions = 1
       LEFT JOIN units signature_unit ON signature_unit.id = COALESCE(signature_position.unit_id, sfs.unit_id)
       LEFT JOIN units signature_assignee_unit ON signature_assignee_unit.id = signature_assignee_position.unit_id
       LEFT JOIN unit_positions item_position ON item_position.id = ti.responsible_position_id
       LEFT JOIN units item_unit ON item_unit.id = item_position.unit_id
        LEFT JOIN units task_unit ON task_unit.id = t.scope_unit_id
       WHERE sr.assigned_person_id = ?
         AND pdv.status = 'active'
         AND pdv.effective_from <= CURDATE()
         AND (pdv.effective_to IS NULL OR pdv.effective_to >= CURDATE())
         AND p.is_active = 1
         AND LOWER(COALESCE(dv.status, '')) IN (
           'listo para firma',
           'pendiente de firma',
           'firmado parcial'
         )
     ) operational
     ORDER BY operational.process_name ASC, operational.process_definition_id ASC`,
    [userId, userId]
  );
  return rows;
};

// -------------------------------------------------------------------------------------------
// Índices en memoria
// -------------------------------------------------------------------------------------------

/**
 * Siembra los índices del menú a partir de los puestos: unidades, grupos de unidades, cargos por
 * unidad y cargos consolidados. Cada cargo nace con `processes: []`; las dos pasadas de abajo son
 * las que los rellenan.
 *
 * Una unidad sin grupo (`unit_org_levels` vacío) se agrupa consigo misma — de ahí los
 * `?? row.unit_*`: el menú siempre tiene un nivel de grupo, aunque sea degenerado.
 */
const seedMenuIndexes = (positions) => {
  const unitsMap = new Map();
  const cargoMapByUnit = new Map();
  const consolidatedMap = new Map();
  const groupMap = new Map();

  const ensureUnitCargoMap = (unitId) => {
    if (!cargoMapByUnit.has(unitId)) {
      cargoMapByUnit.set(unitId, new Map());
    }
    return cargoMapByUnit.get(unitId);
  };

  positions.forEach((row) => {
    const groupUnitId = row.group_unit_id ?? row.unit_id;
    const groupUnitName = row.group_unit_name ?? row.unit_name;
    const groupUnitLabel = row.group_unit_label ?? row.unit_label ?? row.unit_name;

    if (!groupMap.has(groupUnitId)) {
      groupMap.set(groupUnitId, {
        id: groupUnitId,
        name: groupUnitName,
        label: groupUnitLabel,
        units: []
      });
    }

    if (!unitsMap.has(row.unit_id)) {
      unitsMap.set(row.unit_id, {
        id: row.unit_id,
        name: row.unit_name,
        label: row.unit_label ?? row.unit_name,
        group_id: groupUnitId
      });
    }

    const unitCargoMap = ensureUnitCargoMap(row.unit_id);
    if (!unitCargoMap.has(row.cargo_id)) {
      unitCargoMap.set(row.cargo_id, {
        id: row.cargo_id,
        name: row.cargo_name,
        position_type: row.position_type ?? null,
        processes: []
      });
    }

    if (!consolidatedMap.has(row.cargo_id)) {
      consolidatedMap.set(row.cargo_id, {
        id: row.cargo_id,
        name: row.cargo_name,
        position_type: row.position_type ?? null,
        processes: []
      });
    }
  });

  return { unitsMap, cargoMapByUnit, consolidatedMap, groupMap };
};

/**
 * Resolutor memoizado del subárbol organizativo: `getUnitSubtree(unitId)` devuelve el conjunto
 * formado por la unidad y toda su descendencia por la relación `org`. El recorrido es iterativo
 * y lleva `visited`, así que un ciclo en `unit_relations` no lo cuelga.
 */
const createUnitSubtreeResolver = (orgTreeRows) => {
  const childrenByUnit = new Map();
  orgTreeRows.forEach((row) => {
    if (!childrenByUnit.has(row.parent_unit_id)) {
      childrenByUnit.set(row.parent_unit_id, []);
    }
    childrenByUnit.get(row.parent_unit_id).push(row.child_unit_id);
  });

  const subtreeCache = new Map();
  return (unitId) => {
    if (!unitId) {
      return new Set();
    }
    if (subtreeCache.has(unitId)) {
      return subtreeCache.get(unitId);
    }
    const visited = new Set([unitId]);
    const stack = [unitId];
    while (stack.length) {
      const current = stack.pop();
      const children = childrenByUnit.get(current) || [];
      children.forEach((childId) => {
        if (!visited.has(childId)) {
          visited.add(childId);
          stack.push(childId);
        }
      });
    }
    subtreeCache.set(unitId, visited);
    return visited;
  };
};

// -------------------------------------------------------------------------------------------
// Emparejamiento puesto ↔ origen del acceso
// -------------------------------------------------------------------------------------------

/**
 * ¿Esta regla reparte el proceso a este puesto?
 * El puesto exacto manda sobre todo lo demás; `exact_position` sin `position_id` no casa con
 * nadie a propósito (es una regla mal configurada, no un comodín).
 */
const positionMatchesRule = (position, rule, getUnitSubtree) => {
  if (rule.position_id) {
    return Number(position.position_id) === Number(rule.position_id);
  }
  if (rule.recipient_policy === "exact_position") {
    return false;
  }
  if (rule.cargo_id && Number(position.cargo_id) !== Number(rule.cargo_id)) {
    return false;
  }
  switch (rule.unit_scope_type) {
    case "all_units":
      return true;
    case "unit_type":
      return rule.unit_type_id && Number(position.unit_type_id) === Number(rule.unit_type_id);
    case "unit_subtree":
      return rule.unit_id && getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
    case "unit_exact":
    default:
      if (!rule.unit_id) {
        return false;
      }
      return Number(position.unit_id) === Number(rule.unit_id);
  }
};

/**
 * ¿El paso de flujo abierto que trae esta fila cuelga de este puesto? Se resuelve de lo más
 * específico a lo más laxo (puesto → cargo → unidad → tipo de unidad); sin ninguna pista de
 * origen, solo cuenta si al menos hay cargo.
 */
const operationalRowMatchesPosition = (position, row) => {
  const sourcePositionId = Number(row?.source_position_id || 0);
  const sourceCargoId = Number(row?.source_cargo_id || 0);
  const sourceUnitId = Number(row?.source_unit_id || 0);
  const sourceUnitTypeId = Number(row?.source_unit_type_id || 0);

  if (sourcePositionId) {
    return Number(position.position_id) === sourcePositionId;
  }

  if (sourceCargoId && Number(position.cargo_id) !== sourceCargoId) {
    return false;
  }

  if (sourceUnitId) {
    return Number(position.unit_id) === sourceUnitId;
  }

  if (sourceUnitTypeId) {
    return Number(position.unit_type_id) === sourceUnitTypeId;
  }

  return Boolean(sourceCargoId);
};

// -------------------------------------------------------------------------------------------
// Relleno de procesos por cargo
// -------------------------------------------------------------------------------------------

/**
 * Añade un proceso al cargo deduplicando por configuración. Si ya estaba y el que llega viene por
 * REGLA (`access_source === "process"`), el de regla pisa al operativo: la regla es la fuente
 * durable del acceso y el flujo solo un enganche circunstancial. Nunca al revés.
 */
const addProcess = (cargo, process, seenSet) => {
  const uniqueKey = Number(process.process_definition_id || process.id);
  const existingIndex = cargo.processes.findIndex(
    (item) => Number(item.process_definition_id || item.id) === uniqueKey
  );

  if (existingIndex >= 0) {
    const existing = cargo.processes[existingIndex];
    if (existing.access_source !== "process" && process.access_source === "process") {
      cargo.processes[existingIndex] = {
        ...existing,
        ...process,
      };
    }
    seenSet.add(uniqueKey);
    return;
  }

  cargo.processes.push(process);
  seenSet.add(uniqueKey);
};

/** Deja el proceso en el cargo de la unidad y en el cargo consolidado, si existen. */
const addProcessToPosition = (position, process, { cargoMapByUnit, consolidatedMap }, seen) => {
  const unitCargoMap = cargoMapByUnit.get(position.unit_id);
  if (unitCargoMap?.has(position.cargo_id)) {
    const cargo = unitCargoMap.get(position.cargo_id);
    if (!seen.byUnitCargo.has(seen.unitCargoKey)) {
      seen.byUnitCargo.set(seen.unitCargoKey, new Set());
    }
    addProcess(cargo, process, seen.byUnitCargo.get(seen.unitCargoKey));
  }

  if (consolidatedMap.has(position.cargo_id)) {
    if (!seen.byCargo.has(seen.cargoKey)) {
      seen.byCargo.set(seen.cargoKey, new Set());
    }
    addProcess(consolidatedMap.get(position.cargo_id), process, seen.byCargo.get(seen.cargoKey));
  }
};

/** Pasada 1: los procesos que le tocan a la persona porque una regla se los reparte. */
const attachRuleProcesses = ({ positions, processRuleRows, indexes, getUnitSubtree, seenByUnitCargo, seenByCargo }) => {
  positions.forEach((position) => {
    const matchingRules = processRuleRows.filter((rule) => positionMatchesRule(position, rule, getUnitSubtree));
    matchingRules.forEach((row) => {
      const process = {
        id: row.process_id,
        name: row.process_name,
        slug: row.process_slug,
        unit_id: position.unit_id,
        process_definition_id: row.process_definition_id,
        variation_key: row.variation_key,
        definition_version: row.definition_version,
        is_routed: !!row.is_routed,
        access_source: "process"
      };

      addProcessToPosition(position, process, indexes, {
        byUnitCargo: seenByUnitCargo,
        byCargo: seenByCargo,
        unitCargoKey: `${position.unit_id}:${position.cargo_id}`,
        cargoKey: position.cargo_id,
      });
    });
  });
};

/**
 * Pasada 2: los procesos a los que la persona llega por un paso de flujo abierto, aunque ninguna
 * regla se los reparta. Las claves de "visto" llevan sufijo `:operational` — no colisionan con
 * las de la pasada de reglas, y esa separación es del código original.
 */
const attachOperationalProcesses = ({ positions, operationalProcessRows, indexes, seenByUnitCargo, seenByCargo }) => {
  positions.forEach((position) => {
    operationalProcessRows.forEach((row) => {
      if (!operationalRowMatchesPosition(position, row)) {
        return;
      }

      const process = {
        id: row.process_id,
        name: row.process_name,
        slug: row.process_slug,
        unit_id: Number(row.source_unit_id || position.unit_id),
        process_definition_id: row.process_definition_id,
        variation_key: row.variation_key,
        definition_version: row.definition_version,
        access_source: "flow"
      };

      addProcessToPosition(position, process, indexes, {
        byUnitCargo: seenByUnitCargo,
        byCargo: seenByCargo,
        unitCargoKey: `${position.unit_id}:${position.cargo_id}:operational`,
        cargoKey: `${position.cargo_id}:operational`,
      });
    });
  });
};

// -------------------------------------------------------------------------------------------
// Proyección de salida
// -------------------------------------------------------------------------------------------

const sortCargos = (cargos) => {
  cargos.forEach((cargo) => {
    cargo.processes.sort((a, b) => a.name.localeCompare(b.name));
  });
  cargos.sort((a, b) => a.name.localeCompare(b.name));
  return cargos;
};

const projectMenu = ({ unitsMap, cargoMapByUnit, groupMap, consolidatedMap }) => {
  const units = Array.from(unitsMap.values())
    .map((unit) => {
      const cargoMap = cargoMapByUnit.get(unit.id);
      const cargos = cargoMap ? Array.from(cargoMap.values()) : [];
      return {
        ...unit,
        cargos: sortCargos(cargos)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  units.forEach((unit) => {
    const group = groupMap.get(unit.group_id);
    if (group) {
      group.units.push(unit);
    }
  });

  const unitGroups = Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      units: group.units.sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const consolidated = sortCargos(Array.from(consolidatedMap.values()));

  return { units, unitGroups, consolidated };
};

// -------------------------------------------------------------------------------------------
// Entrada pública
// -------------------------------------------------------------------------------------------

/**
 * Menú del usuario ya montado. Sin puestos vigentes devuelve la forma corta (sin `unit_groups`),
 * que es lo que respondía el controller: no la "completes", el frontend distingue los dos casos.
 *
 * Lanza `HttpError(500)` si falta la relación `org`.
 */
export const buildUserMenu = async (pool, userId) => {
  await assertOrgRelationTypeExists(pool);

  const positions = await getUserPositions(pool, userId);
  if (!positions.length) {
    return { user_id: userId, units: [], consolidated: [] };
  }

  const indexes = seedMenuIndexes(positions);

  const orgTreeRows = await getOrgTreeRows(pool);
  const processRuleRows = await getProcessTargetRuleRows(pool);
  const operationalProcessRows = await getUserOperationalProcessRows(pool, userId);

  const getUnitSubtree = createUnitSubtreeResolver(orgTreeRows);
  const seenByUnitCargo = new Map();
  const seenByCargo = new Map();

  attachRuleProcesses({
    positions,
    processRuleRows,
    indexes,
    getUnitSubtree,
    seenByUnitCargo,
    seenByCargo,
  });
  attachOperationalProcesses({
    positions,
    operationalProcessRows,
    indexes,
    seenByUnitCargo,
    seenByCargo,
  });

  const { units, unitGroups, consolidated } = projectMenu(indexes);

  return { user_id: userId, units, unit_groups: unitGroups, consolidated };
};
