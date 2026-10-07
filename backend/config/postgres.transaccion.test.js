// Tests de `conTransaccion`, la frontera de transacción.
//
// Es la pieza que sustituye 19 copias a mano del patrón getConnection/beginTransaction/commit/
// rollback/release, cuatro de ellas en controllers. Si esto se equivoca, se pierde atomicidad o se
// fuga una conexión del pool en cada petición — y ninguna de las dos cosas la ve un test de HTTP.
//
// No hay base de datos: se sustituye el pool por uno de mentira que apunta el orden de las llamadas.

import test from "node:test";
import assert from "node:assert/strict";
import { conTransaccion } from "./postgres.js";

const poolFalso = ({ falla = null } = {}) => {
  const pasos = [];
  const conexion = {
    beginTransaction: async () => { pasos.push("begin"); },
    commit: async () => { pasos.push("commit"); },
    rollback: async () => { pasos.push("rollback"); },
    release: () => { pasos.push("release"); },
    query: async () => { pasos.push("query"); return [[]]; },
  };
  if (falla === "rollback") conexion.rollback = async () => { pasos.push("rollback-falla"); throw new Error("rollback roto"); };
  return { pasos, getConnection: async () => { pasos.push("getConnection"); return conexion; } };
};

test("el camino feliz: begin, trabajo, commit y SIEMPRE release", async () => {
  const pool = poolFalso();
  const resultado = await conTransaccion(async (c) => { await c.query("SELECT 1"); return 42; }, pool);
  assert.equal(resultado, 42);
  assert.deepEqual(pool.pasos, ["getConnection", "begin", "query", "commit", "release"]);
});

test("si el trabajo lanza: rollback, NO commit, release, y el error se propaga", async () => {
  const pool = poolFalso();
  await assert.rejects(
    () => conTransaccion(async () => { throw new Error("algo falló dentro"); }, pool),
    /algo falló dentro/
  );
  assert.deepEqual(pool.pasos, ["getConnection", "begin", "rollback", "release"]);
  assert.ok(!pool.pasos.includes("commit"), "no debe hacer commit si el trabajo lanzó");
});

// ⚠️ EL CASO QUE LAS COPIAS A MANO HACÍAN MAL. Si el rollback también falla, el error que debe llegar
// al llamador es el ORIGINAL —el que explica qué pasó—, no el del rollback. Y la conexión se suelta
// igual: una fuga aquí agota el pool en producción y no la ve ningún test de HTTP.
test("si el rollback también falla, se propaga el error ORIGINAL y se suelta la conexión", async () => {
  const pool = poolFalso({ falla: "rollback" });
  await assert.rejects(
    () => conTransaccion(async () => { throw new Error("el de verdad"); }, pool),
    /el de verdad/
  );
  assert.deepEqual(pool.pasos, ["getConnection", "begin", "rollback-falla", "release"]);
});

test("sin pool disponible lo dice, y no intenta nada", async () => {
  await assert.rejects(() => conTransaccion(async () => 1, null), /Conexion PostgreSQL no disponible/);
});
