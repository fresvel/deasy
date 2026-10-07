import RbacService from "../services/auth/RbacService.js";
import {
  actionForHttpMethod,
  OPERATIVE_READ_ROLES,
  OPERATIVE_WRITE_ROLES,
  resolveTableResource
} from "../config/rbacPolicy.js";
import { SQL_TABLE_MAP } from "../config/sqlTables.js";

let _rbacService = null;
const rbacService = () => (_rbacService ??= new RbacService());

const getAuthenticatedUserId = (req) => Number(req.user?.uid || req.auth?.userId || 0);

const hasAnyRole = (access, roles = []) => rbacService().hasAnyRole(access, roles);
const can = (access, resource, action) => rbacService().can(access, resource, action);
const hasPermissionOrManage = (access, permissionCode) => {
  const [resource, action] = String(permissionCode || "").split(".");
  if (!resource || !action) {
    return rbacService().hasPermission(access, permissionCode);
  }
  return can(access, resource, action);
};

const deny = (res, message = "No tienes permisos para realizar esta accion.") =>
  res.status(403).json({ message });

const ensureAccessContext = async (req, res) => {
  if (req.auth?.access) {
    return req.auth;
  }

  const userId = getAuthenticatedUserId(req);
  const context = await rbacService().getUserAccessContext(userId);
  if (!context) {
    res.status(401).json({ message: "Usuario autenticado no disponible o inactivo." });
    return null;
  }

  req.auth = context;
  req.access = context.access;
  return context;
};

export const loadAccessContext = async (req, res, next) => {
  try {
    const context = await ensureAccessContext(req, res);
    if (!context) return;
    next();
  } catch (error) {
    console.error("Error cargando contexto RBAC:", error);
    res.status(500).json({ message: "No se pudo resolver permisos del usuario." });
  }
};

export const requirePermissions = (requirements, options = {}) => async (req, res, next) => {
  try {
    const context = await ensureAccessContext(req, res);
    if (!context) return;

    const required = Array.isArray(requirements) ? requirements : [requirements];
    const validRequired = required.filter(Boolean);
    const isAllowed = options.all
      ? validRequired.every((permission) => hasPermissionOrManage(context.access, permission))
      : validRequired.some((permission) => hasPermissionOrManage(context.access, permission));

    if (isAllowed) {
      next();
      return;
    }

    deny(res);
  } catch (error) {
    console.error("Error validando permisos:", error);
    res.status(500).json({ message: "No se pudo validar permisos." });
  }
};

export const requireAnyRole = (roles = []) => async (req, res, next) => {
  try {
    const context = await ensureAccessContext(req, res);
    if (!context) return;

    if (hasAnyRole(context.access, roles)) {
      next();
      return;
    }

    deny(res);
  } catch (error) {
    console.error("Error validando rol:", error);
    res.status(500).json({ message: "No se pudo validar el rol." });
  }
};

export const requireRouteUserAccess = ({
  idParam = "id",
  resource = "users",
  action = "read",
  elevatedRoles = action === "read" ? OPERATIVE_READ_ROLES : OPERATIVE_WRITE_ROLES
} = {}) => async (req, res, next) => {
  try {
    const context = await ensureAccessContext(req, res);
    if (!context) return;

    const routeUserId = Number(req.params?.[idParam] || 0);
    const isOwner = routeUserId && Number(context.userId) === routeUserId;
    const isElevated = hasAnyRole(context.access, elevatedRoles);
    const hasResourcePermission = can(context.access, resource, action);

    if ((isOwner && hasResourcePermission) || (isElevated && hasResourcePermission)) {
      next();
      return;
    }

    deny(res);
  } catch (error) {
    console.error("Error validando acceso por usuario:", error);
    res.status(500).json({ message: "No se pudo validar acceso del usuario." });
  }
};

export const requireCedulaAccess = ({
  cedulaParam = "cedula",
  resource = "account",
  action = "read",
  elevatedRoles = action === "read" ? OPERATIVE_READ_ROLES : OPERATIVE_WRITE_ROLES
} = {}) => async (req, res, next) => {
  try {
    const context = await ensureAccessContext(req, res);
    if (!context) return;

    const targetCedula = String(req.params?.[cedulaParam] || "").trim();
    const isOwner = targetCedula && String(context.cedula || "").trim() === targetCedula;
    const isElevated = hasAnyRole(context.access, elevatedRoles);
    const hasResourcePermission = can(context.access, resource, action);

    if ((isOwner && hasResourcePermission) || (isElevated && hasResourcePermission)) {
      next();
      return;
    }

    deny(res);
  } catch (error) {
    console.error("Error validando acceso por cedula:", error);
    res.status(500).json({ message: "No se pudo validar acceso del usuario." });
  }
};

/**
 * Como `requireCedulaAccess`, pero comparando el ID DE LA PERSONA.
 *
 * Existe porque el `:cedula` de la URL dejo de significar lo que dice: lo que se resolvia era el
 * NUMERO DEL DOCUMENTO PRINCIPAL, sea cedula o pasaporte. Y un pasaporte CAMBIA DE NUMERO al
 * renovarse, asi que la direccion de la foto de una persona cambiaba con su documento. El id no
 * cambia nunca.
 *
 * Se compara como NUMERO y no como texto: `"7"` y `7` son la misma persona, y una comparacion de
 * cadenas los habria dado por distintos — dejando al dueño fuera de su propia foto.
 */
export const requirePersonAccess = ({
  personParam = "personId",
  resource = "account",
  action = "read",
  elevatedRoles = action === "read" ? OPERATIVE_READ_ROLES : OPERATIVE_WRITE_ROLES
} = {}) => async (req, res, next) => {
  try {
    const context = await ensureAccessContext(req, res);
    if (!context) return;

    const objetivo = Number(req.params?.[personParam]);
    const propio = Number(context.userId);
    const isOwner = Number.isInteger(objetivo) && objetivo > 0 && objetivo === propio;
    const isElevated = hasAnyRole(context.access, elevatedRoles);
    const hasResourcePermission = can(context.access, resource, action);

    if ((isOwner || isElevated) && hasResourcePermission) {
      next();
      return;
    }

    deny(res);
  } catch (error) {
    console.error("Error validando acceso por persona:", error);
    res.status(500).json({ message: "No se pudo validar acceso del usuario." });
  }
};

export const requireDossierAccess = (action = "read") => requireCedulaAccess({
  resource: "dossier",
  action,
  elevatedRoles: action === "read" ? OPERATIVE_READ_ROLES : OPERATIVE_WRITE_ROLES
});

export const requireSqlAdminPermission = (options = {}) => async (req, res, next) => {
  try {
    const context = await ensureAccessContext(req, res);
    if (!context) return;

    const tableName = req.params?.table || options.table || "";
    const resource = options.resource || resolveTableResource(tableName);
    const action = options.action || actionForHttpMethod(req.method);

    if (!resource) {
      // Una tabla que el editor NO SIRVE sigue su camino, y el servicio responde 400 «Tabla no
      // soportada»: es la verdad y no expone nada, porque no hay filas detras. Lo que se CIERRA es una
      // tabla que el editor SI sirve y a la que nadie dio recurso -- antes caia a
      // `process_definitions`; ver `resolveTableResource`--.
      if (!Object.hasOwn(SQL_TABLE_MAP, tableName)) {
        next();
        return;
      }
      deny(res, `La tabla ${tableName} no tiene recurso asignado y queda cerrada.`);
      return;
    }

    if (can(context.access, resource, action)) {
      // El recurso viaja con la peticion: el controlador lo necesita para saber si el acceso va a la
      // bitacora, y recalcularlo alli seria una segunda fuente de verdad.
      req.recursoRbac = resource;
      next();
      return;
    }

    deny(res, `No tienes permiso ${resource}.${action} para esta operacion.`);
  } catch (error) {
    console.error("Error validando permiso SQL admin:", error);
    res.status(500).json({ message: "No se pudo validar permisos administrativos." });
  }
};
