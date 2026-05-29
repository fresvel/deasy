import { getMariaDBPool } from "../../config/mariadb.js";
import { ADMIN_ROLES } from "../../config/rbacPolicy.js";

const uniqueStrings = (values = []) =>
  [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];

export default class RbacService {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con MariaDB no esta disponible.");
    }
  }

  async getUserAccess(userId) {
    this.ensurePool();
    const numericUserId = Number(userId);
    if (!numericUserId || Number.isNaN(numericUserId)) {
      return this.emptyAccess();
    }

    const [roleRows] = await this.pool.query(
      `SELECT DISTINCT
         r.id,
         r.name,
         r.description,
         ra.unit_id,
         ra.source
       FROM role_assignments ra
       INNER JOIN roles r ON r.id = ra.role_id
       WHERE ra.person_id = ?
         AND ra.is_current = 1
         AND r.is_active = 1
         AND (ra.end_date IS NULL OR ra.end_date >= CURDATE())
       ORDER BY
         CASE r.name
           WHEN 'AdminSistema' THEN 1
           WHEN 'GestorSeguridad' THEN 2
           WHEN 'GestorTalentoHumano' THEN 3
           WHEN 'GestorUnidades' THEN 4
           WHEN 'GestorAcademico' THEN 5
           WHEN 'GestorProcesos' THEN 6
           WHEN 'GestorPlantillas' THEN 7
           WHEN 'GestorEjecucionProcesos' THEN 8
           WHEN 'GestorDocumental' THEN 9
           WHEN 'GestorFirmas' THEN 10
           WHEN 'GestorContratacion' THEN 11
           WHEN 'Auditor' THEN 12
           WHEN 'Usuario' THEN 13
           ELSE 14
         END,
         r.name ASC`,
      [numericUserId]
    );

    let roles = roleRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      description: row.description || "",
      unit_id: row.unit_id ? Number(row.unit_id) : null,
      source: row.source || "manual"
    }));

    if (!roles.length) {
      const [fallbackRows] = await this.pool.query(
        `SELECT id, name, description
         FROM roles
         WHERE name = 'Usuario' AND is_active = 1
         LIMIT 1`
      );
      if (fallbackRows[0]) {
        roles = [{
          id: Number(fallbackRows[0].id),
          name: fallbackRows[0].name,
          description: fallbackRows[0].description || "",
          unit_id: null,
          source: "fallback"
        }];
      }
    }

    const roleIds = uniqueStrings(roles.map((role) => role.id));
    const permissions = roleIds.length ? await this.getPermissionsForRoles(roleIds) : [];
    const roleNames = uniqueStrings(roles.map((role) => role.name));

    return {
      roles,
      roleNames,
      primaryRole: roleNames[0] || null,
      permissions,
      isAdmin: roleNames.some((roleName) => ADMIN_ROLES.includes(roleName))
    };
  }

  async getUserAccessContext(userId) {
    this.ensurePool();
    const numericUserId = Number(userId);
    if (!numericUserId || Number.isNaN(numericUserId)) {
      return null;
    }

    const [userRows] = await this.pool.query(
      `SELECT id, cedula, email, first_name, last_name, is_active, status
       FROM persons
       WHERE id = ?
       LIMIT 1`,
      [numericUserId]
    );
    const user = userRows[0];
    if (!user || Number(user.is_active ?? 1) !== 1) {
      return null;
    }

    const access = await this.getUserAccess(numericUserId);
    return {
      userId: numericUserId,
      cedula: user.cedula,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      status: user.status,
      access
    };
  }

  async getPermissionsForRoles(roleIds) {
    this.ensurePool();
    if (!roleIds.length) {
      return [];
    }

    const [permissionRows] = await this.pool.query(
      `SELECT DISTINCT p.code
       FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       INNER JOIN resources res ON res.id = p.resource_id
       INNER JOIN actions act ON act.id = p.action_id
       WHERE rp.role_id IN (?)
         AND p.is_active = 1
         AND res.is_active = 1
         AND act.is_active = 1
       ORDER BY p.code ASC`,
      [roleIds]
    );

    return uniqueStrings(permissionRows.map((row) => row.code));
  }

  emptyAccess() {
    return {
      roles: [],
      roleNames: [],
      primaryRole: null,
      permissions: [],
      isAdmin: false
    };
  }

  hasAnyRole(access, roles = []) {
    const allowedRoles = new Set(roles);
    return Boolean(access?.roleNames?.some((roleName) => allowedRoles.has(roleName)));
  }

  hasPermission(access, permissionCode) {
    if (!permissionCode) return false;
    if (access?.isAdmin) return true;
    return Boolean(access?.permissions?.includes(permissionCode));
  }

  can(access, resource, action) {
    if (!resource || !action) return false;
    return this.hasPermission(access, `${resource}.${action}`) ||
      this.hasPermission(access, `${resource}.manage`);
  }
}
