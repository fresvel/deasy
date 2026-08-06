// Traducción de violaciones de restricción de PostgreSQL a errores de negocio.
//
// POR QUÉ EXISTE. El backend mapeaba estas violaciones a mensajes de negocio comparando
// `error.code` con códigos de **MySQL** (`ER_DUP_ENTRY`, `ER_ROW_IS_REFERENCED`). Desde la
// migración a PostgreSQL esos códigos no llegan nunca: PostgreSQL usa **SQLSTATE**. Resultado:
// ocho mapeos muertos repartidos por cuatro ficheros y, peor, el usuario recibiendo el texto
// interno del motor:
//
//     duplicate key value violates unique constraint "persons_cedula_key"
//     update or delete on table "cargos" violates foreign key constraint "fk_unit_positions_cargo"
//
// Eso no es un mensaje: es el esquema de la base de datos filtrándose a la interfaz.
//
// EL ERROR DE `pg` TRAE MÁS DE LO QUE SE USABA. Además de `code` (el SQLSTATE), trae
// `constraint` (nombre exacto de la restricción), `table` y `detail`. Por eso aquí se compara
// `error.constraint === "uq_..."` en vez de buscar subcadenas en el mensaje, que era lo que
// hacía el código anterior y es frágil.
//
// Ejemplos de `detail`, de donde salen las columnas implicadas:
//     Key (cedula)=(1234567890) already exists.
//     Key (cargo_id)=(999999) is not present in table "cargos".

import { SQL_TABLE_MAP } from "../config/sqlTables.js";
import { conflict, badRequest } from "./HttpError.js";

/** Violación de restricción UNIQUE (o de clave primaria). */
export const PG_UNIQUE_VIOLATION = "23505";
/** Violación de clave foránea (referencia inexistente, o fila referenciada al borrar). */
export const PG_FOREIGN_KEY_VIOLATION = "23503";

export const isUniqueViolation = (error) => error?.code === PG_UNIQUE_VIOLATION;
export const isForeignKeyViolation = (error) => error?.code === PG_FOREIGN_KEY_VIOLATION;

/** Nombre de la restricción violada, "" si el error no es de restricción. */
export const violatedConstraint = (error) => String(error?.constraint || "");

const KEY_COLUMNS_RE = /^Key \(([^)]+)\)=/;
const REFERENCED_TABLE_RE = /is not present in table "([^"]+)"/;

/** Columnas implicadas en la violación, sacadas del `detail`. `[]` si no se pueden determinar. */
export const violatedColumns = (error) => {
  const match = KEY_COLUMNS_RE.exec(String(error?.detail || ""));
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((column) => column.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
};

// Las etiquetas humanas ya están declaradas en `sqlTables.js` (es lo que ve el usuario en el
// formulario del admin), así que el mensaje habla su mismo idioma: «Cédula», no `cedula`.
const fieldLabel = (tableName, column) =>
  SQL_TABLE_MAP[tableName]?.fields?.find((field) => field.name === column)?.label || column;

const tableLabel = (tableName) => SQL_TABLE_MAP[tableName]?.label || tableName;

const quoteList = (items) => items.map((item) => `«${item}»`).join(", ");

export function uniqueViolationMessage(error, tableName) {
  const columns = violatedColumns(error);
  if (!columns.length) {
    return "Ya existe otro registro con esos datos.";
  }
  const labels = quoteList(columns.map((column) => fieldLabel(tableName, column)));
  return columns.length === 1
    ? `Ya existe otro registro con ese valor en ${labels}.`
    : `Ya existe otro registro con esa combinación de ${labels}.`;
}

export function foreignKeyViolationMessage(error, tableName, { deleting = false } = {}) {
  if (deleting) {
    // Al BORRAR, `error.table` es la tabla que REFERENCIA (la que impide el borrado), no la que
    // se intenta borrar.
    const referencing = error?.table ? tableLabel(error.table) : "";
    return referencing
      ? `No se puede eliminar: hay registros en «${referencing}» que dependen de este.`
      : "No se puede eliminar: otros registros dependen de este.";
  }
  const columns = violatedColumns(error);
  const labels = columns.length
    ? quoteList(columns.map((column) => fieldLabel(tableName, column)))
    : "";
  const referenced = REFERENCED_TABLE_RE.exec(String(error?.detail || ""));
  const target = referenced ? tableLabel(referenced[1]) : "";
  if (labels && target) {
    return `El valor de ${labels} no corresponde a ningún registro de «${target}».`;
  }
  if (labels) {
    return `El valor de ${labels} no corresponde a ningún registro existente.`;
  }
  return "Uno de los valores referenciados no existe.";
}

/**
 * Traduce una violación de restricción a un `HttpError` con mensaje de negocio.
 * Devuelve `null` si el error NO es de restricción — el llamador debe relanzarlo tal cual, porque
 * un error que no sabemos traducir es un fallo de verdad y debe seguir siéndolo.
 *
 * Códigos: duplicado y "fila referenciada al borrar" son **409** (el estado actual no admite la
 * operación); referenciar algo inexistente es **400** (la petición trae un id que no vale).
 */
export function translateConstraintError(error, tableName, { deleting = false } = {}) {
  if (isUniqueViolation(error)) {
    return conflict(uniqueViolationMessage(error, tableName));
  }
  if (isForeignKeyViolation(error)) {
    return deleting
      ? conflict(foreignKeyViolationMessage(error, tableName, { deleting: true }))
      : badRequest(foreignKeyViolationMessage(error, tableName));
  }
  return null;
}
