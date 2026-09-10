// El recurso que protege cada tabla del editor de /admin LO DICE EL BACKEND, en `/admin/sql/meta`.
//
// ⚠️ AQUI HABIA UNA COPIA A MANO DE LAS 53 ENTRADAS del mapa del backend, sin ninguna prueba que las
// comparara -- el contenedor del backend ni siquiera ve este codigo--, y con un valor por defecto,
// `process_definitions`. Las dos cosas se retiraron en el frente 20 (P8), cuando se midio que ese
// defecto habia dejado diecinueve tablas, cedulas incluidas, bajo el permiso de procesos. Ahora cada
// vista que carga `meta` registra lo que dice el backend, y una tabla sin registrar NO se puede leer
// ni escribir: se esconde, que es lo mismo que respondera el backend.
const recursosDeTabla = new Map();

export const registrarRecursosDeTablas = (tablas = []) => {
  recursosDeTabla.clear();
  for (const tabla of tablas) {
    if (tabla?.table && tabla?.resource) {
      recursosDeTabla.set(String(tabla.table), String(tabla.resource));
    }
  }
};

const SYSTEM_ADMIN_ROLES = ["AdminSistema"];
export const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Guarda el usuario de la sesion en `localStorage` SIN `datos_personales`.
//
// `GET /users/me` y `PATCH /users/me` le devuelven al titular sus datos personales, y entre ellos
// el genero y la autoidentificacion etnica, que la LOPDP (Art. 4) cuenta como SENSIBLES. Sirven
// para pintar y editar el perfil EN ESA PANTALLA; no para quedarse en el navegador sin fecha de
// caducidad, al alcance de cualquier script de la pagina y de quien use el equipo despues.
//
// Lo que se lee de aqui --roles, permisos, nombre, foto-- no los necesita. Quien quiera los datos
// personales los pide a `/users/me`, que es la unica fuente.
//
// `globalThis` y no `window`: es el mismo objeto en el navegador, y en las pruebas (entorno node, con
// un `localStorage` de mentira) `window` no existe y la escritura se perderia en silencio.
export const storeUser = (user) => {
  const almacen = globalThis.localStorage;
  if (!almacen || !user) return;
  // eslint-disable-next-line no-unused-vars
  const { datos_personales, ...guardable } = user;
  almacen.setItem("user", JSON.stringify(guardable));
};

const normalizeList = (values = []) =>
  Array.isArray(values)
    ? values.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

export const getUserRoles = (user = getStoredUser()) => {
  const accessRoles = normalizeList(user?.access?.roleNames);
  const publicRoles = normalizeList(user?.roles);
  const legacyRole = user?.role ? [String(user.role).trim()] : [];
  return [...new Set([...accessRoles, ...publicRoles, ...legacyRole].filter(Boolean))];
};

export const getUserPermissions = (user = getStoredUser()) => {
  const accessPermissions = normalizeList(user?.access?.permissions);
  const publicPermissions = normalizeList(user?.permissions);
  return [...new Set([...accessPermissions, ...publicPermissions])];
};

// ESPEJO de backend/services/auth/RbacService.js (hasAnyRole/hasPermission/canAccessResource).
// La lógica core (`res.action || res.manage`) debe coincidir con el backend, que es la
// fuente de verdad: esto solo decide qué se muestra, el backend decide qué se permite.
// Diferencia intencional: el backend usa `access.isAdmin` precomputado; aquí se deriva
// de los roles (SYSTEM_ADMIN_ROLES). Al tocar esta lógica, revisa también el backend.
// (El backend tiene RbacService.test.js; este lado no tiene runner de tests todavía.)
export const hasAnyRole = (roles = [], user = getStoredUser()) => {
  const allowed = new Set(roles);
  return getUserRoles(user).some((role) => allowed.has(role));
};

export const hasPermission = (permissionCode, user = getStoredUser()) => {
  if (!permissionCode) return false;
  if (hasAnyRole(SYSTEM_ADMIN_ROLES, user)) return true;
  return getUserPermissions(user).includes(permissionCode);
};

export const canAccessResource = (resource, action = "read", user = getStoredUser()) => {
  if (!resource || !action) return false;
  return hasPermission(`${resource}.${action}`, user) ||
    hasPermission(`${resource}.manage`, user);
};

export const canReadResource = (resource, user = getStoredUser()) =>
  canAccessResource(resource, "read", user);

export const canWriteResource = (resource, user = getStoredUser()) =>
  ["create", "update", "delete", "manage"].some((action) =>
    canAccessResource(resource, action, user)
  );

// Tablas runtime: registros materializados/actualizados por los flujos del sistema. Se agrupan aparte
// (bloque "Trazabilidad y soporte") y sus acciones de escritura quedan restringidas (ver AdminTableManager).
export const TRACEABILITY_TABLES = new Set([
  "task_items",
  "task_item_tenures",
  "document_versions",
  "document_fill_flows",
  "fill_requests",
  "signature_flow_instances",
  "signature_requests",
  "document_signatures",
  // La bitacora de accesos sensibles: la escribe el sistema, nunca una persona desde /admin.
  "accesos_sensibles"
]);

export const isTraceabilityTable = (tableName) =>
  TRACEABILITY_TABLES.has(String(tableName || "").trim());

export const resolveAdminTableResource = (tableName = "") =>
  recursosDeTabla.get(String(tableName || "").trim()) ?? null;

export const canReadAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "read", user);

export const canCreateAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "create", user);

export const canUpdateAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "update", user);

export const canDeleteAdminTable = (tableName, user = getStoredUser()) =>
  canAccessResource(resolveAdminTableResource(tableName), "delete", user);

export const canAccessAdmin = (user = getStoredUser()) =>
  hasAnyRole(["AdminSistema", "GestorSeguridad", "Auditor"], user) ||
  ["security"].some((resource) =>
    canAccessResource(resource, "read", user)
  );

export const canAccessProcessManagement = (user = getStoredUser()) =>
  hasAnyRole([
    "AdminSistema",
    "GestorProcesos",
    "GestorPlantillas",
    "GestorEjecucionProcesos",
    "GestorDocumental",
    "GestorFirmas"
  ], user) ||
  ["process_definitions", "process_execution", "templates"].some((resource) =>
    ["create", "update", "delete", "manage"].some((action) =>
      canAccessResource(resource, action, user)
    )
  ) ||
  ["documents", "fill_flows", "signature_flows"].some((resource) =>
    ["create", "delete", "manage"].some((action) =>
      canAccessResource(resource, action, user)
    )
  );

export const isAdminUser = (user = getStoredUser()) =>
  hasAnyRole(SYSTEM_ADMIN_ROLES, user);

export const getDefaultAuthenticatedRoute = (user = getStoredUser()) =>
  isAdminUser(user) ? "/admin" : "/home";
