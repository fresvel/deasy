import { closeMariaDBPool, getMariaDBPool } from "../config/mariadb.js";

const roles = [
  { name: "Admin", description: "Acceso completo sobre administracion, usuarios, roles y procesos." },
  { name: "Gestor", description: "Crea, gestiona y elimina procesos operativos." },
  { name: "Auditor", description: "Solo lectura sobre datos y procesos." },
  { name: "Usuario", description: "Acceso a funcionalidades generales de usuario." }
];

const resources = [
  { code: "account", name: "Cuenta", description: "Datos de cuenta y sesion." },
  { code: "dossier", name: "Dossier", description: "Perfil profesional y evidencias." },
  { code: "documents", name: "Documentos", description: "Centro documental del usuario." },
  { code: "processes", name: "Procesos", description: "Procesos, tareas y definiciones." },
  { code: "roles", name: "Roles", description: "Roles, permisos y asignaciones." },
  { code: "users", name: "Usuarios", description: "Administracion de usuarios." }
];

const actions = [
  { code: "read", name: "Leer", description: "Consultar registros." },
  { code: "create", name: "Crear", description: "Crear registros." },
  { code: "update", name: "Actualizar", description: "Modificar registros." },
  { code: "delete", name: "Eliminar", description: "Eliminar registros." },
  { code: "manage", name: "Administrar", description: "Administracion completa del modulo." }
];

const rolePermissionMatrix = {
  Admin: {
    account: ["read", "create", "update", "delete", "manage"],
    dossier: ["read", "create", "update", "delete", "manage"],
    documents: ["read", "create", "update", "delete", "manage"],
    processes: ["read", "create", "update", "delete", "manage"],
    roles: ["read", "create", "update", "delete", "manage"],
    users: ["read", "create", "update", "delete", "manage"]
  },
  Gestor: {
    account: ["read", "update"],
    dossier: ["read", "update"],
    documents: ["read", "create", "update"],
    processes: ["read", "create", "update", "delete"],
    roles: ["read"],
    users: ["read"]
  },
  Auditor: {
    account: ["read"],
    dossier: ["read"],
    documents: ["read"],
    processes: ["read"],
    roles: ["read"],
    users: ["read"]
  },
  Usuario: {
    account: ["read", "update"],
    dossier: ["read", "create", "update"],
    documents: ["read", "create", "update"],
    processes: ["read"]
  }
};

const cargoRoleMap = {
  coordinador: ["Gestor"],
  director: ["Gestor"],
  prorrector: ["Gestor"],
  jefe: ["Gestor"],
  responsable: ["Gestor"],
  docente: ["Usuario"]
};

const splitEnvList = (key, fallback = []) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
};

const adminEmails = splitEnvList("DEASY_RBAC_ADMIN_EMAILS", [
  "director.demo@pucese.edu.ec"
]);

const auditorEmails = splitEnvList("DEASY_RBAC_AUDITOR_EMAILS", [
  "asistente.docencia.demo@pucese.edu.ec"
]);

const fetchOne = async (connection, sql, params = []) => {
  const [rows] = await connection.query(sql, params);
  return rows?.[0] ?? null;
};

const upsertRole = async (connection, role) => {
  await connection.query(
    `INSERT INTO roles (name, description, is_active)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
       description = VALUES(description),
       is_active = 1`,
    [role.name, role.description]
  );
  const row = await fetchOne(connection, "SELECT id FROM roles WHERE name = ? LIMIT 1", [role.name]);
  return Number(row.id);
};

const upsertResource = async (connection, resource) => {
  await connection.query(
    `INSERT INTO resources (code, name, description, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       description = VALUES(description),
       is_active = 1`,
    [resource.code, resource.name, resource.description]
  );
  const row = await fetchOne(connection, "SELECT id FROM resources WHERE code = ? LIMIT 1", [resource.code]);
  return Number(row.id);
};

const upsertAction = async (connection, action) => {
  await connection.query(
    `INSERT INTO actions (code, name, description, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       description = VALUES(description),
       is_active = 1`,
    [action.code, action.name, action.description]
  );
  const row = await fetchOne(connection, "SELECT id FROM actions WHERE code = ? LIMIT 1", [action.code]);
  return Number(row.id);
};

const upsertPermission = async (connection, { resourceId, actionId, code, description }) => {
  await connection.query(
    `INSERT INTO permissions (resource_id, action_id, code, description, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       code = VALUES(code),
       description = VALUES(description),
       is_active = 1`,
    [resourceId, actionId, code, description]
  );
  const row = await fetchOne(connection, "SELECT id FROM permissions WHERE code = ? LIMIT 1", [code]);
  return Number(row.id);
};

const seedPermissions = async (connection, roleIds) => {
  const resourceIds = new Map();
  const actionIds = new Map();
  const permissionIds = new Map();

  for (const resource of resources) {
    resourceIds.set(resource.code, await upsertResource(connection, resource));
  }
  for (const action of actions) {
    actionIds.set(action.code, await upsertAction(connection, action));
  }

  for (const resource of resources) {
    for (const action of actions) {
      const permissionId = await upsertPermission(connection, {
        resourceId: resourceIds.get(resource.code),
        actionId: actionIds.get(action.code),
        code: `${resource.code}.${action.code}`,
        description: `${action.name} ${resource.name}`.trim()
      });
      permissionIds.set(`${resource.code}.${action.code}`, permissionId);
    }
  }

  for (const [roleName, resourceMatrix] of Object.entries(rolePermissionMatrix)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    for (const [resourceCode, actionCodes] of Object.entries(resourceMatrix)) {
      for (const actionCode of actionCodes) {
        const permissionId = permissionIds.get(`${resourceCode}.${actionCode}`);
        if (!permissionId) continue;
        await connection.query(
          "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          [roleId, permissionId]
        );
      }
    }
  }
};

const seedCargoRoleMap = async (connection, roleIds) => {
  const [cargoRows] = await connection.query("SELECT id, code FROM cargos WHERE is_active = 1");
  let inserted = 0;
  for (const cargo of cargoRows) {
    const roleNames = cargoRoleMap[String(cargo.code || "").toLowerCase()] || [];
    for (const roleName of roleNames) {
      const roleId = roleIds.get(roleName);
      if (!roleId) continue;
      const [result] = await connection.query(
        "INSERT IGNORE INTO cargo_role_map (role_id, cargo_id) VALUES (?, ?)",
        [roleId, cargo.id]
      );
      inserted += Number(result.affectedRows || 0);
    }
  }
  return inserted;
};

const backfillDerivedRoleAssignments = async (connection) => {
  const [result] = await connection.query(
    `INSERT IGNORE INTO role_assignments (
       role_id,
       unit_id,
       derived_from_assignment_id,
       source,
       person_id,
       max_depth,
       start_date,
       end_date,
       is_current,
       assigned_at
     )
     SELECT
       crm.role_id,
       up.unit_id,
       pa.id,
       'derived',
       pa.person_id,
       0,
       pa.start_date,
       pa.end_date,
       pa.is_current,
       NOW()
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     INNER JOIN cargo_role_map crm ON crm.cargo_id = up.cargo_id
     WHERE pa.is_current = 1`
  );
  return Number(result.affectedRows || 0);
};

const resolveDefaultUnitId = async (connection) => {
  const row = await fetchOne(
    connection,
    `SELECT id
     FROM units
     WHERE is_active = 1
     ORDER BY CASE WHEN slug IN ('SEES', 'PREC') THEN 0 ELSE 1 END, id
     LIMIT 1`
  );
  if (!row) throw new Error("No existe una unidad activa para asignar roles manuales.");
  return Number(row.id);
};

const resolvePersonUnitId = async (connection, personId, fallbackUnitId) => {
  const row = await fetchOne(
    connection,
    `SELECT up.unit_id
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     WHERE pa.person_id = ?
       AND pa.is_current = 1
       AND up.is_active = 1
     ORDER BY pa.id
     LIMIT 1`,
    [personId]
  );
  return Number(row?.unit_id || fallbackUnitId);
};

const assignManualRoleByEmail = async (connection, { email, roleName, roleIds, fallbackUnitId }) => {
  const person = await fetchOne(
    connection,
    "SELECT id, email FROM persons WHERE email = ? AND is_active = 1 LIMIT 1",
    [email]
  );
  if (!person) {
    console.warn(`No se encontro usuario activo para asignar ${roleName}: ${email}`);
    return 0;
  }
  const roleId = roleIds.get(roleName);
  if (!roleId) return 0;
  const unitId = await resolvePersonUnitId(connection, person.id, fallbackUnitId);
  const [result] = await connection.query(
    `INSERT IGNORE INTO role_assignments (
       role_id,
       unit_id,
       source,
       person_id,
       max_depth,
       start_date,
       is_current,
       assigned_at
     )
     VALUES (?, ?, 'manual', ?, 0, CURDATE(), 1, NOW())`,
    [roleId, unitId, person.id]
  );
  return Number(result.affectedRows || 0);
};

const applyPatch = async () => {
  const pool = getMariaDBPool();
  if (!pool) {
    throw new Error("MariaDB no esta configurada. Revisa variables MARIADB_*.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const roleIds = new Map();
    for (const role of roles) {
      roleIds.set(role.name, await upsertRole(connection, role));
    }

    await seedPermissions(connection, roleIds);
    const cargoMappings = await seedCargoRoleMap(connection, roleIds);
    const derivedAssignments = await backfillDerivedRoleAssignments(connection);
    const fallbackUnitId = await resolveDefaultUnitId(connection);

    let manualAssignments = 0;
    for (const email of adminEmails) {
      manualAssignments += await assignManualRoleByEmail(connection, {
        email,
        roleName: "Admin",
        roleIds,
        fallbackUnitId
      });
    }
    for (const email of auditorEmails) {
      manualAssignments += await assignManualRoleByEmail(connection, {
        email,
        roleName: "Auditor",
        roleIds,
        fallbackUnitId
      });
    }

    await connection.commit();
    console.log("Patch RBAC aplicado correctamente.");
    console.log(`Roles: ${roleIds.size}`);
    console.log(`Mapeos cargo-rol nuevos: ${cargoMappings}`);
    console.log(`Asignaciones derivadas nuevas: ${derivedAssignments}`);
    console.log(`Asignaciones manuales nuevas: ${manualAssignments}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await closeMariaDBPool();
  }
};

applyPatch().catch(async (error) => {
  console.error("No se pudo aplicar el patch RBAC:", error.message);
  await closeMariaDBPool();
  process.exitCode = 1;
});
