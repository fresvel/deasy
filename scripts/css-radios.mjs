#!/usr/bin/env node
/**
 * Deshace la colision `--radius-*` con el espacio de nombres de Tailwind v4.
 *
 * `theme.css` declara `--radius-sm/md/lg` en un `:root` SIN capa, que gana a la capa
 * `theme` de Tailwind. Resultado: `rounded-lg` vale 16px en vez de 8, `rounded-md` 12 en
 * vez de 6, `rounded-sm` 8 en vez de 4. La escala queda ademas NO MONOTONA:
 * `rounded-lg` (16) > `rounded-xl` (12).
 *
 * Estrategia elegida: PRESERVAR EL ASPECTO. Cada uso se reescribe al utility que hoy
 * pinta ese mismo valor, y despues se borran los tres tokens. Cambio visual cero y la
 * escala de Tailwind vuelve a ser la suya.
 *
 *     rounded-lg (16px) -> rounded-2xl (16px)
 *     rounded-md (12px) -> rounded-xl  (12px)
 *     rounded-sm ( 8px) -> rounded-lg  ( 8px)
 *
 * EL ORDEN IMPORTA y por eso no se hace con tres `sed` seguidos: si se sustituye
 * `sm -> lg` antes que `lg -> 2xl`, el resultado del primero lo vuelve a capturar el
 * segundo y los 8px acaban en 16. Aqui se resuelve con UNA sola pasada por expresion
 * regular alternada, que consume cada coincidencia una vez.
 *
 * Cubre las variantes con prefijo (`sm:`, `hover:`, `focus:`, `group-hover:`…) y las
 * direccionales (`rounded-t-lg`, `rounded-tl-md`…).
 *
 * Uso: node scripts/css-radios.mjs [--apply]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SRC = "frontend/src";
const apply = process.argv.includes("--apply");

const MAPA = { sm: "lg", md: "xl", lg: "2xl" };

// `rounded` + lado opcional (-t, -br, -s…) + la escala a traducir.
// El limite por la izquierda evita tocar `not-rounded-lg` o similares.
const RE = /(^|[^a-zA-Z0-9_-])(rounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?)-(sm|md|lg)(?![a-zA-Z0-9_-])/g;

const ficheros = execSync(
  `grep -rl -E 'rounded-(sm|md|lg)' --include=*.vue --include=*.js --include=*.mjs --include=*.css ${SRC} || true`,
  { encoding: "utf8" },
).trim().split("\n").filter(Boolean);

let totales = { sm: 0, md: 0, lg: 0 };
const detalle = [];

for (const f of ficheros) {
  const s = readFileSync(f, "utf8");
  const cuenta = { sm: 0, md: 0, lg: 0 };
  const nuevo = s.replace(RE, (_m, pre, base, escala) => {
    cuenta[escala]++;
    return `${pre}${base}-${MAPA[escala]}`;
  });
  const n = cuenta.sm + cuenta.md + cuenta.lg;
  if (!n) continue;
  for (const k of ["sm", "md", "lg"]) totales[k] += cuenta[k];
  detalle.push({ f, ...cuenta, n });
  if (apply) writeFileSync(f, nuevo);
}

detalle.sort((a, b) => b.n - a.n);
for (const d of detalle) {
  console.log(`  ${String(d.n).padStart(4)}  ${d.f}  (sm:${d.sm} md:${d.md} lg:${d.lg})`);
}
console.log(`\nficheros: ${detalle.length}`);
console.log(`rounded-sm -> rounded-lg : ${totales.sm}`);
console.log(`rounded-md -> rounded-xl : ${totales.md}`);
console.log(`rounded-lg -> rounded-2xl: ${totales.lg}`);
console.log(`total                    : ${totales.sm + totales.md + totales.lg}`);
if (!apply) console.log("\n(informe; usa --apply para escribir)");
