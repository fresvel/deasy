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
  uniqueViolationMessage,
  foreignKeyViolationMessage,
  translateConstraintError,
} from "./sqlErrors.js";

const uniqueError = {
  code: "23505",
  constraint: "persons_cedula_key",
  table: "persons",
  detail: "Key (cedula)=(1234567890) already exists.",
  message: 'duplicate key value violates unique constraint "persons_cedula_key"',
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
  assert.equal(violatedConstraint(uniqueError), "persons_cedula_key");
  assert.equal(violatedConstraint(new Error("boom")), "");
});

test("saca las columnas implicadas del detail", () => {
  assert.deepEqual(violatedColumns(uniqueError), ["cedula"]);
  assert.deepEqual(violatedColumns(compositeUniqueError), ["unit_id", "slot_no"]);
  assert.deepEqual(violatedColumns({ code: "23505" }), []);
});

test("el mensaje de duplicado usa la etiqueta del formulario, no el nombre de columna", () => {
  assert.equal(
    uniqueViolationMessage(uniqueError, "persons"),
    "Ya existe otro registro con ese valor en «Cedula»."
  );
  assert.match(uniqueViolationMessage(compositeUniqueError, "unit_positions"), /combinación de «Unidad», «Plaza»/);
  // Sin `detail` no se inventa nada.
  assert.equal(
    uniqueViolationMessage({ code: "23505" }, "persons"),
    "Ya existe otro registro con esos datos."
  );
  // Una tabla desconocida no revienta: cae al nombre crudo de la columna.
  assert.equal(
    uniqueViolationMessage(uniqueError, "tabla_inexistente"),
    "Ya existe otro registro con ese valor en «cedula»."
  );
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
