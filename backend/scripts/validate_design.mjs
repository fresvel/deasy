import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const envPath = path.join(repoRoot, "backend", ".env");

const loadEnv = async () => {
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn(`⚠️  No se pudo leer ${envPath}: ${error.message}`);
  }
};

const makePool = () => {
  const {
    MARIADB_HOST,
    MARIADB_PORT,
    MARIADB_USER,
    MARIADB_PASSWORD,
    MARIADB_DATABASE
  } = process.env;

  if (!MARIADB_HOST || !MARIADB_PORT || !MARIADB_USER || !MARIADB_DATABASE) {
    throw new Error("Configuración MariaDB incompleta. Revisa backend/.env o variables de entorno.");
  }

  return mysql.createPool({
    host: MARIADB_HOST,
    port: Number(MARIADB_PORT),
    user: MARIADB_USER,
    password: MARIADB_PASSWORD,
    database: MARIADB_DATABASE,
    connectionLimit: 5,
    timezone: "Z"
  });
};

const today = () => new Date().toISOString().slice(0, 10);

const authorize = async (connection, { personId, permissionCode, unitScopeId, requiredCargoId = null }) => {
  const [[person]] = await connection.query(
    "SELECT id, is_active FROM persons WHERE id = ? LIMIT 1",
    [personId]
  );
  if (!person || Number(person.is_active) !== 1) {
    return { allowed: false, reason: "person_inactive" };
  }

  const [[unit]] = await connection.query(
    "SELECT id, is_active FROM units WHERE id = ? LIMIT 1",
    [unitScopeId]
  );
  if (!unit || Number(unit.is_active) !== 1) {
    return { allowed: false, reason: "unit_inactive" };
  }

  let rbacAllowed = false;

  const [assignments] = await connection.query(
    `SELECT id, role_id, unit_id, max_depth
     FROM role_assignments
     WHERE person_id = ?
       AND is_current = 1
       AND start_date <= CURDATE()
       AND (end_date IS NULL OR end_date >= CURDATE())`,
    [personId]
  );

  const [relations] = await connection.query(
    "SELECT parent_unit_id, child_unit_id, relation_type_id FROM unit_relations"
  );

  const adjacency = new Map();
  relations.forEach((row) => {
    const key = Number(row.parent_unit_id);
    if (!adjacency.has(key)) {
      adjacency.set(key, []);
    }
    adjacency.get(key).push({
      childId: Number(row.child_unit_id),
      relationTypeId: Number(row.relation_type_id)
    });
  });

  const isCovered = async (assignment) => {
    if (Number(assignment.unit_id) === Number(unitScopeId)) {
      return true;
    }
    if (!assignment.max_depth || Number(assignment.max_depth) <= 0) {
      return false;
    }
    const [allowedRows] = await connection.query(
      "SELECT relation_type_id FROM role_assignment_relation_types WHERE role_assignment_id = ?",
      [assignment.id]
    );
    const allowed = new Set(allowedRows.map((row) => Number(row.relation_type_id)));
    if (!allowed.size) {
      return false;
    }
    const maxDepth = Number(assignment.max_depth);
    const queue = [{ id: Number(assignment.unit_id), depth: 0 }];
    const visited = new Set([Number(assignment.unit_id)]);
    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) {
        continue;
      }
      const edges = adjacency.get(current.id) || [];
      for (const edge of edges) {
        if (!allowed.has(edge.relationTypeId)) {
          continue;
        }
        if (visited.has(edge.childId)) {
          continue;
        }
        if (edge.childId === Number(unitScopeId)) {
          return true;
        }
        visited.add(edge.childId);
        queue.push({ id: edge.childId, depth: current.depth + 1 });
      }
    }
    return false;
  };

  for (const assignment of assignments) {
    const covered = await isCovered(assignment);
    if (!covered) {
      continue;
    }
    const [permRows] = await connection.query(
      `SELECT rp.role_id
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ? AND p.code = ?
       LIMIT 1`,
      [assignment.role_id, permissionCode]
    );
    if (permRows.length) {
      rbacAllowed = true;
      break;
    }
  }

  let abacAllowed = false;
  if (requiredCargoId) {
    const [rows] = await connection.query(
      `SELECT pa.id
       FROM position_assignments pa
       JOIN unit_positions up ON up.id = pa.position_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND pa.end_date IS NULL
         AND up.unit_id = ?
         AND up.cargo_id = ?
         AND up.is_active = 1
       LIMIT 1`,
      [personId, unitScopeId, requiredCargoId]
    );
    if (rows.length) {
      abacAllowed = true;
    }
  }

  return { allowed: rbacAllowed || abacAllowed, reason: rbacAllowed ? "rbac" : abacAllowed ? "abac" : "denied" };
};

const run = async () => {
  await loadEnv();
  const pool = makePool();
  const connection = await pool.getConnection();

  const results = [];
  const record = (name, passed, detail = "") => {
    results.push({ name, passed, detail });
    const mark = passed ? "✅" : "❌";
    console.log(`${mark} ${name}${detail ? ` - ${detail}` : ""}`);
  };

  try {
    await connection.beginTransaction();

    const suffix = Date.now().toString();
    const [utRes] = await connection.query(
      "INSERT INTO unit_types (name, is_active) VALUES (?, 1)",
      [`TipoTest-${suffix}`]
    );
    const unitTypeId = utRes.insertId;
    const [unitRes] = await connection.query(
      "INSERT INTO units (name, slug, unit_type_id, is_active) VALUES (?, ?, ?, 1)",
      [`UnidadTest-${suffix}`, `unidad-test-${suffix}`, unitTypeId]
    );
    const unitId = unitRes.insertId;
    const [unitChildRes] = await connection.query(
      "INSERT INTO units (name, slug, unit_type_id, is_active) VALUES (?, ?, ?, 1)",
      [`UnidadChild-${suffix}`, `unidad-child-${suffix}`, unitTypeId]
    );
    const unitChildId = unitChildRes.insertId;
    const [unitGrandRes] = await connection.query(
      "INSERT INTO units (name, slug, unit_type_id, is_active) VALUES (?, ?, ?, 1)",
      [`UnidadGrand-${suffix}`, `unidad-grand-${suffix}`, unitTypeId]
    );
    const unitGrandId = unitGrandRes.insertId;

    const [relTypeRes] = await connection.query(
      "INSERT INTO relation_unit_types (code, name, is_inheritance_allowed, is_active) VALUES (?, ?, 1, 1)",
      [`parent-${suffix}`, `Parent-${suffix}`]
    );
    const relationTypeId = relTypeRes.insertId;

    await connection.query(
      "INSERT INTO unit_relations (relation_type_id, parent_unit_id, child_unit_id) VALUES (?, ?, ?)",
      [relationTypeId, unitId, unitChildId]
    );
    await connection.query(
      "INSERT INTO unit_relations (relation_type_id, parent_unit_id, child_unit_id) VALUES (?, ?, ?)",
      [relationTypeId, unitChildId, unitGrandId]
    );

    const [cargoRes] = await connection.query(
      "INSERT INTO cargos (name, is_active) VALUES (?, 1)",
      [`CargoTest-${suffix}`]
    );
    const cargoId = cargoRes.insertId;

    const [personARes] = await connection.query(
      "INSERT INTO persons (cedula, first_name, last_name, email, password_hash, status, is_active) VALUES (?, ?, ?, ?, ?, 'Activo', 1)",
      [`0900${suffix}`, "Ana", "Test", `ana-${suffix}@test.local`, "hash"]
    );
    const personAId = personARes.insertId;
    const [personBRes] = await connection.query(
      "INSERT INTO persons (cedula, first_name, last_name, email, password_hash, status, is_active) VALUES (?, ?, ?, ?, ?, 'Activo', 1)",
      [`0901${suffix}`, "Beto", "Test", `beto-${suffix}@test.local`, "hash"]
    );
    const personBId = personBRes.insertId;

    const [positionRes] = await connection.query(
      "INSERT INTO unit_positions (unit_id, cargo_id, slot_no, is_active) VALUES (?, ?, 1, 1)",
      [unitChildId, cargoId]
    );
    const positionId = positionRes.insertId;

    const [assignmentRes] = await connection.query(
      "INSERT INTO position_assignments (position_id, person_id, start_date, is_current) VALUES (?, ?, ?, 1)",
      [positionId, personAId, today()]
    );
    const assignmentId = assignmentRes.insertId;

    let uniqueAssignmentOk = false;
    try {
      await connection.query(
        "INSERT INTO position_assignments (position_id, person_id, start_date, is_current) VALUES (?, ?, ?, 1)",
        [positionId, personBId, today()]
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        uniqueAssignmentOk = true;
      } else {
        throw error;
      }
    }
    record("A) Unicidad de ocupacion por puesto", uniqueAssignmentOk);

    let uniqueVacancyOk = false;
    await connection.query(
      `INSERT INTO vacancies
       (position_id, title, dedication, relation_type, status)
       VALUES (?, ?, ?, ?, 'abierta')`,
      [positionId, `Vacante-${suffix}`, "TC", "dependencia"]
    );
    try {
      await connection.query(
        `INSERT INTO vacancies
         (position_id, title, dedication, relation_type, status)
         VALUES (?, ?, ?, ?, 'abierta')`,
        [positionId, `Vacante2-${suffix}`, "TC", "dependencia"]
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        uniqueVacancyOk = true;
      } else {
        throw error;
      }
    }
    record("B) Unicidad de vacante abierta por puesto", uniqueVacancyOk);

    const [roleRes] = await connection.query(
      "INSERT INTO roles (name, is_active) VALUES (?, 1)",
      [`RoleTest-${suffix}`]
    );
    const roleId = roleRes.insertId;
    await connection.query(
      "INSERT INTO cargo_role_map (cargo_id, role_id) VALUES (?, ?)",
      [cargoId, roleId]
    );

    const [derivedRows] = await connection.query(
      `SELECT id FROM role_assignments
       WHERE source = 'derived' AND derived_from_assignment_id = ?`,
      [assignmentId]
    );
    record(
      "C) Sincronizacion automatica de roles derivados",
      derivedRows.length > 0,
      derivedRows.length ? "" : "No se encontraron roles derivados (requiere servicio de sync)."
    );

    const [resourceRes] = await connection.query(
      "INSERT INTO resources (code, name, is_active) VALUES (?, ?, 1)",
      [`res-test-${suffix}`, `Recurso ${suffix}`]
    );
    const resourceId = resourceRes.insertId;
    const [actionRes] = await connection.query(
      "INSERT INTO actions (code, name, is_active) VALUES (?, ?, 1)",
      [`act-test-${suffix}`, `Accion ${suffix}`]
    );
    const actionId = actionRes.insertId;
    const [permRes] = await connection.query(
      "INSERT INTO permissions (resource_id, action_id, code, is_active) VALUES (?, ?, ?, 1)",
      [resourceId, actionId, `perm.test.${suffix}`]
    );
    const permissionId = permRes.insertId;
    await connection.query(
      "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
      [roleId, permissionId]
    );
    const [assignmentRoleRes] = await connection.query(
      `INSERT INTO role_assignments
       (person_id, role_id, unit_id, source, max_depth, start_date, is_current)
       VALUES (?, ?, ?, 'manual', 1, ?, 1)`,
      [personAId, roleId, unitId, today()]
    );
    const roleAssignmentId = assignmentRoleRes.insertId;
    await connection.query(
      "INSERT INTO role_assignment_relation_types (role_assignment_id, relation_type_id) VALUES (?, ?)",
      [roleAssignmentId, relationTypeId]
    );

    const allowChild = await authorize(connection, {
      personId: personAId,
      permissionCode: `perm.test.${suffix}`,
      unitScopeId: unitChildId
    });
    const denyGrand = await authorize(connection, {
      personId: personAId,
      permissionCode: `perm.test.${suffix}`,
      unitScopeId: unitGrandId
    });
    record("D) Herencia por asignacion (depth=1)", allowChild.allowed && !denyGrand.allowed);

    await connection.query("UPDATE units SET is_active = 0 WHERE id = ?", [unitChildId]);
    const blockedUnit = await authorize(connection, {
      personId: personAId,
      permissionCode: `perm.test.${suffix}`,
      unitScopeId: unitChildId
    });
    await connection.query("UPDATE persons SET is_active = 0 WHERE id = ?", [personAId]);
    const blockedPerson = await authorize(connection, {
      personId: personAId,
      permissionCode: `perm.test.${suffix}`,
      unitScopeId: unitId
    });
    record("E) Bloqueo por inactivacion", !blockedUnit.allowed && !blockedPerson.allowed);

    await connection.rollback();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length) {
    process.exit(1);
  }
};

run().catch((error) => {
  const message = error?.message || "Error desconocido";
  console.error("❌ Error en validacion:", message);
  if (!error?.message) {
    console.error(error);
  }
  process.exit(1);
});
