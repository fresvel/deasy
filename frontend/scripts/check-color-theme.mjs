#!/usr/bin/env node
/**
 * Colores escritos FUERA de la paleta: los que una plantilla pide por su nombre de Tailwind, o a
 * pelo en hex, en vez de por el token del sistema.
 *
 * POR QUE EXISTE
 * No habia nada que dijera «este color no es de este proyecto». `stylelint` solo mira los `.css`
 * (y `color-no-hex` ni siquiera entra en un `@apply`), y para `eslint` una clase es una cadena.
 * Asi que un color de la paleta de Tailwind escrito en un `.vue` no lo veia NADIE: llego a haber
 * 2 117, y bajarlos hasta donde estan hoy costo dos vueltas enteras del plan de diseño.
 *
 * QUE CUENTA COMO INFRACCION, y las tres formas que toma:
 *   1. `<propiedad>-<familia>-<paso>` donde `--color-<familia>-<paso>` NO esta en `@theme`. Ojo:
 *      la escala `gray` de TailAdmin SI esta registrada, asi que `gray-200` es nuestro y
 *      `gray-450` no. La comprobacion es por nombre completo, no por familia.
 *   2. Un hex dentro de un valor arbitrario.
 *   3. Un `rgb()`/`rgba()` dentro de un valor arbitrario — la forma que se cuela en las sombras.
 *
 * POR QUE UN TECHO Y NO CERO
 * Igual que `check-no-arbitrary`: prohibirlos de golpe no es un lint, es la fase 8 del plan de la
 * 3.ª vuelta (y 73 de ellos son un componente de estado que falta, no 73 fugas de color). Esto es
 * un TRINQUETE: baja cuando el trabajo lo baja, y no sube.
 *
 * ⚠️ Se cuentan tambien los que van dentro de una variante (`hover:`, `focus:`). Son colores
 * igual. Lo que NO se debe hacer es SUSTITUIRLOS a ciegas: un color en `hover:` no es el color
 * del elemento, y confundirlos convirtio cinco botones en alertas. Este script solo cuenta.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/* El techo, medido el 2026-08-14 sobre 108 colores registrados en `@theme`. SOLO BAJA.
 *
 *   familia 239  ·  hex 14  ·  rgb 4   =  257
 *
 * Bajo de 245 el mismo dia, al borrar el fork `AdminButton.vue`: estampaba `emerald-600` y
 * `red-600` crudos en sus variantes de exito y peligro, seis apariciones que se fueron con el
 * fichero. No es una sustitucion — es que el componente que las escribia ya no existe.
 *
 * El podio no son fugas sueltas: `emerald-50/200`, `rose-50/200` y `amber-50/200` copiados en
 * OCHO ficheros son «activo / borrador / retirado», o sea **un componente de estado que falta**
 * (fase 3.3). Y `homeView.helpers.js` y `useDeliverableView.js` los generan desde mapas en
 * JavaScript, que es la fase 8. Bajar este contador es ese trabajo, no una sustitucion. */
const TECHO = { total: 187, familia: 169, hex: 14, rgb: 4 };

const SRC = resolve(process.argv[2] ?? "src");
const TOKENS_CSS = join(SRC, "shared/styles/tokens.css");

/* Las 22 familias de la paleta por defecto de Tailwind. Una utilidad que nombre una de estas es
   sospechosa; si su nombre completo esta en `@theme`, es NUESTRA y pasa. */
const FAMILIAS = [
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime",
  "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia",
  "pink", "rose",
];

/* Las propiedades que pintan. `shadow` y `ring` entran porque llevan color. */
const PROPIEDADES = [
  "bg", "text", "border", "ring", "from", "via", "to", "fill", "stroke", "shadow", "outline",
  "decoration", "divide", "accent", "caret", "placeholder",
];

const RE_FAMILIA = new RegExp(
  `\\b(?:${PROPIEDADES.join("|")})-((?:${FAMILIAS.join("|")})-\\d{2,3})\\b`,
  "g",
);
const RE_HEX = /\[[^\]]*#[0-9a-fA-F]{3,8}[^\]]*\]/g;
const RE_RGB = /\[[^\]]*\brgba?\(/g;

/* Lo REGISTRADO. `@theme` es la unica fuente: si el nombre esta ahi, es un color del sistema. */
const registrados = new Set();
for (const [, nombre] of readFileSync(TOKENS_CSS, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
  registrados.add(nombre);
}

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    /* Los `.css` NO: ahi manda `stylelint`, y `tokens.css` nombra las primitivas a proposito. */
    else if (r.endsWith(".vue") || r.endsWith(".js")) acc.push(r);
  }
  return acc;
};

const cuenta = { total: 0, familia: 0, hex: 0, rgb: 0 };
const porFichero = new Map();
const nombres = new Map();

/* ⚠️ SIN COMENTARIOS. Este repo documenta cada migracion citando el color que retiro —
   `useDeliverableView.js` explica que «era el hex #4BF1A1 escrito a mano»— y contar esas citas
   infla el censo y, peor, hace que el contador NO BAJE al terminar el trabajo. Es la misma
   trampa que ya se pago con Tailwind escaneando los `.mjs` y con `css-prune` leyendo un
   comentario como uso: **la documentacion de un color no es un uso de ese color**. */
const sinComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

for (const ruta of ficheros(SRC)) {
  const texto = sinComentarios(readFileSync(ruta, "utf8"));
  let n = 0;
  for (const [, nombre] of texto.matchAll(RE_FAMILIA)) {
    if (registrados.has(nombre)) continue;
    cuenta.familia += 1; n += 1;
    nombres.set(nombre, (nombres.get(nombre) ?? 0) + 1);
  }
  for (const _ of texto.matchAll(RE_HEX)) { cuenta.hex += 1; n += 1; }
  for (const _ of texto.matchAll(RE_RGB)) { cuenta.rgb += 1; n += 1; }
  if (n) porFichero.set(ruta.slice(SRC.length + 1), n);
}
cuenta.total = cuenta.familia + cuenta.hex + cuenta.rgb;

if (process.argv.includes("--censo")) {
  console.log(`${registrados.size} colores registrados en @theme.\n`);
  console.log("Los nombres de Tailwind mas escritos:");
  for (const [nombre, n] of [...nombres].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(n).padStart(4)}  ${nombre}`);
  }
  console.log(`\n(${nombres.size} nombres distintos)\n`);
  console.log("Los diez ficheros que mas acumulan:");
  for (const [f, n] of [...porFichero].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${String(n).padStart(4)}  ${f}`);
  }
  console.log(`\ntotal ${cuenta.total} = familia ${cuenta.familia} + hex ${cuenta.hex} + rgb ${cuenta.rgb}`);
  process.exit(0);
}

const mal = Object.entries(TECHO).filter(([k, techo]) => cuenta[k] > techo);
if (mal.length) {
  for (const [clave, techo] of mal) console.error(`✖ ${clave.padEnd(8)} ${cuenta[clave]} > ${techo} (techo)`);
  console.error("\nLos cinco ficheros que mas acumulan:");
  for (const [f, n] of [...porFichero].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.error(`  ${String(n).padStart(4)}  ${f}`);
  }
  console.error(
    "\nUsa el token del sistema (`@theme` de `tokens.css`). Si el color que necesitas no existe," +
    "\ndeclaralo ahi CON SU FAMILIA — no en el sitio donde lo gastas. Y si de verdad no puede ser" +
    "\nun token, baja el techo en `scripts/check-color-theme.mjs` EN EL MISMO COMMIT explicando" +
    "\npor que. `node scripts/check-color-theme.mjs src --censo` da el desglose.",
  );
  process.exit(1);
}

const bajados = Object.entries(TECHO)
  .filter(([k, v]) => cuenta[k] < v)
  .map(([k, v]) => `${k} ${cuenta[k]}/${v}`);
console.log(
  `check:color-theme OK — ${cuenta.total}/${TECHO.total} colores fuera de la paleta.` +
  (bajados.length ? ` Por debajo del techo: ${bajados.join(", ")} (bajalo).` : ""),
);
