#!/usr/bin/env node
/**
 * Poda de CSS muerto — Frente 4 · Sistema de diseño.
 *
 * Trocea una hoja en bloques de PRIMER NIVEL (comentario / at-rule / regla) y decide
 * cuáles se pueden borrar: los que sólo mencionan clases sin ningún consumidor en el
 * código fuente. Las at-rules se recorren en profundidad, así que un `@media` cuyas
 * reglas internas estén todas muertas también cae.
 *
 * INVARIANTE DE RECONSTRUCCIÓN (regla 1 de docs/planes/referencia/metodo.md): las piezas
 * troceadas deben reproducir el fichero original BYTE A BYTE. Si no, el troceador está
 * mal y el script aborta antes de escribir nada.
 *
 * Uso:
 *   node scripts/css-prune.mjs <hoja.css> [--apply]
 * Sin --apply sólo informa.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const SRC = "frontend/src";
const target = process.argv[2];
const apply = process.argv.includes("--apply");
if (!target) {
  console.error("uso: node scripts/css-prune.mjs <hoja.css> [--apply]");
  process.exit(2);
}

const css = readFileSync(resolve(target), "utf8");

/* ---------------------------------------------------------------- troceador */

/** Trocea `text` en bloques de primer nivel, respetando cadenas y comentarios. */
function split(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    // Comentario de primer nivel
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out.push({ kind: "comment", text: text.slice(i, stop) });
      i = stop;
      continue;
    }
    // Espacio en blanco: se conserva como pieza propia para poder reconstruir
    if (/\s/.test(text[i])) {
      let j = i;
      while (j < text.length && /\s/.test(text[j])) j++;
      out.push({ kind: "ws", text: text.slice(i, j) });
      i = j;
      continue;
    }
    // Regla o at-rule: leer hasta `{` equilibrado o hasta `;` (at-rule sin cuerpo)
    let j = i;
    let depth = 0;
    let started = false;
    let str = null;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (str) {
        if (ch === "\\") { j++; continue; }
        if (ch === str) str = null;
        continue;
      }
      if (ch === '"' || ch === "'") { str = ch; continue; }
      if (text.startsWith("/*", j)) { const e = text.indexOf("*/", j + 2); j = e === -1 ? text.length : e + 1; continue; }
      if (ch === "{") { depth++; started = true; continue; }
      if (ch === "}") { depth--; if (depth === 0) { j++; break; } continue; }
      if (ch === ";" && depth === 0 && !started) { j++; break; }
    }
    const raw = text.slice(i, j);
    const head = raw.split("{")[0].trim();
    out.push({
      kind: raw.trimStart().startsWith("@") ? "at" : "rule",
      text: raw,
      head,
      body: started ? raw.slice(raw.indexOf("{") + 1, raw.lastIndexOf("}")) : null,
    });
    i = j;
  }
  return out;
}

const pieces = split(css);

// --- invariante de reconstrucción -------------------------------------------
const rebuilt = pieces.map((p) => p.text).join("");
if (rebuilt !== css) {
  console.error("ABORTA: el troceo no reproduce el original byte a byte.");
  console.error(`  original ${css.length} bytes / reconstruido ${rebuilt.length} bytes`);
  for (let k = 0; k < Math.min(css.length, rebuilt.length); k++) {
    if (css[k] !== rebuilt[k]) { console.error(`  primera divergencia en el byte ${k}: ${JSON.stringify(css.slice(k - 40, k + 40))}`); break; }
  }
  process.exit(1);
}

/* ------------------------------------------------------- consumidores reales */

/** Clases mencionadas por un selector (sólo `.clase`, no pseudo ni atributos). */
function classesIn(selector) {
  const found = new Set();
  for (const m of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) found.add(m[1]);
  return [...found];
}

/**
 * Vocabulario de tokens con pinta de clase presentes en el código fuente.
 *
 * Existe porque un grep literal NO basta: las clases se componen en runtime y la
 * cadena completa no aparece en ningún sitio. Dos formas reales de este repo:
 *
 *   AppTag.vue:23            `deasy-tag--${props.variant}`
 *   workspaceNavIcons.js:26  (tone, prefix = 'deasy-nav-item__icon') => `${prefix}--${tone}`
 *
 * La segunda es la traicionera: el literal ni siquiera queda pegado al `${`, va como
 * VALOR POR DEFECTO de un parámetro. Buscar `algo${` no la encuentra.
 *
 * Por eso la regla es por PREFIJOS: `.deasy-nav-item__icon--emerald` se conserva porque
 * `deasy-nav-item__icon` sí está en el fuente. Es conservador a propósito — poda de menos
 * antes que romper algo, y romperlo sería SILENCIOSO: no lo ve el build, ni el lint, ni
 * los tests. Sólo lo vio la huella de estilos computados del navegador.
 */
const vocabulario = (() => {
  const out = new Set();
  const hits = execSync(
    `grep -rhoE '[a-zA-Z][a-zA-Z0-9_]*(-{1,2}[a-zA-Z0-9_]+)+' --include=*.vue --include=*.js --include=*.mjs ${SRC} || true`,
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  ).split("\n");
  for (const h of hits) if (h) out.add(h);
  return out;
})();
console.log(`vocabulario del fuente: ${vocabulario.size} tokens con guion\n`);

/** Prefijos de `cls` cortados en cada frontera `-` o `--` (de más largo a más corto). */
function prefijosDe(cls) {
  const out = [];
  for (let i = cls.length - 1; i > 0; i--) {
    if (cls[i] !== "-") continue;
    let j = i;
    while (j > 0 && cls[j - 1] === "-") j--;   // absorber el `--` completo
    if (j > 0) out.push(cls.slice(0, j));
    i = j;
  }
  return out;
}

const cache = new Map();
/** ¿La clase aparece en el fuente, literal o como prefijo de una composición en runtime? */
function isUsed(cls) {
  if (cache.has(cls)) return cache.get(cls);
  if (vocabulario.has(cls)) { cache.set(cls, true); return true; }
  for (const p of prefijosDe(cls)) {
    if (vocabulario.has(p)) { cache.set(cls, true); return true; }
  }
  let used = false;
  try {
    // -F: literal. Se busca la cadena cruda; luego se afina con límites de palabra.
    const out = execSync(
      `grep -rlE '(^|[^a-zA-Z0-9_-])${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zA-Z0-9_-]|$)' --include=*.vue --include=*.js --include=*.mjs ${SRC} || true`,
      { encoding: "utf8" },
    ).trim();
    used = out.length > 0;
  } catch { used = true; } // ante la duda, se conserva
  cache.set(cls, used);
  return used;
}

/* ------------------------------------------------------------- clasificación */

/** Un bloque es podable si menciona ≥1 clase y NINGUNA de ellas tiene consumidor. */
function isDeadRule(head) {
  const selectors = head.split(",").map((s) => s.trim()).filter(Boolean);
  if (!selectors.length) return false;
  let sawClass = false;
  for (const sel of selectors) {
    const cls = classesIn(sel);
    if (!cls.length) return false; // toca un elemento/atributo: no se juzga por clases
    sawClass = true;
    if (cls.some((c) => isUsed(c))) return false;
  }
  return sawClass;
}

const OPACAS = /^@(keyframes|font-face|property|charset|import|plugin|custom-variant|theme)/;

/** Una at-rule con cuerpo es podable si todas sus reglas internas lo son. */
function isDeadAt(piece) {
  if (piece.body === null) return false;              // @import, @charset…
  if (OPACAS.test(piece.head)) return false;
  const inner = split(piece.body).filter((p) => p.kind === "rule" || p.kind === "at");
  if (!inner.length) return false;
  return inner.every((p) => (p.kind === "at" ? isDeadAt(p) : isDeadRule(p.head)));
}

/**
 * Poda DENTRO de una at-rule contenedora (`@layer`, `@media`): devuelve el texto
 * reescrito y la lista de cabeceras eliminadas. Necesario porque en `tailwind.css`
 * las ~270 clases `.deasy-*` viven todas dentro de un solo `@layer components`:
 * sin recursión, ese bloque es un único trozo indivisible y no se poda nada.
 */
function pruneInside(piece) {
  const inner = split(piece.body);
  const quitados = [];
  const kept = [];
  for (let k = 0; k < inner.length; k++) {
    const q = inner[k];
    const muerto = (q.kind === "rule" && isDeadRule(q.head)) || (q.kind === "at" && isDeadAt(q));
    if (muerto) {
      quitados.push(q.head);
      // Absorber el separador que le sigue, para no dejar huecos crecientes
      if (inner[k + 1]?.kind === "ws") k++;
      continue;
    }
    if (q.kind === "at" && !OPACAS.test(q.head) && q.body !== null) {
      const sub = pruneInside(q);
      if (sub.quitados.length) {
        quitados.push(...sub.quitados);
        kept.push({ ...q, text: q.text.slice(0, q.text.indexOf("{") + 1) + sub.body + "}" });
        continue;
      }
    }
    kept.push(q);
  }
  return { body: kept.map((q) => q.text).join(""), quitados };
}

const dead = [];
const reescritos = [];
for (const p of pieces) {
  if (p.kind === "rule" && isDeadRule(p.head)) { dead.push(p); continue; }
  if (p.kind === "at") {
    if (isDeadAt(p)) { dead.push(p); continue; }
    if (!OPACAS.test(p.head) && p.body !== null) {
      const sub = pruneInside(p);
      if (sub.quitados.length) reescritos.push({ piece: p, nuevo: p.text.slice(0, p.text.indexOf("{") + 1) + sub.body + "}", quitados: sub.quitados });
    }
  }
}

const dentro = reescritos.flatMap((r) => r.quitados);
const deadLines = dead.reduce((n, p) => n + p.text.split("\n").length - 1, 0);

console.log(`${target}`);
console.log(`  bloques de primer nivel : ${pieces.filter((p) => p.kind === "rule" || p.kind === "at").length}`);
console.log(`  podables (primer nivel) : ${dead.length}  (~${deadLines} lineas)`);
console.log(`  podables (dentro de at) : ${dentro.length}`);
for (const p of dead) console.log(`    - ${p.head.replace(/\s+/g, " ").slice(0, 110)}`);
for (const h of dentro) console.log(`    · ${h.replace(/\s+/g, " ").slice(0, 110)}`);

if (!apply) { console.log("\n(informe; usa --apply para escribir)"); process.exit(0); }

const set = new Set(dead);
const rw = new Map(reescritos.map((r) => [r.piece, r.nuevo]));
let out = "";
for (let k = 0; k < pieces.length; k++) {
  const p = pieces[k];
  if (set.has(p)) {
    // Absorber el espacio en blanco que le precede, para no dejar huecos crecientes
    if (out.endsWith("\n\n") && pieces[k + 1]?.kind === "ws") k++;
    continue;
  }
  out += rw.get(p) ?? p.text;
}
out = out.replace(/\n{3,}/g, "\n\n");
writeFileSync(resolve(target), out);
console.log(`\nescrito: ${css.length} -> ${out.length} bytes`);
