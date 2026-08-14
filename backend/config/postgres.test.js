// Red de CARACTERIZACIÓN del escáner de SQL del adaptador mysql2 -> PostgreSQL.
//
// Cubre `bindParams`, que es la que de verdad usa `runQuery` para todo el SQL del
// sistema, y a través de ella el escáner `scanSql` que comparten todas las
// traducciones.
//
// Este fichero cubría también `translatePlaceholders`, retirada por código muerto
// (defecto 1.6). Sus 33 casos NO se perdieron: caracterizan el ESCÁNER, no la función
// borrada, así que se re-apuntaron a `bindParams`. El cambio es seguro porque este
// mismo fichero demostraba que las dos producían EXACTAMENTE el mismo texto con
// parámetros escalares; ese test de invariante desaparece por tautológico.
//
// QUÉ ES ESTE FICHERO: una red, no una especificación. Cada valor esperado se
// capturó ejecutando el código TAL COMO ESTABA antes del refactor de la Fase F.
// Varios casos congelan rarezas que NO son deseables (están marcados con
// «RAREZA CONGELADA»); si algún día se arreglan, el diff de este fichero es la
// prueba del arreglo. Mientras tanto, que un cambio los mueva significa que el
// refactor cambió comportamiento.
//
// El complemento está en `postgres.dialect.test.js`, que cubre la reescritura
// de dialecto (GROUP_CONCAT, FIELD, IF, ON DUPLICATE KEY...).

import test from "node:test";
import assert from "node:assert/strict";

import { bindParams, translateDialect } from "./postgres.js";

// --- El escáner: numeración de `?` -> $1..$n ----------------------------------
//
// Numera los `?` de CÓDIGO como $1..$n, respetando literales, identificadores y
// comentarios. [nombre, entrada, salida esperada]

const PLACEHOLDER_CASES = [
  ["cadena vacía", "", ""],
  ["SQL sin placeholders", "SELECT 1", "SELECT 1"],
  ["numera en orden de aparición", "SELECT * FROM t WHERE a = ? AND b = ?", "SELECT * FROM t WHERE a = $1 AND b = $2"],
  ["pasa de $9 a $10 sin saltos", "SELECT ?,?,?,?,?,?,?,?,?,?", "SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10"],
  ["un `?` suelto es $1", "?", "$1"],
  ["dos `?` pegados", "??", "$1$2"],

  // Literales de cadena: intocables.
  ["no toca un `?` dentro de un literal", "SELECT '¿?' AS q, ? AS p", "SELECT '¿?' AS q, $1 AS p"],
  ["respeta la comilla escapada ''", "SELECT 'it''s a ? test', ?", "SELECT 'it''s a ? test', $1"],
  ["un literal sin cerrar se traga el resto", "SELECT 'abc ? ", "SELECT 'abc ? "],
  ["un literal que acaba en '' sigue abierto", "SELECT 'abc''", "SELECT 'abc''"],
  ["un `--` dentro de un literal no abre comentario", "SELECT '-- ?' , ?", "SELECT '-- ?' , $1"],

  // Identificadores entrecomillados (PG) y con backtick (MySQL).
  ['no toca un `?` dentro de "identificador"', 'SELECT "col?umn", ?', 'SELECT "col?umn", $1'],
  ['respeta la comilla doble escapada ""', 'SELECT "a""?b", ?', 'SELECT "a""?b", $1'],
  ["no toca un `?` dentro de `backticks`", "SELECT `co?l`, ? FROM `t`", "SELECT `co?l`, $1 FROM `t`"],
  ["un backtick sin cerrar se traga el resto", "SELECT `co?l", "SELECT `co?l"],

  // Comentarios.
  ["ignora los `?` de un comentario de línea", "SELECT ? -- ?\n, ?", "SELECT $1 -- ?\n, $2"],
  ["un comentario de línea sin salto llega al final", "SELECT ? -- ?", "SELECT $1 -- ?"],
  ["ignora los `?` de un comentario de bloque", "SELECT ? /* ? */, ?", "SELECT $1 /* ? */, $2"],
  ["un bloque sin cerrar se traga el resto", "SELECT ? /* ? ", "SELECT $1 /* ? "],
  ["un bloque vacío no rompe la numeración", "SELECT ?/**/?", "SELECT $1/**/$2"],
  ["una comilla dentro de un comentario no abre literal", "-- it's ?\nSELECT ?", "-- it's ?\nSELECT $1"],
  ["un guion suelto no es comentario", "SELECT a-?-b", "SELECT a-$1-b"],
  ["una barra suelta no es comentario", "SELECT a/?/b", "SELECT a/$1/b"],
  // RAREZA CONGELADA: `/*/` se toma por un bloque YA CERRADO (la barra de cierre
  // se busca desde el propio `*` de apertura), así que lo que sigue vuelve a ser
  // código. Es SQL degenerado que ninguna consulta del repo escribe.
  ["RAREZA: `/*/` cuenta como bloque cerrado", "SELECT ? /*/ ?", "SELECT $1 /*/ $2"],

  // Sintaxis PostgreSQL que ya viaja en las consultas.
  ["deja pasar los casts ::", "SELECT ?::int, ?::text[]", "SELECT $1::int, $2::text[]"],
  ["LIMIT / OFFSET", "SELECT * FROM t ORDER BY id LIMIT ? OFFSET ?", "SELECT * FROM t ORDER BY id LIMIT $1 OFFSET $2"],
  ["operador JSON ->> con literal", "SELECT data->>'k' FROM t WHERE id = ?", "SELECT data->>'k' FROM t WHERE id = $1"],
  ["igualdad NULL-safe <=>", "WHERE term_id <=> ?", "WHERE term_id <=> $1"],

  // Formas reales del repositorio.
  ["IN con varios placeholders", "SELECT * FROM t WHERE id IN (?, ?, ?)", "SELECT * FROM t WHERE id IN ($1, $2, $3)"],
  [
    "consulta multilínea real (RbacService)",
    "SELECT DISTINCT p.code\n       FROM role_permissions rp\n       WHERE rp.role_id IN (?)\n         AND p.is_active = 1",
    "SELECT DISTINCT p.code\n       FROM role_permissions rp\n       WHERE rp.role_id IN ($1)\n         AND p.is_active = 1",
  ],
  [
    "ON DUPLICATE KEY UPDATE (aquí solo se numera)",
    "INSERT INTO t (a,b) VALUES (?,?) ON DUPLICATE KEY UPDATE b = VALUES(b)",
    "INSERT INTO t (a,b) VALUES ($1,$2) ON DUPLICATE KEY UPDATE b = VALUES(b)",
  ],
  [
    "INSERT IGNORE con backticks",
    "INSERT IGNORE INTO `t` (`a`) VALUES (?)",
    "INSERT IGNORE INTO `t` (`a`) VALUES ($1)",
  ],
];

// Cada caso se alimenta con EXACTAMENTE los parámetros que consume, y ese número se deriva del
// texto esperado contando sus `$n`. Aquí todos los parámetros son escalares, así que un `?` de
// código emite exactamente un `$n` y la cuenta es exacta.
//
// Antes esto se alimentaba con un array de 32 escalares —`SOBRAN_ESCALARES`— apoyándose en que
// `bindParams` toleraba los parámetros de sobra. Esa tolerancia murió con el defecto 1.11
// (2026-08-14), y el bucle habría fallado 32 veces. Derivar la cuenta, además de arreglarlo, es
// mejor test que antes: **el número de placeholders pasa a formar parte de lo que el caso fija**,
// en vez de quedar tapado por un array de sobra.
const consumidos = (expected) => (expected.match(/\$\d+/g) || []).length;

for (const [name, input, expected] of PLACEHOLDER_CASES) {
  test(`escáner: ${name}`, () => {
    const justos = new Array(consumidos(expected)).fill(0).map((_, k) => k);
    assert.equal(bindParams(input, justos).text, expected);
  });
}

// --- bindParams ---------------------------------------------------------------
//
// Mismo escaneo que arriba, pero consumiendo parámetros y expandiendo arrays
// como hace mysql2. [nombre, sql, params, texto esperado, valores esperados]

const BIND_CASES = [
  ["escalares en orden", "SELECT * FROM t WHERE a = ? AND b = ?", [1, 2], "SELECT * FROM t WHERE a = $1 AND b = $2", [1, 2]],
  ["expande un array en IN (?)", "SELECT * FROM t WHERE id IN (?)", [[10, 20, 30]], "SELECT * FROM t WHERE id IN ($1, $2, $3)", [10, 20, 30]],
  ["un array de un elemento no lleva comas", "WHERE id IN (?)", [[5]], "WHERE id IN ($1)", [5]],
  ["array vacío -> NULL sin consumir parámetros", "SELECT * FROM t WHERE id IN (?)", [[]], "SELECT * FROM t WHERE id IN (NULL)", []],
  ["dos arrays numeran de corrido", "WHERE a IN (?) AND b IN (?)", [[1, 2], [3]], "WHERE a IN ($1, $2) AND b IN ($3)", [1, 2, 3]],
  ["array y escalar mezclados", "WHERE a = ? AND b IN (?)", [9, [1, 2]], "WHERE a = $1 AND b IN ($2, $3)", [9, 1, 2]],
  ["bulk insert con array de arrays", "INSERT INTO t (a,b) VALUES ?", [[[1, 2], [3, 4]]], "INSERT INTO t (a,b) VALUES ($1, $2), ($3, $4)", [1, 2, 3, 4]],
  ["bulk insert con filas de distinta longitud", "INSERT INTO t VALUES ?", [[[1, 2], [3]]], "INSERT INTO t VALUES ($1, $2), ($3)", [1, 2, 3]],

  // Valores límite.
  ["null y undefined viajan tal cual", "SELECT ?, ?", [null, undefined], "SELECT $1, $2", [null, undefined]],
  ["los falsy no se confunden con vacío", "SELECT ?, ?, ?", [0, "", false], "SELECT $1, $2, $3", [0, "", false]],
  ["sin argumento de parámetros y sin `?`", "SELECT 1", undefined, "SELECT 1", []],

  // Protección de literales, identificadores y comentarios (mismo escáner).
  ["no toca un `?` de un literal", "SELECT '¿?' AS q, ? AS p", ["x"], "SELECT '¿?' AS q, $1 AS p", ["x"]],
  ["respeta la comilla escapada ''", "SELECT 'it''s a ? test', ?", [7], "SELECT 'it''s a ? test', $1", [7]],
  ["no consume parámetros en un comentario de línea", "SELECT ? -- ?\n, ?", [1, 2], "SELECT $1 -- ?\n, $2", [1, 2]],
  ["no consume parámetros en un comentario de bloque", "SELECT ? /* ? */, ?", [1, 2], "SELECT $1 /* ? */, $2", [1, 2]],
  ["no toca un `?` entre backticks", "SELECT `co?l`, ?", ["v"], "SELECT `co?l`, $1", ["v"]],
  ['no toca un `?` entre comillas dobles', 'SELECT "c?ol", ?', ["v"], 'SELECT "c?ol", $1', ["v"]],
  ["LIMIT / OFFSET", "SELECT * FROM t LIMIT ? OFFSET ?", [10, 20], "SELECT * FROM t LIMIT $1 OFFSET $2", [10, 20]],
  ["cast :: pegado al placeholder", "SELECT ?::int", [3], "SELECT $1::int", [3]],
];

for (const [name, sql, params, expectedText, expectedValues] of BIND_CASES) {
  test(`bindParams: ${name}`, () => {
    const { text, values } = params === undefined ? bindParams(sql) : bindParams(sql, params);
    assert.equal(text, expectedText);
    assert.deepEqual(values, expectedValues);
  });
}

// --- Rarezas congeladas de bindParams -----------------------------------------
//
// Producen SQL inválido o parámetros silenciosamente incorrectos. Ninguna
// consulta del repositorio las provoca hoy; se fijan para que el refactor no
// las mueva sin querer y para dejar constancia de que EXISTEN.

// --- Faltan parámetros: ahora FALLA (defecto 1.5, arreglado) -------------------
//
// Antes esto era una "RAREZA" congelada: pg convierte `undefined` en NULL, así que
// una llamada con menos parámetros de la cuenta NO explotaba, ejecutaba con NULLs y
// devolvía resultados equivocados sin decir nada. Ahora lanza.
//
// Se comprobó antes de cambiarlo que ningún call site vivo dependía del comportamiento
// anterior. Aquel barrido decía «429 llamadas dan 0 desajustes» y **se tiró sin dejar código**,
// así que hubo que rehacerlo entero para el defecto 1.11. Ahora vive en
// `scripts/audit_bindparams.mjs` (`npm run check:params`) y se puede volver a correr.

test("faltan parámetros: lanza en vez de mandar `undefined` (que pg convertiría en NULL)", () => {
  assert.throws(
    () => bindParams("SELECT ?, ?, ?", [1]),
    (err) => {
      assert.match(err.message, /3 placeholders/, "dice cuántos placeholders esperaba");
      assert.match(err.message, /1 parametros/, "dice cuántos parámetros recibió");
      assert.match(err.message, /Faltan 2/, "dice cuántos faltan");
      // El SQL NO viaja en el mensaje: varios controllers responden `error.message`.
      assert.ok(!err.message.includes("SELECT"), "el mensaje no filtra el SQL");
      return true;
    },
  );
});

test("falta UN solo parámetro: también lanza", () => {
  assert.throws(() => bindParams("SELECT * FROM t WHERE a = ? AND b = ?", [1]), /2 placeholders/);
});

test("sin argumento de parámetros pero con `?`: lanza", () => {
  assert.throws(() => bindParams("SELECT ?"), /1 placeholders .* 0 parametros/s);
});

test("un `params` que no es array cuenta como cero parámetros y lanza", () => {
  // `query(sql, 7)` es un error de llamada frecuente: antes daba `7[0] === undefined` -> NULL.
  assert.throws(() => bindParams("SELECT ?", 7), /0 parametros/);
});

test("justo los necesarios NO lanza (no hay error por un off-by-one)", () => {
  const { text, values } = bindParams("SELECT ?, ?", [1, 2]);
  assert.equal(text, "SELECT $1, $2");
  assert.deepEqual(values, [1, 2]);
});

test("los `?` de literales y comentarios no cuentan para el chequeo", () => {
  // Un `?` protegido no consume parámetro, así que tampoco puede exigir uno: si contara,
  // esta consulta perfectamente válida empezaría a fallar.
  const { text, values } = bindParams("SELECT '¿?' AS q, ? -- ?\n", ["x"]);
  assert.equal(text, "SELECT '¿?' AS q, $1 -- ?\n");
  assert.deepEqual(values, ["x"]);
});

test("un array vacío satisface su placeholder (IN (?) -> IN (NULL)) y no lanza", () => {
  // `[]` consume el parámetro aunque no empuje ningún valor: NO es un placeholder huérfano.
  const { text, values } = bindParams("SELECT * FROM t WHERE id IN (?)", [[]]);
  assert.equal(text, "SELECT * FROM t WHERE id IN (NULL)");
  assert.deepEqual(values, []);
});

// --- Sobran parámetros: ahora TAMBIÉN falla (defecto 1.11, arreglado el 2026-08-14) -----------
//
// Este test decía lo contrario —"sobrar parámetros se sigue tolerando (mysql2 hacía lo mismo)"— y
// su inversión ES la prueba del arreglo. La tolerancia se justificaba diciendo que había call
// sites que reutilizaban un array más largo que su consulta; se midió y NO EXISTÍA NINGUNO:
// 484 de 484 llamadas equilibradas (423 por escáner estático, 61 leídas una a una, y una sonda
// sobre los 240 flujos de caracterización que no registró un solo caso).
//
// El gate que lo vigila desde fuera es `npm run check:params`, pero solo alcanza a las 423
// decidibles sin ejecutar: este guard es el que cubre las 484.

test("sobran parámetros: lanza en vez de ignorarlos en silencio", () => {
  assert.throws(
    () => bindParams("SELECT ?", [1, 2, 3]),
    /1 placeholders.*3 parametros.*Sobran 2/s
  );
});

test("el mensaje de `sobran` avisa del tramo sin cerrar, que es la causa no obvia", () => {
  // Un comentario sin cerrar se traga el resto del SQL, así que sus `?` no cuentan y el
  // desajuste NO lo produce quien llamó. Sin esta pista, el mensaje culpa al call site.
  assert.throws(() => bindParams("SELECT ? /* ? , ?", [1, 2]), /SIN CERRAR/);
});

test("ni el mensaje de `faltan` ni el de `sobran` incluyen el SQL", () => {
  // Varios controllers responden `error.message` al cliente: llevar el SQL filtraría el esquema.
  const sql = "SELECT * FROM tabla_secreta WHERE columna_secreta = ?";
  assert.throws(() => bindParams(sql, []), (e) => !e.message.includes("tabla_secreta"));
  assert.throws(() => bindParams("SELECT 1", [1]), (e) => !e.message.includes("SELECT"));
});

test("un `undefined` EXPLÍCITO en la lista sigue pasando: se pidió NULL a propósito", () => {
  // La diferencia es intención: `[undefined]` es un NULL pedido; un hueco no lo es.
  const { text, values } = bindParams("SELECT ?, ?", [null, undefined]);
  assert.equal(text, "SELECT $1, $2");
  assert.deepEqual(values, [null, undefined]);
});

test("RAREZA: un bloque sin cerrar deja `?` literales en el texto final", () => {
  // El `?` que queda dentro del comentario no se numera: el SQL sale con un `?` crudo que
  // PostgreSQL no entiende. Con los parámetros JUSTOS sigue saliendo así — la rareza es del
  // escáner y no la arregla el guard.
  //
  // Antes este caso pasaba `[1, 2]`, y desde el defecto 1.11 eso lanza. No es una regresión: con
  // dos parámetros el SQL ya salía inválido, así que se cambia un error confuso de PostgreSQL por
  // uno localizado que además nombra la causa. Por eso el mensaje de `sobran` habla del tramo sin
  // cerrar.
  const { text, values } = bindParams("SELECT ? /* ? , ?", [1]);
  assert.equal(text, "SELECT $1 /* ? , ?");
  assert.deepEqual(values, [1]);
});

test("RAREZA: una fila vacía en un bulk insert produce `()`", () => {
  const { text, values } = bindParams("INSERT INTO t VALUES ?", [[[], [1]]]);
  assert.equal(text, "INSERT INTO t VALUES (), ($1)");
  assert.deepEqual(values, [1]);
});

test("RAREZA: un array de una sola fila vacía deja `VALUES ()`", () => {
  const { text, values } = bindParams("INSERT INTO t VALUES ?", [[[]]]);
  assert.equal(text, "INSERT INTO t VALUES ()");
  assert.deepEqual(values, []);
});

test("RAREZA: solo se mira si el PRIMER elemento es array", () => {
  // [1, [2, 3]] no se ve como bulk (el primero no es array), así que el array
  // anidado se empuja como si fuera un valor escalar.
  const { text, values } = bindParams("SELECT ?", [[1, [2, 3]]]);
  assert.equal(text, "SELECT $1, $2");
  assert.deepEqual(values, [1, [2, 3]]);
});

// El test de invariante «translatePlaceholders y bindParams producen el mismo texto con
// escalares» vivía aquí. Al retirar `translatePlaceholders` se vuelve tautológico (compararía
// `bindParams` consigo misma), así que se elimina — pero es él quien justifica que los 33 casos
// de arriba se hayan podido re-apuntar a `bindParams` sin perder cobertura: demostraba que las
// dos coincidían EXACTAMENTE en las 33 entradas.

// --- La tubería real: translateDialect y luego bindParams ---------------------

test("tubería completa: backticks traducidos y placeholders enlazados", () => {
  const { text, values } = bindParams(
    translateDialect("SELECT `name` FROM `users` WHERE `id` = ? AND status <=> ?"),
    [7, null],
  );
  assert.equal(text, 'SELECT "name" FROM "users" WHERE "id" = $1 AND status IS NOT DISTINCT FROM $2');
  assert.deepEqual(values, [7, null]);
});

test("tubería completa: el `?` de un literal sobrevive al enmascarado", () => {
  const { text, values } = bindParams(translateDialect("SELECT '¿todo bien? ' AS s, IFNULL(a, ?)"), [1]);
  assert.equal(text, "SELECT '¿todo bien? ' AS s, COALESCE(a, $1)");
  assert.deepEqual(values, [1]);
});
