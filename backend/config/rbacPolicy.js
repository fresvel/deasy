import {
  ADMIN_ROLES,
  DEFAULT_ADMIN_TABLE_RESOURCE,
  MANAGEMENT_ROLES,
  OPERATIVE_READ_ROLES,
  OPERATIVE_WRITE_ROLES,
  PROCESS_MANAGEMENT_ROLES,
  TABLE_RESOURCE_MAP
} from "./rbacCatalog.js";

export {
  ADMIN_ROLES,
  DEFAULT_ADMIN_TABLE_RESOURCE,
  MANAGEMENT_ROLES,
  OPERATIVE_READ_ROLES,
  OPERATIVE_WRITE_ROLES,
  PROCESS_MANAGEMENT_ROLES,
  TABLE_RESOURCE_MAP
};

export const resolveTableResource = (tableName = "") =>
  TABLE_RESOURCE_MAP[String(tableName || "").trim()] || DEFAULT_ADMIN_TABLE_RESOURCE;

export const actionForHttpMethod = (method = "GET") => {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod === "GET") return "read";
  if (normalizedMethod === "POST") return "create";
  if (normalizedMethod === "PUT" || normalizedMethod === "PATCH") return "update";
  if (normalizedMethod === "DELETE") return "delete";
  return "manage";
};
