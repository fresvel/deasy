import bcrypt from "bcrypt";
import crypto from "crypto";
import { getMariaDBPool } from "../../config/mariadb.js";

const BOOTSTRAP_UNIT_TYPE_NAME = "Sistema";
const BOOTSTRAP_UNIT_NAME = "Raiz del sistema";
const BOOTSTRAP_UNIT_LABEL = "Sistema";
const BOOTSTRAP_UNIT_SLUG = "root-system";
const ADMIN_ROLE_NAME = "Admin";
const MANUAL_ROLE_SOURCE = "manual";

const ROLE_CATALOG = [
  { name: "Admin", description: "Acceso completo sobre administracion, usuarios, roles y procesos." },
  { name: "Gestor", description: "Crea, gestiona y elimina procesos operativos." },
  { name: "Auditor", description: "Solo lectura sobre datos y procesos." },
  { name: "Usuario", description: "Acceso a funcionalidades generales de usuario." }
];

const RESOURCE_CATALOG = [
  { code: "account", name: "Cuenta", description: "Datos de cuenta y sesion." },
  { code: "dossier", name: "Dossier", description: "Perfil profesional y evidencias." },
  { code: "documents", name: "Documentos", description: "Centro documental del usuario." },
  { code: "processes", name: "Procesos", description: "Procesos, tareas y definiciones." },
  { code: "roles", name: "Roles", description: "Roles, permisos y asignaciones." },
  { code: "users", name: "Usuarios", description: "Administracion de usuarios." }
];

const ACTION_CATALOG = [
  { code: "read", name: "Leer", description: "Consultar registros." },
  { code: "create", name: "Crear", description: "Crear registros." },
  { code: "update", name: "Actualizar", description: "Modificar registros." },
  { code: "delete", name: "Eliminar", description: "Eliminar registros." },
  { code: "manage", name: "Administrar", description: "Administracion completa del modulo." }
];

const ROLE_PERMISSION_MATRIX = {
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

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 10;

const fetchOne = async (connection, sql, params = []) => {
  const [rows] = await connection.query(sql, params);
  return rows?.[0] ?? null;
};

const toBoolean = (value) => Number(value || 0) > 0;

const buildError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateRawToken = () => {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = "";
  for (let index = 0; index < TOKEN_LENGTH; index += 1) {
    token += TOKEN_CHARS[bytes[index] % TOKEN_CHARS.length];
  }
  return token;
};

const generateUniqueTokenWithConnection = async (connection) => {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const token = generateRawToken();
    const row = await fetchOne(
      connection,
      "SELECT id FROM persons WHERE token = ? LIMIT 1",
      [token]
    );
    if (!row) {
      return token;
    }
  }
  throw buildError("No se pudo generar un token unico para el administrador.", 500);
};

const normalizeString = (value, { lower = false } = {}) => {
  const normalized = String(value || "").trim();
  return lower ? normalized.toLowerCase() : normalized;
};

const normalizeCedula = (value) => String(value || "").replace(/\D/g, "");

const validateAdminPayload = (payload = {}) => {
  const cedula = normalizeCedula(payload.cedula);
  const firstName = normalizeString(payload.first_name);
  const lastName = normalizeString(payload.last_name);
  const email = normalizeString(payload.email, { lower: true });
  const whatsapp = normalizeString(payload.whatsapp);
  const password = String(payload.password || "");
  const confirmPassword = String(payload.confirm_password || payload.repassword || "");

  if (!cedula) throw buildError("La cedula del administrador es requerida.");
  if (cedula.length < 10) throw buildError("La cedula del administrador no es valida.");
  if (!firstName) throw buildError("Los nombres del administrador son requeridos.");
  if (!lastName) throw buildError("Los apellidos del administrador son requeridos.");
  if (!email) throw buildError("El correo del administrador es requerido.");
  if (!password) throw buildError("La contraseña del administrador es requerida.");
  if (password.length < 8) throw buildError("La contraseña debe tener al menos 8 caracteres.");
  if (!confirmPassword) throw buildError("Debes confirmar la contraseña del administrador.");
  if (password !== confirmPassword) throw buildError("Las contraseñas no coinciden.");

  return {
    cedula,
    first_name: firstName,
    last_name: lastName,
    email,
    whatsapp: whatsapp || null,
    password
  };
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

const seedBaseRbacCatalog = async (connection) => {
  const roleIds = new Map();
  const resourceIds = new Map();
  const actionIds = new Map();
  const permissionIds = new Map();

  for (const role of ROLE_CATALOG) {
    roleIds.set(role.name, await upsertRole(connection, role));
  }

  for (const resource of RESOURCE_CATALOG) {
    resourceIds.set(resource.code, await upsertResource(connection, resource));
  }

  for (const action of ACTION_CATALOG) {
    actionIds.set(action.code, await upsertAction(connection, action));
  }

  for (const resource of RESOURCE_CATALOG) {
    for (const action of ACTION_CATALOG) {
      const permissionCode = `${resource.code}.${action.code}`;
      const permissionId = await upsertPermission(connection, {
        resourceId: resourceIds.get(resource.code),
        actionId: actionIds.get(action.code),
        code: permissionCode,
        description: `${action.name} ${resource.name}`.trim()
      });
      permissionIds.set(permissionCode, permissionId);
    }
  }

  for (const [roleName, resourceMatrix] of Object.entries(ROLE_PERMISSION_MATRIX)) {
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

  return roleIds;
};

const ensureBootstrapUnit = async (connection) => {
  const existingUnit = await fetchOne(
    connection,
    "SELECT id FROM units WHERE is_active = 1 ORDER BY id ASC LIMIT 1"
  );
  if (existingUnit) {
    return Number(existingUnit.id);
  }

  let unitType = await fetchOne(
    connection,
    "SELECT id FROM unit_types WHERE name = ? LIMIT 1",
    [BOOTSTRAP_UNIT_TYPE_NAME]
  );

  if (!unitType) {
    const [result] = await connection.query(
      "INSERT INTO unit_types (name, is_active) VALUES (?, 1)",
      [BOOTSTRAP_UNIT_TYPE_NAME]
    );
    unitType = { id: result.insertId };
  }

  await connection.query(
    `INSERT INTO units (name, label, slug, unit_type_id, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [BOOTSTRAP_UNIT_NAME, BOOTSTRAP_UNIT_LABEL, BOOTSTRAP_UNIT_SLUG, unitType.id]
  );

  const inserted = await fetchOne(
    connection,
    "SELECT id FROM units WHERE slug = ? LIMIT 1",
    [BOOTSTRAP_UNIT_SLUG]
  );

  return Number(inserted.id);
};

const upsertAdminPerson = async (connection, payload) => {
  const existingPerson = await fetchOne(
    connection,
    `SELECT id, cedula, email, token
     FROM persons
     WHERE cedula = ? OR email = ?
     LIMIT 1`,
    [payload.cedula, payload.email]
  );

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const token = existingPerson?.token || await generateUniqueTokenWithConnection(connection);

  if (existingPerson) {
    await connection.query(
      `UPDATE persons
       SET cedula = ?,
           first_name = ?,
           last_name = ?,
           email = ?,
           whatsapp = ?,
           password_hash = ?,
           status = 'Activo',
           verify_email = 1,
           verify_whatsapp = 1,
           is_active = 1,
           token = ?
       WHERE id = ?`,
      [
        payload.cedula,
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.whatsapp,
        passwordHash,
        token,
        existingPerson.id
      ]
    );
    return { id: Number(existingPerson.id), token };
  }

  const [result] = await connection.query(
    `INSERT INTO persons (
       cedula,
       first_name,
       last_name,
       email,
       whatsapp,
       password_hash,
       status,
       verify_email,
       verify_whatsapp,
       is_active,
       token
     )
     VALUES (?, ?, ?, ?, ?, ?, 'Activo', 1, 1, 1, ?)`,
    [
      payload.cedula,
      payload.first_name,
      payload.last_name,
      payload.email,
      payload.whatsapp,
      passwordHash,
      token
    ]
  );

  return { id: Number(result.insertId), token };
};

const ensureAdminRoleAssignment = async (connection, { personId, roleId, unitId }) => {
  await connection.query(
    `UPDATE role_assignments
     SET is_current = 0,
         end_date = COALESCE(end_date, CURDATE()),
         revoked_at = COALESCE(revoked_at, NOW()),
         revoked_reason = COALESCE(revoked_reason, 'Reasignacion de administrador bootstrap')
     WHERE person_id = ?
       AND role_id = ?
       AND source = ?
       AND is_current = 1`,
    [personId, roleId, MANUAL_ROLE_SOURCE]
  );

  await connection.query(
    `INSERT INTO role_assignments (
       role_id,
       unit_id,
       source,
       person_id,
       max_depth,
       start_date,
       is_current,
       assigned_at
     )
     VALUES (?, ?, ?, ?, 0, CURDATE(), 1, NOW())`,
    [roleId, unitId, MANUAL_ROLE_SOURCE, personId]
  );
};

export default class SystemBootstrapService {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw buildError("Conexion MariaDB no disponible.", 500);
    }
  }

  async getBootstrapStatus() {
    this.ensurePool();

    const [rows] = await this.pool.query(
      `SELECT
         (SELECT COUNT(*) FROM persons) AS persons_count,
         (SELECT COUNT(*) FROM roles WHERE is_active = 1) AS roles_count,
         (SELECT COUNT(*) FROM permissions WHERE is_active = 1) AS permissions_count,
         (
           SELECT COUNT(*)
           FROM role_assignments ra
           INNER JOIN roles r ON r.id = ra.role_id
           INNER JOIN persons p ON p.id = ra.person_id
           WHERE r.name = ?
             AND r.is_active = 1
             AND ra.is_current = 1
             AND (ra.end_date IS NULL OR ra.end_date >= CURDATE())
             AND p.is_active = 1
         ) AS admin_count,
         (
           SELECT
             IF(
               EXISTS(SELECT 1 FROM process_runs LIMIT 1)
               OR EXISTS(SELECT 1 FROM tasks LIMIT 1)
               OR EXISTS(SELECT 1 FROM documents LIMIT 1)
               OR EXISTS(SELECT 1 FROM document_versions LIMIT 1)
               OR EXISTS(SELECT 1 FROM signature_requests LIMIT 1)
               OR EXISTS(SELECT 1 FROM position_assignments LIMIT 1),
               1,
               0
             )
         ) AS has_operational_data`,
      [ADMIN_ROLE_NAME]
    );

    const row = rows?.[0] || {};
    const hasAnyPerson = Number(row.persons_count || 0) > 0;
    const hasAnyRole = Number(row.roles_count || 0) > 0;
    const hasAnyPermission = Number(row.permissions_count || 0) > 0;
    const hasAnyAdmin = Number(row.admin_count || 0) > 0;
    const hasOperationalData = toBoolean(row.has_operational_data);
    const isVirginInstall = !hasAnyAdmin && !hasOperationalData;

    let installationMode = "normal";
    if (!hasAnyAdmin) {
      installationMode = isVirginInstall ? "bootstrap" : "recovery_required";
    }

    return {
      installationMode,
      hasAnyPerson,
      hasAnyRole,
      hasAnyPermission,
      hasAnyAdmin,
      hasOperationalData,
      isVirginInstall,
      environment: process.env.NODE_ENV || "development"
    };
  }

  async initializeSystem(payload = {}) {
    this.ensurePool();
    const status = await this.getBootstrapStatus();
    if (status.installationMode !== "bootstrap") {
      throw buildError(
        status.installationMode === "recovery_required"
          ? "La instancia contiene datos operativos y requiere recuperacion administrativa, no reinicializacion desde UI."
          : "El sistema ya fue inicializado.",
        409
      );
    }

    const adminPayload = validateAdminPayload(payload);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const roleIds = await seedBaseRbacCatalog(connection);
      const unitId = await ensureBootstrapUnit(connection);
      const admin = await upsertAdminPerson(connection, adminPayload);
      await ensureAdminRoleAssignment(connection, {
        personId: admin.id,
        roleId: roleIds.get(ADMIN_ROLE_NAME),
        unitId
      });
      await connection.commit();

      return {
        message: "El sistema se inicializo correctamente.",
        admin: {
          id: admin.id,
          cedula: adminPayload.cedula,
          email: adminPayload.email,
          first_name: adminPayload.first_name,
          last_name: adminPayload.last_name
        }
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async recoverAdmin(payload = {}) {
    this.ensurePool();
    const adminPayload = validateAdminPayload(payload);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const roleIds = await seedBaseRbacCatalog(connection);
      const unitId = await ensureBootstrapUnit(connection);
      const admin = await upsertAdminPerson(connection, adminPayload);
      await ensureAdminRoleAssignment(connection, {
        personId: admin.id,
        roleId: roleIds.get(ADMIN_ROLE_NAME),
        unitId
      });
      await connection.commit();
      return {
        message: "Administrador recuperado correctamente.",
        admin: {
          id: admin.id,
          cedula: adminPayload.cedula,
          email: adminPayload.email
        }
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }
}
