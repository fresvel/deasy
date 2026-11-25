#!/usr/bin/env node
/**
 * Sustituye hex por `var(--token)` en las hojas de estilo.
 *
 * Parece un `sed` de tres líneas. No lo es: la primera versión, escrita a mano, metió
 * DOS fallos, y ninguno lo vio el build, ni el lint, ni los 304 tests. Los dos están
 * codificados aquí como salvaguardas.
 *
 * ── Fallo 1: el hex corto dentro del largo ──────────────────────────────────────────
 * `#fff` es prefijo de `#fff0ed`. Sin un límite por la derecha, la sustitución deja
 * `var(--brand-white)0ed`, que es un valor inválido. Se llevó por delante el fondo de
 * 43 botones de borrado. Ordenar el mapa por longitud NO basta: hay que exigir que
 * detrás del hex no venga otro dígito hexadecimal.
 *
 * ── Fallo 2: la autorreferencia ────────────────────────────────────────────────────
 * Si se toca una línea que DECLARA el token, sale `--brand-border: var(--brand-border)`.
 * En CSS eso es inválido en tiempo de valor computado: la variable se queda SIN VALOR y
 * todo lo que la usaba cae a `currentColor`. Fueron 114 nodos, y solo en desarrollo —
 * porque la declaración culpable estaba en el bloque `local-dev`. Proteger únicamente el
 * `:root` no es suficiente: hay que saltarse CUALQUIER línea que declare el token.
 *
 * Uso: node scripts/css-hex-a-token.mjs <hoja.css> [--apply]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const MAPA = {
  "#ffffff": "--brand-white",
  "#fff": "--brand-white",
  "#5e4eff": "--brand-primary",
  "#e2e6f0": "--brand-border",
  "#d7deea": "--brand-border-field",
  "#f8fafc": "--brand-surface-alt",
  "#343741": "--brand-text-strong",
  "#3f4254": "--brand-text-body",
  "#f7f9fc": "--brand-surface-muted",
  "#071927": "--brand-navy-deep",
  "#111827": "--brand-navy",
  "#1f2937": "--brand-ink",
};

const target = process.argv[2];
const apply = process.argv.includes("--apply");
if (!target) {
  console.error("uso: node scripts/css-hex-a-token.mjs <hoja.css> [--apply]");
  process.exit(2);
}

const css = readFileSync(resolve(target), "utf8");
const lineas = css.split("\n");
const cuenta = {};
let tocadas = 0;

// Salvaguarda del fallo 1: `(?![0-9a-fA-F])` impide que `#fff` muerda dentro de `#fff0ed`.
const patron = new RegExp(
  "(" + Object.keys(MAPA).sort((a, b) => b.length - a.length).map((h) => h.replace("#", "#")).join("|") + ")(?![0-9a-fA-F])",
  "gi",
);

const salida = lineas.map((linea, i) => {
  // Salvaguarda del fallo 2: nunca tocar una linea que DECLARE un token.
  if (/^\s*--[a-z0-9-]+\s*:/i.test(linea)) return linea;

  let cambio = false;
  const nueva = linea.replace(patron, (m) => {
    const tok = MAPA[m.toLowerCase()];
    if (!tok) return m;
    cuenta[m.toLowerCase()] = (cuenta[m.toLowerCase()] || 0) + 1;
    cambio = true;
    return `var(${tok})`;
  });
  if (cambio) tocadas++;
  return nueva;
});

const resultado = salida.join("\n");

// Verificacion post: ninguna de las dos formas rotas puede sobrevivir.
// Se mira sobre el CSS SIN comentarios: esta misma cabecera cita los dos patrones rotos
// como ejemplo, y si no, el script aborta por su propia documentacion.
const sinComentarios = resultado.replace(/\/\*[\s\S]*?\*\//g, "");
const corrupto = sinComentarios.match(/var\(--[a-z0-9-]+\)[0-9a-fA-F]/gi);
const autoref = sinComentarios.match(/--([a-z0-9-]+)\s*:\s*var\(--\1\)/gi);
if (corrupto || autoref) {
  console.error("ABORTA: la sustitucion produjo valores rotos.");
  if (corrupto) console.error("  hex partido por la mitad:", [...new Set(corrupto)]);
  if (autoref) console.error("  autorreferencias:", [...new Set(autoref)]);
  process.exit(1);
}

console.log(`${target}: ${Object.values(cuenta).reduce((a, b) => a + b, 0)} hex en ${tocadas} lineas`);
for (const [h, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${h} -> ${MAPA[h]}`);

if (!apply) { console.log("\n(informe; usa --apply para escribir)"); process.exit(0); }
writeFileSync(resolve(target), resultado);
console.log("escrito.");
