import {
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  OPERATIVE_READ_ROLES,
  OPERATIVE_WRITE_ROLES,
  PROCESS_MANAGEMENT_ROLES,
  SENSITIVE_RESOURCES,
  TABLE_RESOURCE_MAP
} from "./rbacCatalog.js";

export {
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  OPERATIVE_READ_ROLES,
  OPERATIVE_WRITE_ROLES,
  PROCESS_MANAGEMENT_ROLES,
  SENSITIVE_RESOURCES,
  TABLE_RESOURCE_MAP
};

// El recurso que protege una tabla del editor de /admin, o NULL si no tiene -- y NULL SE NIEGA.
//
// ⚠️ HASTA EL 2026-09-10 DEVOLVIA `process_definitions` POR DEFECTO. Parecia prudente -- «algo la
// protegera»-- y era lo contrario: diecinueve tablas, cedulas y correos incluidos, quedaron
// gobernadas por el permiso de PROCESOS sin que nadie lo decidiera. GestorProcesos editaba cedulas y
// GestorTalentoHumano, que gestiona personas, no las podia ni leer. Un valor por defecto en un control
// de acceso es un permiso que nadie ha concedido.
//
// `Object.hasOwn` y no `MAPA[nombre]`: en un objeto literal, «constructor» o «toString» devuelven
// funciones del prototipo, que son verdaderas.
export const resolveTableResource = (tableName = "") => {
  const nombre = String(tableName || "").trim();
  return Object.hasOwn(TABLE_RESOURCE_MAP, nombre) ? TABLE_RESOURCE_MAP[nombre] : null;
};

// Si los accesos a este recurso van a la bitacora `accesos_sensibles`.
export const esRecursoSensible = (resource) => SENSITIVE_RESOURCES.includes(resource);

export const actionForHttpMethod = (method = "GET") => {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod === "GET") return "read";
  if (normalizedMethod === "POST") return "create";
  if (normalizedMethod === "PUT" || normalizedMethod === "PATCH") return "update";
  if (normalizedMethod === "DELETE") return "delete";
  return "manage";
};
