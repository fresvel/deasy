// Acceso a datos = PostgreSQL (migración completa; MariaDB retirado).
// Se conserva el nombre del módulo y de los exports (getMariaDBPool, etc.) por
// compatibilidad con los ~37 importadores y ~881 call sites; internamente TODO
// va al adaptador pg (config/postgres.js), que espeja la interfaz de mysql2.
import {
  getPostgresPool,
  getPostgresDatabaseName,
  assertPostgresConnection,
  closePostgresPool,
} from "./postgres.js";

export const getMariaDBPool = () => getPostgresPool();
export const getMariaDBDatabaseName = () => getPostgresDatabaseName();
// Legacy: sólo lo usaba el bootstrap MariaDB (retirado). Stub por compatibilidad.
export const getMariaDBBaseConfig = () => ({});
export const assertMariaDBConnection = () => assertPostgresConnection();
export const closeMariaDBPool = () => closePostgresPool();
