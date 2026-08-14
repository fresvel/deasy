#!/usr/bin/env node
// Auditor de desajustes entre los `?` de una consulta y su array de parámetros.
//
// POR QUÉ EXISTE. `config/postgres.js` traduce `?` (estilo mysql2) a `$n` (estilo pg) en
// `bindParams`, y ahí conviven dos modos de fallo simétricos:
//
//   - FALTAN parámetros  -> `bindParams` LANZA desde el defecto 1.5 (`e0cdae9`). Antes, el `?`
//     sobrante recibía `undefined`, pg lo mandaba como NULL y la consulta se ejecutaba con datos
//     equivocados sin excepción, sin log y sin una fila de más o de menos que lo delatara.
//   - SOBRAN parámetros  -> se ignoran en silencio. Es el defecto 1.11.
//
// Y POR QUÉ ES UN SCRIPT Y NO UNA FRASE. El barrido que cerró el 1.5 se hizo y SE TIRÓ: no quedó
// código, solo un comentario en prosa en `config/postgres.test.js`. Cuando el 1.11 necesitó el mismo
// dato hubo que rehacerlo entero. Este fichero existe para que no haya una tercera vez, y para poder
// usarse como puerta: sale con código 1 si encuentra un desajuste decidible.
//
// QUÉ CUENTA COMO "DECIDIBLE". Una llamada es decidible si sus dos lados se pueden contar sin
// ejecutar nada: SQL en literal (cadena o plantilla SIN `${}`) y parámetros en array literal SIN
// spread. El resto se declara indecidible CON SU MOTIVO — un auditor que dice "0 problemas" sin
// decir cuántas llamadas no miró es exactamente el verde engañoso que el método del repo prohíbe
// (`docs/planes/referencia/metodo.md`, reglas 15-17).
//
// LOS DOS CONTEOS TIENEN QUE IMITAR A `bindParams`, o el resultado miente:
//   - Los `?` se cuentan con el MISMO autómata de tramos protegidos que usa `scanSql`
//     (`config/postgres.js`): cadenas, identificadores entrecomillados, backticks y comentarios
//     `--` y  /* */, con el '' escapado. Un contador ingenuo cuenta `?` dentro de un literal.
//   - La longitud del array son sus elementos de PRIMER NIVEL. Un elemento que a su vez es un array
//     —la expansión `IN (?)` de mysql2— cuenta como UNO, porque `bindParams` compara contra
//     `params.length`, no contra los valores aplanados.
//
// LÍMITE CONOCIDO: un `.query(` escrito DENTRO de una interpolación `${...}` no se ve (el contenido
// de una plantilla se trata como no-código). Hoy no hay ninguno; si algún día lo hay, aparecerá como
// llamada no encontrada, nunca como falso verde.
//
// Uso:  node scripts/audit_bindparams.mjs [--verbose]      (npm run check:params)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "storage", "coverage", "public"]);
const VERBOSE = process.argv.includes("--verbose");

// Estos dos NO son call sites: reciben el `{ text, values }` que `bindParams` PRODUCE, ya en `$n`.
// `postgres.js` es el adaptador y `db.mjs` su gemelo del harness de caracterización.
const ADAPTER_FILES = new Set(["config/postgres.js", "tests/characterization/lib/db.mjs"]);

// ── Escáner de JavaScript: dónde hay CÓDIGO y dónde no ────────────────────────────────────────

const skipQuoted = (src, start) => {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === "\\") { i += 2; continue; }
    if (src[i] === quote) return i + 1;
    i++;
  }
  return src.length;
};

// Una plantilla puede anidar `${ ... }` con cadenas y más plantillas dentro; hay que contar llaves.
const skipTemplate = (src, start) => {
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { i += 2; continue; }
    if (c === "`") return i + 1;
    if (c === "$" && src[i + 1] === "{") {
      let depth = 1;
      i += 2;
      while (i < src.length && depth > 0) {
        const d = src[i];
        if (d === "\\") { i += 2; continue; }
        if (d === "'" || d === '"') { i = skipQuoted(src, i); continue; }
        if (d === "`") { i = skipTemplate(src, i); continue; }
        if (d === "{") depth++;
        else if (d === "}") depth--;
        i++;
      }
      continue;
    }
    i++;
  }
  return src.length;
};

// `/` es división o principio de regex según lo que venga ANTES. Sin esto se pierden ficheros
// enteros: una regex que contenga una comilla desincroniza el escáner del resto del fichero.
const REGEX_MAY_FOLLOW = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "~", "^", "<", ">"]);

const skipRegex = (src, start) => {
  let i = start + 1;
  let inClass = false;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { i += 2; continue; }
    if (c === "\n") return start + 1;          // no era una regex: era una división
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) return i + 1;
    i++;
  }
  return src.length;
};

// Devuelve una máscara: 1 donde el carácter está en posición de CÓDIGO.
const codeMask = (src) => {
  const mask = new Uint8Array(src.length);
  let i = 0;
  let prev = "";
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === "'" || c === '"') { i = skipQuoted(src, i); prev = c; continue; }
    if (c === "`") { i = skipTemplate(src, i); prev = "`"; continue; }
    if (c === "/" && REGEX_MAY_FOLLOW.has(prev)) { i = skipRegex(src, i); prev = "/"; continue; }
    mask[i] = 1;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return mask;
};

// Avanza desde `(` hasta su `)` pareja, saltando literales. Devuelve el índice del `)`.
const matchParen = (src, open) => {
  let i = open + 1;
  let depth = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { const e = src.indexOf("\n", i); i = e === -1 ? src.length : e; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e === -1 ? src.length : e + 2; continue; }
    if (c === "'" || c === '"') { i = skipQuoted(src, i); continue; }
    if (c === "`") { i = skipTemplate(src, i); continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
};

// Parte una lista de argumentos por las comas de PRIMER NIVEL.
const splitTopLevel = (text) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') { i = skipQuoted(text, i); continue; }
    if (c === "`") { i = skipTemplate(text, i); continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
    i++;
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter((p, idx, all) => p !== "" || idx < all.length - 1);
};

// ── Los dos conteos, imitando a `bindParams` ──────────────────────────────────────────────────

// Copia deliberada de PROTECTED_SPANS de `config/postgres.js`. Va duplicada y no importada a
// propósito: si alguien cambia el autómata de allí, este auditor tiene que fallar de forma visible
// —sus cifras dejarían de cuadrar— en vez de seguirle la corriente en silencio.
const PROTECTED_SPANS = [
  { open: "--", close: "\n", doubled: false },
  { open: "/*", close: "*/", doubled: false },
  { open: "'", close: "'", doubled: true },
  { open: '"', close: '"', doubled: true },
  { open: "`", close: "`", doubled: false },
];

const findSpanEnd = (sql, start, span) => {
  let from = start + 1;
  while (from < sql.length) {
    const at = sql.indexOf(span.close, from);
    if (at === -1) break;
    const after = at + span.close.length;
    if (span.doubled && sql[after] === span.close) { from = after + 1; continue; }
    return after;
  }
  return sql.length;
};

const countPlaceholders = (sql) => {
  let count = 0;
  let i = 0;
  while (i < sql.length) {
    const span = PROTECTED_SPANS.find((s) => sql.startsWith(s.open, i));
    if (span) { i = findSpanEnd(sql, i, span); continue; }
    if (sql[i] === "?") count++;
    i++;
  }
  return count;
};

// ── Clasificación de una llamada ──────────────────────────────────────────────────────────────

const readSql = (arg) => {
  if (arg.startsWith('"') || arg.startsWith("'")) {
    const end = skipQuoted(arg, 0);
    if (end !== arg.length) return { motivo: "SQL concatenado o con sufijo" };
    return { sql: arg.slice(1, -1) };
  }
  if (arg.startsWith("`")) {
    const end = skipTemplate(arg, 0);
    if (end !== arg.length) return { motivo: "SQL concatenado o con sufijo" };
    const body = arg.slice(1, -1);
    // `\${` escapado no interpola; cualquier otro `${` sí.
    if (/(^|[^\\])\$\{/.test(body)) return { motivo: "SQL plantilla con ${}" };
    return { sql: body };
  }
  return { motivo: "SQL en variable o expresión" };
};

const readParams = (arg) => {
  if (!arg.startsWith("[") || !arg.endsWith("]")) return { motivo: "params en variable o expresión" };
  const inner = arg.slice(1, -1).trim();
  if (inner === "") return { length: 0 };
  const items = splitTopLevel(inner);
  if (items.some((it) => it.startsWith("..."))) return { motivo: "array literal con spread" };
  return { length: items.length };
};

// ── Recorrido ─────────────────────────────────────────────────────────────────────────────────

const collectFiles = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(full, out);
    } else if (/\.(js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

const stats = { archivos: 0, llamadas: 0, unArgumento: 0, decidibles: 0, equilibradas: 0 };
const motivos = new Map();
const desajustes = [];
const indecidibles = [];

for (const file of collectFiles(BACKEND_ROOT)) {
  const rel = path.relative(BACKEND_ROOT, file);
  if (ADAPTER_FILES.has(rel)) continue;
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes(".query(")) continue;
  stats.archivos++;
  const mask = codeMask(src);

  for (let i = 0; i < src.length; i++) {
    if (!mask[i] || !src.startsWith(".query(", i)) continue;
    const open = i + ".query".length;
    const close = matchParen(src, open);
    if (close === -1) continue;
    stats.llamadas++;

    const args = splitTopLevel(src.slice(open + 1, close));
    if (args.length < 2) { stats.unArgumento++; continue; }

    const sqlArg = readSql(args[0]);
    const paramsArg = readParams(args[1]);
    const motivo = sqlArg.motivo && paramsArg.motivo
      ? `${sqlArg.motivo} + ${paramsArg.motivo}`
      : (sqlArg.motivo || paramsArg.motivo);

    if (motivo) {
      motivos.set(motivo, (motivos.get(motivo) || 0) + 1);
      indecidibles.push({ rel, line: lineOf(src, i), motivo });
      continue;
    }

    stats.decidibles++;
    const esperados = countPlaceholders(sqlArg.sql);
    if (esperados === paramsArg.length) { stats.equilibradas++; continue; }
    desajustes.push({
      rel,
      line: lineOf(src, i),
      esperados,
      recibidos: paramsArg.length,
      sentido: paramsArg.length > esperados ? "SOBRAN" : "FALTAN",
    });
  }
}

// ── Informe ───────────────────────────────────────────────────────────────────────────────────

console.log(`check:params — ${stats.llamadas} llamadas .query( en ${stats.archivos} ficheros`);
console.log(`  ${stats.decidibles} decidibles · ${stats.equilibradas} equilibradas · ${desajustes.length} con desajuste`);
console.log(`  ${indecidibles.length} indecidibles (${stats.unArgumento} más sin parámetros, que no aplican):`);
for (const [motivo, n] of [...motivos].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${String(n).padStart(3)}  ${motivo}`);
}
console.log("  Los indecidibles NO están comprobados: se cierran con la sonda de `bindParams`, no aquí.");

if (VERBOSE) {
  console.log("\n  Detalle de los indecidibles:");
  for (const it of indecidibles.sort((a, b) => a.rel.localeCompare(b.rel))) {
    console.log(`      ${it.rel}:${it.line}  ${it.motivo}`);
  }
}

if (!desajustes.length) {
  console.log("\ncheck:params OK — ningún desajuste decidible entre `?` y parámetros.");
  process.exit(0);
}

console.error(`\ncheck:params FALLA — ${desajustes.length} desajuste(s):\n`);
for (const d of desajustes.sort((a, b) => a.rel.localeCompare(b.rel))) {
  console.error(`  ${d.rel}:${d.line}`);
  console.error(`      ${d.esperados} placeholders "?" / ${d.recibidos} parámetros  →  ${d.sentido} ${Math.abs(d.recibidos - d.esperados)}\n`);
}
process.exit(1);
