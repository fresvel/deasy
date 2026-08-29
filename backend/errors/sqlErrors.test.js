// Tests de la traducción de violaciones de restricción de PostgreSQL.
//
// Los errores de ejemplo son los REALES que devuelve el driver `pg` contra el esquema de Deasy
// (capturados ejecutando las violaciones contra la base de dev), no inventados: si el driver
// cambiara la forma de `detail`, estos tests lo detectan.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isUniqueViolation,
  isForeignKeyViolation,
  violatedConstraint,
  violatedColumns,
  isNotNullViolation,
  notNullViolationMessage,
  uniqueViolationMessage,
  foreignKeyViolationMessage,
  translateConstraintError,
} from "./sqlErrors.js";

// `persons_cedula_key` fue la fixture de este fichero hasta el 2026-08-28 y era la REAL. Dejó de
// serlo el día que el documento salió de `persons`: hoy no existe esa restricción, así que un error
// con ese nombre sería inventado — justo lo que la cabecera de este fichero promete no hacer.
// Ésta se capturó contra la base de dev provocando el duplicado.
const uniqueError = {
  code: "23505",
  constraint: "uq_emails_direccion",
  table: "emails",
  detail: "Key (direccion)=(admin@institucion.edu.ec) already exists.",
  message: 'duplicate key value violates unique constraint "uq_emails_direccion"',
};

// El caso que el parser NO sabía leer: un índice de EXPRESIÓN. PostgreSQL escribe la expresión
// entera en el `detail`, paréntesis incluidos.
//
// ⚠️ ESTA FIXTURE ES HISTÓRICA, y se dice para no engañar a quien lea la cabecera del fichero: se
// capturó de verdad contra la base, pero de un índice que YA NO EXISTE — `uq_documentos_numero` era
// (tipo, COALESCE(pais_id,0), numero) hasta que `pais_id` pasó a NOT NULL el 2026-08-29 y el
// COALESCE sobró. Hoy el esquema no tiene NINGÚN índice de expresión (comprobado contra el
// catálogo: cero).
//
// Se conserva a propósito. El parser sabe leerlos y borrar el caso dejaría ese camino sin una sola
// prueba, esperando al día que alguien vuelva a declarar uno — que es exactamente cuando el fallo
// costaría caro: el usuario leería «Ya existe otro registro con esos datos» sin saber cuáles.
const expressionUniqueError = {
  code: "23505",
  constraint: "uq_documentos_numero",
  table: "documentos_identidad",
  // Capturado el 2026-08-29, despues de que el tipo dejara de ser una clave ajena y pasara a ser un
  // CHECK: el `detail` nombra ahora la columna `tipo`, no `tipo_id`.
  detail: "Key (tipo, COALESCE(pais_id, 0), numero)=(documento_nacional, 60, 1234567897) already exists.",
  message: 'duplicate key value violates unique constraint "uq_documentos_numero"',
};

const compositeUniqueError = {
  code: "23505",
  constraint: "uq_unit_positions",
  table: "unit_positions",
  detail: "Key (unit_id, slot_no)=(8, 1) already exists.",
};

const fkOnWriteError = {
  code: "23503",
  constraint: "fk_unit_positions_cargo",
  table: "unit_positions",
  detail: 'Key (cargo_id)=(999999) is not present in table "cargos".',
};

const fkOnDeleteError = {
  code: "23503",
  constraint: "fk_unit_positions_cargo",
  table: "unit_positions",
  detail: 'Key (id)=(1) is still referenced from table "unit_positions".',
};

test("reconoce los SQLSTATE de PostgreSQL, no los códigos de MySQL", () => {
  assert.equal(isUniqueViolation(uniqueError), true);
  assert.equal(isForeignKeyViolation(fkOnWriteError), true);
  // La regresión que este módulo existe para evitar: el código de MySQL ya no llega nunca.
  assert.equal(isUniqueViolation({ code: "ER_DUP_ENTRY" }), false);
  assert.equal(isForeignKeyViolation({ code: "ER_ROW_IS_REFERENCED" }), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation(new Error("boom")), false);
});

test("expone el nombre exacto de la restricción (en vez de buscar subcadenas en el mensaje)", () => {
  assert.equal(violatedConstraint(uniqueError), "uq_emails_direccion");
  assert.equal(violatedConstraint(new Error("boom")), "");
});

test("saca las columnas implicadas del detail", () => {
  assert.deepEqual(violatedColumns(uniqueError), ["direccion"]);
  assert.deepEqual(violatedColumns(compositeUniqueError), ["unit_id", "slot_no"]);
  assert.deepEqual(violatedColumns({ code: "23505" }), []);
  // Un índice de expresión: se queda con la COLUMNA de dentro, no con la función de fuera.
  assert.deepEqual(violatedColumns(expressionUniqueError), ["tipo", "pais_id", "numero"]);
});

test("el mensaje de duplicado usa la etiqueta del formulario, no el nombre de columna", () => {
  assert.equal(
    uniqueViolationMessage(uniqueError, "emails"),
    // La etiqueta viene de `sqlTables.js`: el usuario lee «Direccion», no `direccion`.
    "Ya existe otro registro con ese valor en «Direccion»."
  );
  assert.match(uniqueViolationMessage(compositeUniqueError, "unit_positions"), /combinación de «Unidad», «Plaza»/);
  // La regresión que este caso fija: hasta el 2026-08-28 un índice de expresión caía al mensaje
  // genérico y el usuario no sabía QUÉ estaba repetido.
  assert.equal(
    uniqueViolationMessage(expressionUniqueError, "documentos_identidad"),
    "Ya existe otro registro con esa combinación de «Tipo», «Pais emisor», «Numero»."
  );
  // Sin `detail` no se inventa nada.
  assert.equal(
    uniqueViolationMessage({ code: "23505" }, "emails"),
    "Ya existe otro registro con esos datos."
  );
  // Una tabla desconocida no revienta: cae al nombre crudo de la columna.
  assert.equal(
    uniqueViolationMessage(uniqueError, "tabla_inexistente"),
    "Ya existe otro registro con ese valor en «direccion»."
  );
});

// Capturado el 2026-08-29 contra la base: `pais_id` es NOT NULL en `documentos_identidad`.
const notNullError = {
  code: "23502",
  column: "pais_id",
  table: "documentos_identidad",
  message: 'null value in column "pais_id" of relation "documentos_identidad" violates not-null constraint'
};

test("un campo obligatorio que falta se dice por su ETIQUETA, no por su columna", () => {
  assert.equal(isNotNullViolation(notNullError), true);
  assert.equal(isNotNullViolation(uniqueError), false);
  assert.equal(
    notNullViolationMessage(notNullError, "documentos_identidad"),
    "Falta «Pais emisor»."
  );
  // Tabla desconocida: el nombre crudo antes que un mensaje vacío.
  assert.equal(notNullViolationMessage(notNullError, "tabla_inexistente"), "Falta «pais_id».");
  // Sin columna no se inventa cuál.
  assert.equal(notNullViolationMessage({ code: "23502" }, "documentos_identidad"), "Falta un dato obligatorio.");
});

// Es un 400 y NO un 409: no hay nada cogido, falta algo. La distinción importa porque el editor
// genérico pinta los dos casos distinto.
test("el que falta un dato es 400, no 409", () => {
  const traducido = translateConstraintError(notNullError, "documentos_identidad");
  assert.equal(traducido.statusCode ?? traducido.status, 400);
  assert.match(traducido.message, /Falta «Pais emisor»/);
});

test("la clave foránea distingue escribir de borrar", () => {
  assert.equal(
    foreignKeyViolationMessage(fkOnWriteError, "unit_positions"),
    "El valor de «Cargo» no corresponde a ningún registro de «Cargos»."
  );
  // Al borrar, `error.table` es la tabla que REFERENCIA, no la que se borra.
  assert.equal(
    foreignKeyViolationMessage(fkOnDeleteError, "cargos", { deleting: true }),
    "No se puede eliminar: hay registros en «Puestos» que dependen de este."
  );
});

test("traduce a HttpError con el código correcto y deja pasar lo que no es de restricción", () => {
  const duplicado = translateConstraintError(uniqueError, "persons");
  assert.equal(duplicado.statusCode, 409, "un duplicado es un conflicto de estado");

  const referenciaMala = translateConstraintError(fkOnWriteError, "unit_positions");
  assert.equal(referenciaMala.statusCode, 400, "referenciar un id inexistente es petición inválida");

  const referenciado = translateConstraintError(fkOnDeleteError, "cargos", { deleting: true });
  assert.equal(referenciado.statusCode, 409);

  // Lo esencial: un error que NO es de restricción devuelve null para que el llamador lo relance
  // tal cual y siga siendo un 500. Tragarse errores desconocidos sería peor que el bug original.
  assert.equal(translateConstraintError(new Error("conexión caída"), "persons"), null);
  assert.equal(translateConstraintError({ code: "42703" }, "persons"), null);
});
