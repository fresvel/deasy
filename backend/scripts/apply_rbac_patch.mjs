import { closeMariaDBPool, getMariaDBPool } from "../config/mariadb.js";
import bcrypt from "bcrypt";
import {
  ACTION_CATALOG,
  ADMIN_ROLE_NAME,
  CARGO_ROLE_MAP,
  LEGACY_ROLE_RENAMES,
  RESOURCE_CATALOG,
  ROLE_CATALOG,
  ROLE_PERMISSION_MATRIX
} from "../config/rbacCatalog.js";

const demoAdmin = {
  cedula: process.env.DEASY_RBAC_DEMO_ADMIN_CEDULA || "9000000001",
  email: process.env.DEASY_RBAC_DEMO_ADMIN_EMAIL || "admin.demo@pucese.edu.ec",
  firstName: process.env.DEASY_RBAC_DEMO_ADMIN_FIRST_NAME || "Administrador",
  lastName: process.env.DEASY_RBAC_DEMO_ADMIN_LAST_NAME || "Demo",
  whatsapp: process.env.DEASY_RBAC_DEMO_ADMIN_WHATSAPP || "0990000001",
  token: process.env.DEASY_RBAC_DEMO_ADMIN_TOKEN || "ADEMO0101A",
  password: process.env.DEASY_DEMO_PASSWORD || "Deasy1234!"
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
  demoAdmin.email
]);

const auditorEmails = splitEnvList("DEASY_RBAC_AUDITOR_EMAILS", [
  "asistente.docencia.demo@pucese.edu.ec"
]);

const legacyAdminEmails = splitEnvList("DEASY_RBAC_LEGACY_ADMIN_EMAILS", [
  "director.demo@pucese.edu.ec"
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

  for (const resource of RESOURCE_CATALOG) {
    resourceIds.set(resource.code, await upsertResource(connection, resource));
  }
  for (const action of ACTION_CATALOG) {
    actionIds.set(action.code, await upsertAction(connection, action));
  }

  for (const resource of RESOURCE_CATALOG) {
    for (const action of ACTION_CATALOG) {
      const permissionId = await upsertPermission(connection, {
        resourceId: resourceIds.get(resource.code),
        actionId: actionIds.get(action.code),
        code: `${resource.code}.${action.code}`,
        description: `${action.name} ${resource.name}`.trim()
      });
      permissionIds.set(`${resource.code}.${action.code}`, permissionId);
    }
  }

  for (const [roleName, resourceMatrix] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    await connection.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);
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
    const roleNames = CARGO_ROLE_MAP[String(cargo.code || "").toLowerCase()] || [];
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

const migrateLegacyRoles = async (connection, roleIds) => {
  let assignmentsMigrated = 0;
  let cargoMappingsMigrated = 0;
  let rolesDeactivated = 0;

  for (const [legacyRoleName, targetRoleName] of Object.entries(LEGACY_ROLE_RENAMES)) {
    const legacyRole = await fetchOne(connection, "SELECT id FROM roles WHERE name = ? LIMIT 1", [legacyRoleName]);
    const targetRoleId = roleIds.get(targetRoleName);
    if (!legacyRole || !targetRoleId) continue;

    const legacyRoleId = Number(legacyRole.id);
    const [assignmentInsertResult] = await connection.query(
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
         assigned_at,
         revoked_at,
         revoked_reason
       )
       SELECT
         ?,
         unit_id,
         derived_from_assignment_id,
         source,
         person_id,
         max_depth,
         start_date,
         end_date,
         is_current,
         COALESCE(assigned_at, NOW()),
         revoked_at,
         revoked_reason
       FROM role_assignments
       WHERE role_id = ?
         AND NOT EXISTS (
           SELECT 1
           FROM role_assignments target_ra
           WHERE target_ra.role_id = ?
             AND target_ra.person_id = role_assignments.person_id
             AND target_ra.unit_id = role_assignments.unit_id
             AND target_ra.source = role_assignments.source
             AND target_ra.start_date = role_assignments.start_date
             AND COALESCE(target_ra.end_date, '9999-12-31') = COALESCE(role_assignments.end_date, '9999-12-31')
         )`,
      [targetRoleId, legacyRoleId, targetRoleId]
    );
    assignmentsMigrated += Number(assignmentInsertResult.affectedRows || 0);

    const [cargoInsertResult] = await connection.query(
      `INSERT IGNORE INTO cargo_role_map (cargo_id, role_id)
       SELECT cargo_id, ?
       FROM cargo_role_map
       WHERE role_id = ?`,
      [targetRoleId, legacyRoleId]
    );
    cargoMappingsMigrated += Number(cargoInsertResult.affectedRows || 0);

    await connection.query("DELETE FROM cargo_role_map WHERE role_id = ?", [legacyRoleId]);
    await connection.query("DELETE FROM role_permissions WHERE role_id = ?", [legacyRoleId]);
    const [assignmentRevokeResult] = await connection.query(
      `UPDATE role_assignments
       SET is_current = 0,
           end_date = COALESCE(end_date, CURDATE()),
           revoked_at = COALESCE(revoked_at, NOW()),
           revoked_reason = COALESCE(revoked_reason, ?)
       WHERE role_id = ?
         AND is_current = 1`,
      [`Migrado a ${targetRoleName}`, legacyRoleId]
    );
    assignmentsMigrated += Number(assignmentRevokeResult.affectedRows || 0);

    const [roleResult] = await connection.query(
      `UPDATE roles
       SET is_active = 0,
           description = ?
       WHERE id = ?`,
      [`Rol legacy migrado a ${targetRoleName}.`, legacyRoleId]
    );
    rolesDeactivated += Number(roleResult.affectedRows || 0);
  }

  return {
    assignmentsMigrated,
    cargoMappingsMigrated,
    rolesDeactivated
  };
};

const ensureDemoAdminPerson = async (connection) => {
  const passwordHash = await bcrypt.hash(demoAdmin.password, 10);

  await connection.query(
    `INSERT INTO persons (
       cedula,
       first_name,
       last_name,
       email,
       whatsapp,
       direccion,
       pais,
       pais_residencia,
       provincia_residencia,
       ciudad_residencia,
       password_hash,
       status,
       verify_email,
       verify_whatsapp,
       is_active,
       token
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', 1, 1, 1, ?)
     ON DUPLICATE KEY UPDATE
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       email = VALUES(email),
       whatsapp = VALUES(whatsapp),
       direccion = VALUES(direccion),
       pais = VALUES(pais),
       pais_residencia = VALUES(pais_residencia),
       provincia_residencia = VALUES(provincia_residencia),
       ciudad_residencia = VALUES(ciudad_residencia),
       password_hash = VALUES(password_hash),
       status = 'Activo',
       verify_email = 1,
       verify_whatsapp = 1,
       is_active = 1,
       token = VALUES(token)`,
    [
      demoAdmin.cedula,
      demoAdmin.firstName,
      demoAdmin.lastName,
      demoAdmin.email,
      demoAdmin.whatsapp,
      "Av. Demo y Calle QA",
      "Ecuador",
      "Ecuador",
      "Esmeraldas",
      "Esmeraldas",
      passwordHash,
      demoAdmin.token
    ]
  );
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
  const existingAssignment = await fetchOne(
    connection,
    `SELECT id
     FROM role_assignments
     WHERE person_id = ?
       AND role_id = ?
       AND source = 'manual'
       AND is_current = 1
       AND (end_date IS NULL OR end_date >= CURDATE())
     LIMIT 1`,
    [person.id, roleId]
  );
  if (existingAssignment) return 0;
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

const revokeManualRoleByEmail = async (connection, { email, roleName, roleIds }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return 0;

  const stillAdmin = adminEmails.some(
    (adminEmail) => String(adminEmail || "").trim().toLowerCase() === normalizedEmail
  );
  if (stillAdmin) return 0;

  const person = await fetchOne(
    connection,
    "SELECT id, email FROM persons WHERE email = ? AND is_active = 1 LIMIT 1",
    [email]
  );
  if (!person) return 0;

  const roleId = roleIds.get(roleName);
  if (!roleId) return 0;

  const [result] = await connection.query(
    `UPDATE role_assignments
     SET is_current = 0,
         end_date = COALESCE(end_date, CURDATE()),
         revoked_at = NOW(),
         revoked_reason = 'Reasignacion de admin demo dedicado'
     WHERE person_id = ?
       AND role_id = ?
       AND source = 'manual'
       AND is_current = 1`,
    [person.id, roleId]
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
    for (const role of ROLE_CATALOG) {
      roleIds.set(role.name, await upsertRole(connection, role));
    }

    await ensureDemoAdminPerson(connection);
    await seedPermissions(connection, roleIds);
    const legacyMigration = await migrateLegacyRoles(connection, roleIds);
    const cargoMappings = await seedCargoRoleMap(connection, roleIds);
    const derivedAssignments = await backfillDerivedRoleAssignments(connection);
    const fallbackUnitId = await resolveDefaultUnitId(connection);

    let revokedAssignments = 0;
    for (const email of legacyAdminEmails) {
      revokedAssignments += await revokeManualRoleByEmail(connection, {
        email,
        roleName: ADMIN_ROLE_NAME,
        roleIds
      });
    }

    let manualAssignments = 0;
    for (const email of adminEmails) {
      manualAssignments += await assignManualRoleByEmail(connection, {
        email,
        roleName: ADMIN_ROLE_NAME,
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
    console.log(`Asignaciones legacy migradas/revocadas: ${legacyMigration.assignmentsMigrated}`);
    console.log(`Mapeos cargo-rol legacy migrados: ${legacyMigration.cargoMappingsMigrated}`);
    console.log(`Roles legacy desactivados: ${legacyMigration.rolesDeactivated}`);
    console.log(`Asignaciones derivadas nuevas: ${derivedAssignments}`);
    console.log(`Asignaciones manuales nuevas: ${manualAssignments}`);
    console.log(`Asignaciones admin heredadas revocadas: ${revokedAssignments}`);
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
