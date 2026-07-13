// Tests unitarios de la capa de traducción mysql2 -> PostgreSQL.
//
// Esta capa reescribe TODO el SQL del sistema (~881 call sites escritos en estilo
// mysql2). Un fallo aquí no da error: desplaza parámetros o cambia el orden de un
// ORDER BY, y los datos se corrompen en silencio. Dos bugs reales ya se colaron
// hasta producción por no tener estos tests:
//
//   - `FROM DUAL` sin traducir rompía el bootstrap del sistema.
//   - `FIELD()` sin traducir rompía el grafo de procesos, el detalle de proceso y
//     los procesos de una unidad ("function field(text, unknown...) does not exist").
//   - `<=>` (igualdad NULL-safe) sin traducir rompía el LANZAMIENTO de procesos
//     ("operator does not exist: integer <=> unknown").
//
// Los tres casos están fijados abajo como regresión.

import test from "node:test";
import assert from "node:assert/strict";

import {
  bindParams,
  translateDialect,
  rewriteField,
  rewriteGroupConcat,
  rewriteIf,
  applyOnConflict,
} from "./postgres.js";

// --- bindParams: ? -> $n y expansión de arrays -------------------------------

test("bindParams numera los placeholders en orden", () => {
  const { text, values } = bindParams("SELECT * FROM t WHERE a = ? AND b = ?", [1, 2]);
  assert.equal(text, "SELECT * FROM t WHERE a = $1 AND b = $2");
  assert.deepEqual(values, [1, 2]);
});

test("bindParams expande un array en IN (?)", () => {
  const { text, values } = bindParams("SELECT * FROM t WHERE id IN (?)", [[10, 20, 30]]);
  assert.equal(text, "SELECT * FROM t WHERE id IN ($1, $2, $3)");
  assert.deepEqual(values, [10, 20, 30]);
});

test("bindParams convierte IN (?) con array vacío en IN (NULL), sin parámetros", () => {
  // Sin esto, un filtro vacío produciría SQL inválido en vez de "no coincide nada".
  const { text, values } = bindParams("SELECT * FROM t WHERE id IN (?)", [[]]);
  assert.equal(text, "SELECT * FROM t WHERE id IN (NULL)");
  assert.deepEqual(values, []);
});

test("bindParams expande VALUES ? para inserción masiva", () => {
  const { text, values } = bindParams("INSERT INTO t (a,b) VALUES ?", [[[1, 2], [3, 4]]]);
  assert.equal(text, "INSERT INTO t (a,b) VALUES ($1, $2), ($3, $4)");
  assert.deepEqual(values, [1, 2, 3, 4]);
});

test("bindParams no toca los ? dentro de literales de cadena", () => {
  const { text, values } = bindParams("SELECT '¿?' AS q, ? AS p", ["x"]);
  assert.equal(text, "SELECT '¿?' AS q, $1 AS p");
  assert.deepEqual(values, ["x"]);
});

test("bindParams respeta la comilla escapada '' dentro de un literal", () => {
  const { text, values } = bindParams("SELECT 'it''s a ? test', ?", [7]);
  assert.equal(text, "SELECT 'it''s a ? test', $1");
  assert.deepEqual(values, [7]);
});

test("bindParams no consume parámetros por los ? de un comentario de línea", () => {
  const { text, values } = bindParams("SELECT ? -- ?\n, ?", [1, 2]);
  assert.equal(text, "SELECT $1 -- ?\n, $2");
  assert.deepEqual(values, [1, 2]);
});

// --- translateDialect: reescrituras de dialecto ------------------------------

test("translateDialect convierte IFNULL en COALESCE", () => {
  assert.equal(translateDialect("SELECT IFNULL(a, 0)"), "SELECT COALESCE(a, 0)");
});

test("translateDialect no reescribe dentro de literales de cadena", () => {
  // El enmascarado de strings es lo que impide corromper datos de usuario.
  assert.equal(translateDialect("SELECT 'IFNULL(x)' AS s"), "SELECT 'IFNULL(x)' AS s");
});

test("translateDialect convierte identificadores con backtick en comillas dobles", () => {
  assert.equal(translateDialect("SELECT `user`.`name`"), 'SELECT "user"."name"');
});

test("translateDialect convierte INSERT IGNORE en ON CONFLICT DO NOTHING", () => {
  assert.equal(
    translateDialect("INSERT IGNORE INTO t (a) VALUES (?)"),
    "INSERT INTO t (a) VALUES (?) ON CONFLICT DO NOTHING",
  );
});

test("translateDialect traduce CURDATE y UNIX_TIMESTAMP", () => {
  assert.equal(translateDialect("SELECT CURDATE()"), "SELECT CURRENT_DATE");
  assert.equal(
    translateDialect("SELECT UNIX_TIMESTAMP()"),
    "SELECT EXTRACT(EPOCH FROM now())::bigint",
  );
});

test("translateDialect traduce SET FOREIGN_KEY_CHECKS", () => {
  assert.equal(translateDialect("SET FOREIGN_KEY_CHECKS = 0"), "SET session_replication_role = replica");
  assert.equal(translateDialect("SET FOREIGN_KEY_CHECKS = 1"), "SET session_replication_role = origin");
});

// Regresión: `<=>` (igualdad NULL-safe de MySQL) sin traducir rompía el LANZAMIENTO de
// procesos por completo: "operator does not exist: integer <=> unknown".
// El equivalente en PostgreSQL es IS NOT DISTINCT FROM. Aparecía en TaskGenerationService
// como `term_id <=> ?` (term_id es nullable, por eso la comparación null-safe).
test("translateDialect traduce <=> a IS NOT DISTINCT FROM (regresión del lanzamiento)", () => {
  assert.equal(
    translateDialect("SELECT 1 FROM process_runs WHERE process_definition_id = ? AND term_id <=> ?"),
    "SELECT 1 FROM process_runs WHERE process_definition_id = ? AND term_id IS NOT DISTINCT FROM ?"
  );
});

test("translateDialect normaliza el espaciado alrededor de <=>", () => {
  assert.equal(translateDialect("WHERE a<=>b"), "WHERE a IS NOT DISTINCT FROM b");
  assert.equal(translateDialect("WHERE a   <=>   b"), "WHERE a IS NOT DISTINCT FROM b");
});

test("translateDialect NO toca un <=> dentro de un literal", () => {
  const sql = "SELECT 'a <=> b' AS texto WHERE x <=> ?";
  assert.equal(translateDialect(sql), "SELECT 'a <=> b' AS texto WHERE x IS NOT DISTINCT FROM ?");
});

// Regresión: `FROM DUAL` rompía el bootstrap ("relation \"dual\" does not exist").
test("translateDialect elimina FROM DUAL (regresión del bootstrap)", () => {
  const sql = "INSERT INTO t (a) SELECT ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t)";
  assert.equal(translateDialect(sql), "INSERT INTO t (a) SELECT ?  WHERE NOT EXISTS (SELECT 1 FROM t)");
});

test("translateDialect no confunde FROM DUAL con una tabla que empieza por dual", () => {
  const sql = "SELECT * FROM dual_registry WHERE x = 1";
  assert.equal(translateDialect(sql), sql);
});

// --- rewriteField: FIELD() de MySQL ------------------------------------------
// Regresión: sin esto, processes/graph, processes/:id/detail y units/:id/processes
// devolvían 400 "function field(text, unknown, unknown, unknown) does not exist".

test("rewriteField traduce FIELD() a un CASE con las mismas posiciones", () => {
  assert.equal(
    rewriteField("ORDER BY FIELD(s, 'a', 'b', 'c')"),
    "ORDER BY (CASE s WHEN 'a' THEN 1 WHEN 'b' THEN 2 WHEN 'c' THEN 3 ELSE 0 END)",
  );
});

test("rewriteField devuelve 0 para los valores no listados, como MySQL", () => {
  // El 0 preserva el orden de NULL/desconocidos respecto a MySQL.
  assert.match(rewriteField("FIELD(s, 'a')"), /ELSE 0 END/);
});

test("rewriteField respeta las comas dentro de paréntesis anidados", () => {
  assert.equal(
    rewriteField("SELECT FIELD(COALESCE(t.s, 'x'), 'a', 'b') AS ord"),
    "SELECT (CASE COALESCE(t.s, 'x') WHEN 'a' THEN 1 WHEN 'b' THEN 2 ELSE 0 END) AS ord",
  );
});

test("rewriteField no toca identificadores que contienen 'field'", () => {
  const sql = "SELECT field_name FROM fields WHERE field_name = 1";
  assert.equal(rewriteField(sql), sql);
});

test("rewriteField deja intacto un FIELD() con un solo argumento", () => {
  // Sin lista de valores no hay traducción posible; se deja pasar (fallará en PG,
  // que es preferible a inventar semántica).
  assert.equal(rewriteField("SELECT FIELD(x)"), "SELECT FIELD(x)");
});

// --- rewriteGroupConcat -------------------------------------------------------
//
// OJO con el contrato: los sub-reescritores (rewriteGroupConcat, rewriteField,
// rewriteIf) esperan código ya ENMASCARADO por translateDialect, donde los
// literales de cadena se han sustituido por marcas `@@@n@@@` sin espacios ni
// comas. Llamarlos directamente con SQL crudo que contenga literales da resultados
// incorrectos: `GROUP_CONCAT(x SEPARATOR '; ')` se parsea mal porque el regex del
// separador es `\S+` y el literal tiene un espacio dentro.
//
// Por eso todo lo que involucre literales se prueba a través de `translateDialect`,
// que es el único punto de entrada real.

test("translateDialect traduce GROUP_CONCAT a string_agg con separador por defecto", () => {
  assert.equal(translateDialect("SELECT GROUP_CONCAT(name)"), "SELECT string_agg((name)::text, ',')");
});

test("translateDialect con DISTINCT ordena por la propia expresión", () => {
  // PostgreSQL exige que el ORDER BY de un string_agg(DISTINCT x) sea x.
  assert.equal(
    translateDialect("SELECT GROUP_CONCAT(DISTINCT x)"),
    "SELECT string_agg(DISTINCT (x)::text, ',' ORDER BY (x)::text)",
  );
});

test("translateDialect respeta un SEPARATOR con espacios", () => {
  assert.equal(
    translateDialect("SELECT GROUP_CONCAT(x SEPARATOR '; ')"),
    "SELECT string_agg((x)::text, '; ')",
  );
});

test("translateDialect respeta el ORDER BY de GROUP_CONCAT", () => {
  assert.equal(
    translateDialect("SELECT GROUP_CONCAT(x ORDER BY y)"),
    "SELECT string_agg((x)::text, ',' ORDER BY y)",
  );
});

test("rewriteGroupConcat equilibra paréntesis anidados", () => {
  assert.equal(
    rewriteGroupConcat("SELECT GROUP_CONCAT(CONCAT(a, b))"),
    "SELECT string_agg((CONCAT(a, b))::text, ',')",
  );
});

// --- El enmascarado protege las comas y comillas dentro de literales ----------

test("translateDialect no parte los argumentos de FIELD por una coma dentro de un literal", () => {
  assert.equal(
    translateDialect("ORDER BY FIELD(s, 'a,b', 'c')"),
    "ORDER BY (CASE s WHEN 'a,b' THEN 1 WHEN 'c' THEN 2 ELSE 0 END)",
  );
});

// --- rewriteIf ----------------------------------------------------------------

test("rewriteIf traduce IF(cond, a, b) a CASE WHEN", () => {
  assert.equal(rewriteIf("SELECT IF(a > 1, 'x', 'y')"), "SELECT CASE WHEN a > 1 THEN 'x' ELSE 'y' END");
});

test("rewriteIf traduce IF anidados", () => {
  assert.equal(
    rewriteIf("SELECT IF(a, IF(b, 1, 2), 3)"),
    "SELECT CASE WHEN a THEN CASE WHEN b THEN 1 ELSE 2 END ELSE 3 END",
  );
});

// --- applyOnConflict: ON DUPLICATE KEY UPDATE -> ON CONFLICT ------------------
//
// La parte pura de la traducción de UPSERT. Elegir mal el target de conflicto haría
// que el UPSERT inserte duplicados o pise la fila equivocada, sin error SQL. Se prueba
// con los índices ya resueltos (la consulta a pg_index vive aparte, en la orquestadora).

const rolesUpsert =
  "INSERT INTO roles (name, description, is_active) VALUES ($1, $2, 1) " +
  "ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1";

test("applyOnConflict infiere el target del único índice cubierto por el INSERT", () => {
  // roles: PK (id) + UNIQUE (name). El INSERT no trae id, así que el target es (name).
  const out = applyOnConflict(rolesUpsert, { uniqueIndexes: [["id"], ["name"]] });
  assert.match(out, /ON CONFLICT \(name\) DO UPDATE SET/);
  assert.match(out, /description = EXCLUDED\.description/);
  assert.match(out, /is_active = 1/);
  assert.doesNotMatch(out, /ON DUPLICATE/);
});

test("applyOnConflict traduce VALUES(col) a EXCLUDED.col, con o sin backticks", () => {
  const sql =
    "INSERT INTO t (a, b) VALUES ($1, $2) ON DUPLICATE KEY UPDATE a = VALUES(a), b = VALUES(`b`)";
  const out = applyOnConflict(sql, { uniqueIndexes: [["a"]] });
  assert.match(out, /a = EXCLUDED\.a/);
  assert.match(out, /b = EXCLUDED\.b/);
});

test("applyOnConflict elimina el idiom id = LAST_INSERT_ID(id)", () => {
  const sql =
    "INSERT INTO t (a) VALUES ($1) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), a = VALUES(a)";
  const out = applyOnConflict(sql, { uniqueIndexes: [["a"]] });
  assert.match(out, /DO UPDATE SET a = EXCLUDED\.a/);
  assert.doesNotMatch(out, /LAST_INSERT_ID/);
  assert.doesNotMatch(out, /DO UPDATE SET ,/, "no debe quedar una coma huérfana");
});

test("applyOnConflict prefiere el índice más corto que no sea solo (id)", () => {
  // Con un único sobre (id) y otro sobre (email), gana (email): (id) solo se usa como
  // último recurso, porque en un UPSERT por id no hay conflicto que resolver.
  const sql = "INSERT INTO users (id, email, name) VALUES ($1, $2, $3) ON DUPLICATE KEY UPDATE name = VALUES(name)";
  const out = applyOnConflict(sql, { uniqueIndexes: [["id"], ["email"]] });
  assert.match(out, /ON CONFLICT \(email\)/);
});

test("applyOnConflict admite un target con columnas GENERADAS ausentes del INSERT", () => {
  // uq_position_current = (position_id, current_flag) donde current_flag es GENERADA.
  // El INSERT no la trae, pero es un target válido porque PG la computa.
  const sql =
    "INSERT INTO unit_position_assignments (position_id, person_id) VALUES ($1, $2) " +
    "ON DUPLICATE KEY UPDATE person_id = VALUES(person_id)";
  const out = applyOnConflict(sql, {
    uniqueIndexes: [["position_id", "current_flag"]],
    generatedCols: new Set(["current_flag"]),
  });
  assert.match(out, /ON CONFLICT \(position_id, current_flag\)/);
});

test("applyOnConflict deja el SQL intacto si ningún índice está cubierto", () => {
  const sql = "INSERT INTO t (a) VALUES ($1) ON DUPLICATE KEY UPDATE a = VALUES(a)";
  // El único índice pide una columna que el INSERT no trae y que no es generada.
  const out = applyOnConflict(sql, { uniqueIndexes: [["b"]] });
  assert.equal(out, sql, "sin target seguro, no se reescribe");
});

test("applyOnConflict deja pasar un SQL que no es un INSERT con columnas", () => {
  assert.equal(applyOnConflict("UPDATE t SET a = 1", {}), "UPDATE t SET a = 1");
});
