#!/usr/bin/env node
// Detector de "alias de SQL usado sin declarar".
//
// POR QUÉ EXISTE. El SQL de este backend vive dentro de plantillas de JavaScript, así que **nadie
// lo mira hasta que se ejecuta esa rama**: `node --check` sólo ve una cadena, `check:imports` no
// entra, y el backend arranca igual. Un `ti.id` cuya tabla ya no se une es sintaxis perfecta para
// todo el mundo menos para PostgreSQL, que responde `missing FROM-clause entry for table "ti"`
// **en tiempo de llamada**.
//
// Coste medido (2026-08-23, retirada de la tabla `documents`): un reemplazo global de una línea de
// `JOIN` se llevó por delante TRES joins legítimos a `task_items` en consultas que no tenían nada
// que ver con el cambio. Tres endpoints distintos en 500, y el diff era de 91 sitios: leerlo no
// servía. Esto los encontró los tres de golpe.
//
// QUÉ MIRA Y QUÉ NO. Sólo revisa plantillas que son una SENTENCIA COMPLETA —empiezan por SELECT,
// WITH, INSERT, UPDATE o DELETE—. Los FRAGMENTOS (`EXISTS (...)`, `AND ...`) se saltan a propósito:
// este repo los compone para embeberlos en otra consulta, así que sus alias los declara quien los
// embebe. Es el caso de `DeliverableAccessService`, por diseño.
//
// Es hermano de `check_sql_comment_backticks.mjs` y del mismo tipo de fallo: algo que ni el linter
// ni los tests ven, y que sale caro cada vez.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(AQUI, "..");
const IGNORAR = new Set(["node_modules", "coverage", ".git", "public", "templates"]);

// Pseudo-tablas y esquemas que se cualifican sin declararse en ningún FROM.
const CALIFICADORES_LIBRES = new Set([
  "excluded", "new", "old",                       // upsert y triggers
  "information_schema", "pg_catalog", "public",   // esquemas
]);

// Palabras que pueden seguir a `FROM tabla` sin ser un alias.
const NO_SON_ALIAS = new Set([
  "on", "where", "set", "values", "using", "group", "order", "having", "limit", "offset",
  "left", "right", "inner", "outer", "full", "cross", "join", "lateral", "as", "and", "or",
  "union", "intersect", "except", "returning", "for", "window", "fetch", "into", "select",
]);

const listar = (dir) => {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...listar(ruta));
    else if (/\.(js|mjs)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
};

// Quita las interpolaciones `${...}` respetando llaves anidadas. Se sustituyen por un espacio: lo
// que hay dentro es JavaScript, y sus puntos (`row.id`) no son alias de SQL.
const sinInterpolaciones = (texto) => {
  let salida = "";
  for (let i = 0; i < texto.length; i += 1) {
    if (texto[i] === "$" && texto[i + 1] === "{") {
      let profundidad = 1;
      i += 2;
      while (i < texto.length && profundidad > 0) {
        if (texto[i] === "{") profundidad += 1;
        else if (texto[i] === "}") profundidad -= 1;
        i += 1;
      }
      i -= 1;
      salida += " ";
    } else {
      salida += texto[i];
    }
  }
  return salida;
};

const limpiar = (sql) =>
  sinInterpolaciones(sql)
    .replace(/--[^\n]*/g, " ")        // comentarios de línea
    .replace(/\/\*[\s\S]*?\*\//g, " ") // comentarios de bloque
    .replace(/'(?:[^']|'')*'/g, " ");  // literales de texto

// Extrae las plantillas de JavaScript que son una sentencia SQL completa.
const plantillasSql = (fuente) => {
  const salida = [];
  const re = /`/g;
  let m;
  while ((m = re.exec(fuente))) {
    if (m.index > 0 && fuente[m.index - 1] === "\\") continue;
    const cierre = fuente.indexOf("`", m.index + 1);
    if (cierre === -1) break;
    const cuerpo = fuente.slice(m.index + 1, cierre);
    re.lastIndex = cierre + 1;
    if (/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE)\b/i.test(cuerpo)) {
      salida.push({ cuerpo, linea: fuente.slice(0, m.index).split("\n").length });
    }
  }
  return salida;
};

const declarados = (sql) => {
  const nombres = new Set();
  // `FROM tabla alias`, `JOIN tabla AS alias`, `UPDATE tabla alias`, `INSERT INTO tabla`
  for (const m of sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_][\w]*)(?:\s+(?:AS\s+)?([a-z_][\w]*))?/gi)) {
    nombres.add(m[1].toLowerCase());
    if (m[2] && !NO_SON_ALIAS.has(m[2].toLowerCase())) nombres.add(m[2].toLowerCase());
  }
  // alias de subconsulta: `) alias` o `) AS alias`
  for (const m of sql.matchAll(/\)\s*(?:AS\s+)?([a-z_][\w]*)/gi)) {
    if (!NO_SON_ALIAS.has(m[1].toLowerCase())) nombres.add(m[1].toLowerCase());
  }
  // CTEs: `WITH x AS (` y `, y AS (`
  for (const m of sql.matchAll(/(?:\bWITH\b|,)\s*([a-z_][\w]*)\s+AS\s*\(/gi)) {
    nombres.add(m[1].toLowerCase());
  }
  return nombres;
};

const usados = (sql) => {
  const nombres = new Map();
  for (const m of sql.matchAll(/\b([a-z_][\w]*)\.([a-z_][\w]*)/gi)) {
    const alias = m[1].toLowerCase();
    if (CALIFICADORES_LIBRES.has(alias)) continue;
    if (!nombres.has(alias)) nombres.set(alias, m[0]);
  }
  return nombres;
};

const hallazgos = [];
const ficheros = listar(BACKEND_ROOT);
let consultas = 0;

for (const fichero of ficheros) {
  const fuente = fs.readFileSync(fichero, "utf8");
  for (const { cuerpo, linea } of plantillasSql(fuente)) {
    consultas += 1;
    const sql = limpiar(cuerpo);
    // ⚠️ LAS DECLARACIONES SE LEEN DEL TEXTO ENTERO; LOS USOS, SÓLO HASTA EL PRIMER HUECO. Es la
    // única concesión de este comprobador, y tiene su motivo.
    //
    // Este repo COMPONE consultas: `WITH ... ${query} AND up.unit_id ...` mete por el hueco un
    // fragmento que trae su propio `FROM`, así que un alias usado DESPUÉS del hueco puede estar
    // declarado en algo que aquí no se ve. Reportarlo sería ruido, y un comprobador con ruido se
    // ignora — que es la peor manera de tener uno.
    //
    // Lo de antes del hueco sí se revisa entero, y ahí es donde vive el defecto que esto caza: el
    // alias roto estaba siempre en la lista del SELECT o en un JOIN, y los `${placeholders}` de
    // este repo van al final, en el WHERE. Los TRES casos reales del 2026-08-23 caen dentro.
    const declara = declarados(sql);
    const corte = cuerpo.indexOf("${");
    const zonaRevisada = corte === -1 ? sql : limpiar(cuerpo.slice(0, corte));
    for (const [alias, muestra] of usados(zonaRevisada)) {
      if (!declara.has(alias)) {
        hallazgos.push({
          file: path.relative(BACKEND_ROOT, fichero),
          line: linea,
          alias,
          muestra,
        });
      }
    }
  }
}

if (!hallazgos.length) {
  console.log(
    `check:sql-aliases OK — ${consultas} consultas en ${ficheros.length} ficheros, ningún alias usado sin declarar.`
  );
  process.exit(0);
}

console.error(
  `check:sql-aliases FALLA — ${hallazgos.length} alias usado(s) sin declarar.\n` +
    `PostgreSQL responde "missing FROM-clause entry" EN TIEMPO DE LLAMADA: ni el lint ni el arranque lo ven.\n`
);
for (const h of hallazgos.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.error(`  ${h.file}:${h.line}  usa "${h.alias}." y no se declara  (p. ej. ${h.muestra})`);
}
process.exit(1);
