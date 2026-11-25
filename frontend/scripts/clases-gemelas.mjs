#!/usr/bin/env node
/* ¿QUE CLASES SON LA MISMA CON OTRO NOMBRE?
 *
 * Herramienta de MEDICION de la fase 11, no una puerta. No falla nunca: informa.
 *
 * ── DE DONDE SALE ──────────────────────────────────────────────────────────────────────────────
 *
 * Del colapso de las cuatro familias de control (F4, 2026-08-15). `deasy-control`,
 * `deasy-filter-control`, `deasy-field-input` y `profile-text-input` eran **el mismo control con
 * cuatro nombres**, 228 usos entre las cuatro, y nadie lo habia visto en anos. Lo que las delato
 * no fue leerlas: fue ponerlas una al lado de otra y comparar sus cuerpos.
 *
 * ⚠️ Y LEER EL CSS NO BASTA, que es la leccion cara de aquel trabajo: dos de las cuatro declaraban
 * un radio que **nunca llegaba al DOM** —`rounded-2xl` y `1rem`, tapados por una regla de elemento
 * sin capa—, asi que sobre el papel parecian mas distintas de lo que se veian. Este script compara
 * el TEXTO de las declaraciones, que es un buen primer filtro y barato; la confirmacion de un
 * candidato se hace midiendo en el navegador con `getComputedStyle`, nunca al reves.
 *
 * ── QUE MIDE ───────────────────────────────────────────────────────────────────────────────────
 *
 * Para cada pareja de clases propias, el parecido de sus declaraciones (Jaccard sobre el conjunto
 * de utilidades y propiedades). Ordena por parecido y por uso combinado, porque una pareja de dos
 * clases con 90 consumidores vale mas que una de dos con tres.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ESTILOS = process.argv[2] ?? "src/shared/styles";
const FUENTE = process.argv[3] ?? "src";
const MINIMO = Number(process.argv[4] ?? 0.7);

/* ── 1 · el cuerpo de cada clase, del fuente ────────────────────────────────────────────────── */
const cuerpos = new Map();

for (const nombre of readdirSync(ESTILOS).filter((f) => f.endsWith(".css"))) {
  const texto = readFileSync(join(ESTILOS, nombre), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  /* Reglas simples: un solo selector de clase, sin descendencia ni pseudo. Las compuestas y los
     estados no son «la misma clase con otro nombre»: son otra cosa. */
  for (const m of texto.matchAll(/(^|\})\s*\.([a-z][\w-]*)\s*\{([^}]*)\}/g)) {
    const clase = m[2];
    const cuerpo = m[3];
    const piezas = new Set();
    for (const ap of cuerpo.matchAll(/@apply([^;]*);/g)) {
      for (const u of ap[1].trim().split(/\s+/)) if (u) piezas.add(u);
    }
    for (const d of cuerpo.matchAll(/(^|;)\s*([a-z-]+)\s*:\s*([^;]+)/g)) {
      if (d[2].startsWith("--")) continue;
      piezas.add(`${d[2]}:${d[3].trim()}`);
    }
    if (piezas.size < 3) continue;              /* un cuerpo de una linea no dice nada */
    if (!cuerpos.has(clase)) cuerpos.set(clase, { piezas, f: nombre });
  }
}

/* ── 2 · cuantos consumidores tiene cada una ────────────────────────────────────────────────── */
const listar = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (!p.includes("styles")) listar(p, out); }
    else if (/\.(vue|js)$/.test(p)) out.push(p);
  }
  return out;
};
const fuente = listar(FUENTE).map((f) => readFileSync(f, "utf8")).join("\n");
const usos = (c) => (fuente.match(new RegExp(`(?<![\\w-])${c}(?![\\w-])`, "g")) || []).length;

/* ── 3 · las parejas ────────────────────────────────────────────────────────────────────────── */
const nombres = [...cuerpos.keys()];
const parejas = [];

for (let i = 0; i < nombres.length; i++) {
  for (let j = i + 1; j < nombres.length; j++) {
    const a = cuerpos.get(nombres[i]).piezas;
    const b = cuerpos.get(nombres[j]).piezas;
    const comunes = [...a].filter((x) => b.has(x)).length;
    const parecido = comunes / (a.size + b.size - comunes);
    if (parecido < MINIMO) continue;
    const ua = usos(nombres[i]), ub = usos(nombres[j]);
    parejas.push({ a: nombres[i], b: nombres[j], parecido, ua, ub, total: ua + ub,
                   fa: cuerpos.get(nombres[i]).f, fb: cuerpos.get(nombres[j]).f });
  }
}

parejas.sort((x, y) => (y.parecido - x.parecido) || (y.total - x.total));

console.log(`\n  ${parejas.length} parejas con parecido >= ${MINIMO} · ${nombres.length} clases con cuerpo comparable\n`);
for (const p of parejas.slice(0, 30)) {
  const pct = String(Math.round(p.parecido * 100)).padStart(3);
  console.log(`  ${pct}%  ${p.a} (${p.ua})  ≈  ${p.b} (${p.ub})   [${p.total} usos]`);
  if (p.fa !== p.fb) console.log(`         ⚠️ en ficheros distintos: ${p.fa} / ${p.fb}`);
}
if (parejas.length > 30) console.log(`\n  … y ${parejas.length - 30} mas`);
console.log("\n  ⚠️ Esto es el PRIMER filtro, no la conclusion. Un candidato se confirma midiendo las dos");
console.log("     clases en el navegador con getComputedStyle: hay declaraciones que no llegan al DOM.\n");
