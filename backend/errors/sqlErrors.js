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

/** Columna obligatoria que llego nula. */
export const PG_NOT_NULL_VIOLATION = "23502";

export const isUniqueViolation = (error) => error?.code === PG_UNIQUE_VIOLATION;
export const isNotNullViolation = (error) => error?.code === PG_NOT_NULL_VIOLATION;
export const isForeignKeyViolation = (error) => error?.code === PG_FOREIGN_KEY_VIOLATION;

/** Violacion de un CHECK: la fila no cumple una regla que la base impone. */
export const PG_CHECK_VIOLATION = "23514";
export const isCheckViolation = (error) => error?.code === PG_CHECK_VIOLATION;

// LO QUE DICE CADA `CHECK` QUE ES UNA REGLA DE NEGOCIO, por el nombre de su restriccion.
//
// Un CHECK no se puede traducir en general, como un duplicado o una clave ajena: su `detail` trae
// la fila entera y no dice QUE regla fallo. Lo unico que identifica la regla es el NOMBRE de la
// restriccion, y por eso esto es una tabla y no una funcion: quien añade al esquema un CHECK que
// una persona puede provocar desde una pantalla, añade aqui su frase.
//
// Las que no estan aqui siguen saliendo con el texto del motor, como hasta ahora. No se inventa un
// mensaje generico: «el dato no es valido» no le dice a nadie que corregir.
// LAS REGLAS DE UNA VIDA son las mismas en cada tabla de periodos --de procesos, de unidades-- y solo
// cambia el nombre de la restriccion, que lleva el de su tabla. Se escriben UNA vez y se reparten:
// asi una tabla nueva de vigencias entra añadiendo su nombre a esta lista, no copiando cuatro frases.
const TABLAS_DE_VIGENCIA = Object.freeze({
  process_vigencias: "este proceso",
  unit_vigencias: "esta unidad",
  position_vigencias: "este puesto"
});

const reglasDeVida = (tabla) => ({
  [`ck_${tabla}_periodo`]: "La fecha de fin no puede ser anterior a la de inicio.",
  [`ck_${tabla}_fin_con_origen`]:
    "La fecha de fin y su origen van juntos: elige el origen, o deja las dos cosas en blanco.",
  [`ck_${tabla}_inicio_acto`]: "Poner en vigor por una reorganización necesita el acto que la ordena.",
  [`ck_${tabla}_fin_acto`]: "Suprimir por una reorganización necesita el acto que la ordena."
});

// LAS REGLAS DE UNA ARISTA FECHADA (frente 27, D-04): las mismas en los dos arboles.
const TABLAS_DE_ARISTA = Object.freeze({
  unit_relations: "esta unidad",
  process_relations: "este proceso"
});

const reglasDeArista = (tabla) => ({
  [`ck_${tabla}_no_propia`]: "Un nodo no puede depender de sí mismo.",
  [`ck_${tabla}_inicio_con_origen`]:
    "La fecha de inicio y su origen van juntos: elige el origen, o deja las dos cosas en blanco.",
  [`ck_${tabla}_borrador_sin_fin`]: "Una relación sin fecha de inicio no puede tener fecha de fin.",
  [`ck_${tabla}_periodo`]: "La fecha de fin no puede ser anterior a la de inicio.",
  [`ck_${tabla}_fin_con_origen`]:
    "La fecha de fin y su origen van juntos: elige el origen, o deja las dos cosas en blanco.",
  [`ck_${tabla}_inicio_acto`]: "Una relación que empieza por una reorganización necesita el acto que la ordena.",
  [`ck_${tabla}_fin_acto`]: "Una relación que termina por una reorganización necesita el acto que la ordena."
});

const MENSAJES_DE_CHECK = Object.freeze({
  ...Object.assign({}, ...Object.keys(TABLAS_DE_ARISTA).map(reglasDeArista)),
  ck_correcciones_de_estructura_motivo: "Una corrección necesita su motivo, escrito (al menos 10 caracteres).",
  ck_actos_un_solo_emisor:
    "Un acto tiene exactamente un emisor: una unidad o un emisor externo, no los dos ni ninguno.",
  ck_actos_un_solo_suscriptor:
    "«Suscrito por» es una persona del sistema o un nombre escrito, no los dos.",
  ...Object.assign({}, ...Object.keys(TABLAS_DE_VIGENCIA).map(reglasDeVida))
});

export const checkViolationMessage = (error) => MENSAJES_DE_CHECK[violatedConstraint(error)] ?? null;

/**
 * `restrict_violation` lanzado A PROPOSITO por un disparador nuestro, con su frase ya escrita:
 * los eslabones inmutables de la cadena de un entregable y el borrado de una vida que ya empezo.
 * No trae nombre de restriccion --no la hay--, y el mensaje ES la frase: la escribio quien puso la
 * regla en el esquema, en castellano y para una persona.
 *
 * ⚠️ Se distingue de una clave ajena `ON DELETE RESTRICT`, que usa el MISMO codigo, en que aquella
 * SI trae `constraint`. Esa sigue saliendo como hasta ahora.
 */
export const PG_RESTRICT_VIOLATION = "23001";
export const esRechazoDeUnDisparador = (error) =>
  error?.code === PG_RESTRICT_VIOLATION && !violatedConstraint(error) && Boolean(error?.message);

/** Violacion de una restriccion de EXCLUSION: dos filas que no pueden coexistir. */
export const PG_EXCLUSION_VIOLATION = "23P01";
export const isExclusionViolation = (error) => error?.code === PG_EXCLUSION_VIOLATION;

// Misma idea que los CHECK, y por el mismo motivo: lo unico que identifica la regla es el NOMBRE.
const MENSAJES_DE_EXCLUSION = Object.freeze(
  Object.fromEntries([
    ...Object.entries(TABLAS_DE_VIGENCIA).map(([tabla, de]) => [
      `ex_${tabla}_sin_solape`,
      `Ese periodo coincide con otra vida de ${de}: cierra la anterior o cambia las fechas.`
    ]),
    ...Object.entries(TABLAS_DE_ARISTA).map(([tabla, de]) => [
      `ex_${tabla}_sin_solape`,
      `En esas fechas ${de} ya depende de otro padre: cierra esa relación o cambia las fechas.`
    ])
  ])
);

/** Los nombres de restriccion que este modulo sabe traducir. Lo lee el test que los ata al esquema. */
export const RESTRICCIONES_CON_FRASE = Object.freeze({
  check: Object.keys(MENSAJES_DE_CHECK),
  exclusion: Object.keys(MENSAJES_DE_EXCLUSION)
});

export const exclusionViolationMessage = (error) => MENSAJES_DE_EXCLUSION[violatedConstraint(error)] ?? null;

/** Nombre de la restricción violada, "" si el error no es de restricción. */
export const violatedConstraint = (error) => String(error?.constraint || "");

// El `detail` de PostgreSQL no siempre lista columnas a secas: cuando el índice es de EXPRESIÓN
// escribe la expresión entera: un índice sobre (a, COALESCE(b, 0), c) llega como
// `Key (a, COALESCE(b, 0), c)=(…)`.
//
// El que lo destapó fue `uq_documentos_numero`, que era (tipo, COALESCE(pais_id,0), numero). Ya no
// lo es —`pais_id` pasó a NOT NULL y el COALESCE sobró—, así que hoy el esquema no tiene ninguno.
// Esto se queda: es una forma que PostgreSQL produce, no una peculiaridad de aquella tabla.
//
// Por eso el patrón se ancla en `)=(` y no en «lo que no sea un paréntesis»: con `[^)]+` el primer
// `)` de la COALESCE cortaba la captura, el patrón no casaba, y el mensaje caía al genérico
// «Ya existe otro registro con esos datos.» — sin decir QUÉ estaba repetido. Medido el 2026-08-28,
// justo cuando el documento de identidad salió de `persons` y estrenó ese índice.
const KEY_COLUMNS_RE = /^Key \((.+)\)=\(/;
const REFERENCED_TABLE_RE = /is not present in table "([^"]+)"/;

/** Parte una lista de columnas por comas, sin partir dentro de los paréntesis de una expresión. */
const splitTopLevel = (texto) => {
  const partes = [];
  let actual = "";
  let profundidad = 0;
  for (const caracter of texto) {
    if (caracter === "(") profundidad += 1;
    else if (caracter === ")") profundidad -= 1;
    if (caracter === "," && profundidad === 0) {
      partes.push(actual);
      actual = "";
      continue;
    }
    actual += caracter;
  }
  partes.push(actual);
  return partes;
};

// De una expresión se queda con la columna: `COALESCE(pais_id, 0)` -> `pais_id`. Es el primer
// identificador que va DENTRO del paréntesis; el de fuera es el nombre de la función.
const IDENTIFICADOR_EN_EXPRESION = /\(\s*"?([a-z_][a-z0-9_]*)"?/i;

const columnaDe = (parte) => {
  const limpia = parte.trim().replace(/^"|"$/g, "");
  if (/^[a-z_][a-z0-9_]*$/i.test(limpia)) {
    return limpia;
  }
  return IDENTIFICADOR_EN_EXPRESION.exec(limpia)?.[1] || "";
};

/** Columnas implicadas en la violación, sacadas del `detail`. `[]` si no se pueden determinar. */
export const violatedColumns = (error) => {
  const match = KEY_COLUMNS_RE.exec(String(error?.detail || ""));
  if (!match) {
    return [];
  }
  return splitTopLevel(match[1]).map(columnaDe).filter(Boolean);
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

/**
 * «Falta «Pais emisor».» en vez del mensaje crudo de PostgreSQL.
 *
 * Hasta el 2026-08-29 el `23502` no se traducia y el usuario del admin leia
 * `null value in column "pais_id" of relation "documentos_identidad" violates not-null constraint`,
 * que nombra una columna que no aparece en ninguna pantalla.
 *
 * Y NO es un caso raro reservado a los descuidos: hay campos que la base exige y el formulario NO
 * PREGUNTA a proposito, porque los rellena un trigger segun el resto de la fila —el pais del
 * documento nacional es justo eso—. Ahi la base es el unico que sabe si de verdad falta algo,
 * porque lo comprueba DESPUES de que los triggers hayan puesto lo suyo. Este mensaje es la unica
 * forma de que ese "de verdad falta" llegue legible.
 */
export function notNullViolationMessage(error, tableName) {
  const columna = String(error?.column || "");
  if (!columna) {
    return "Falta un dato obligatorio.";
  }
  return `Falta «${fieldLabel(tableName, columna)}».`;
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
  // 400: el cliente no mando un dato obligatorio. No es 409 — nada esta cogido, falta algo.
  if (isNotNullViolation(error)) {
    return badRequest(notNullViolationMessage(error, tableName));
  }
  // 400: la fila no cumple una regla. Solo se traduce el CHECK que tiene su frase; el que no, se
  // deja pasar tal cual, igual que antes de que esto existiera.
  if (isCheckViolation(error)) {
    const mensaje = checkViolationMessage(error);
    return mensaje ? badRequest(mensaje) : null;
  }
  // 409: una regla del esquema dice que ESO, en el estado en que esta, no se puede hacer.
  if (esRechazoDeUnDisparador(error)) {
    return conflict(error.message);
  }
  // 409: el estado actual no admite la operacion --ya hay otra fila que ocupa ese sitio--, que es
  // la misma familia que un duplicado.
  if (isExclusionViolation(error)) {
    const mensaje = exclusionViolationMessage(error);
    return mensaje ? conflict(mensaje) : null;
  }
  return null;
}
