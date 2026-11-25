#!/usr/bin/env node
/**
 * Trocea las dos hojas de estilo en modulos por familia de componente.
 *
 * Dos cosas que no son obvias y que dictan el diseño del script:
 *
 * 1. `tailwind.css` es UN SOLO `@layer components` de ~1200 lineas. Trocear por piezas de
 *    primer nivel devuelve una unica pieza; hay que descender DENTRO de la at-rule y
 *    envolver cada modulo en su propio `@layer components { }` (valido y soportado por
 *    Tailwind v4).
 *
 * 2. En `theme.css` las familias estan INTERCALADAS: agruparlas REORDENA las reglas. En
 *    CSS el orden decide entre reglas de igual especificidad, asi que reordenar puede
 *    cambiar el aspecto en silencio. El script no puede garantizarlo — lo garantiza la
 *    huella de estilos computados del navegador, que hay que pasar despues.
 *
 * El orden de importacion de `index.css` NO es alfabetico: reproduce las dependencias de
 * cascada que se midieron (los repintados de utilidades van al final porque tienen que
 * ganar a los componentes).
 *
 * Uso: node scripts/css-modularizar.mjs [--apply]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = "frontend/src/shared/styles";
const apply = process.argv.includes("--apply");

function split(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("/*", i)) {
      const e = text.indexOf("*/", i + 2);
      const stop = e === -1 ? text.length : e + 2;
      out.push({ kind: "comment", text: text.slice(i, stop) });
      i = stop; continue;
    }
    if (/\s/.test(text[i])) {
      let j = i; while (j < text.length && /\s/.test(text[j])) j++;
      out.push({ kind: "ws", text: text.slice(i, j) }); i = j; continue;
    }
    let j = i, depth = 0, started = false, str = null;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (str) { if (ch === "\\") { j++; continue; } if (ch === str) str = null; continue; }
      if (ch === '"' || ch === "'") { str = ch; continue; }
      if (text.startsWith("/*", j)) { const e = text.indexOf("*/", j + 2); j = e === -1 ? text.length : e + 1; continue; }
      if (ch === "{") { depth++; started = true; continue; }
      if (ch === "}") { depth--; if (depth === 0) { j++; break; } continue; }
      if (ch === ";" && depth === 0 && !started) { j++; break; }
    }
    const raw = text.slice(i, j);
    out.push({
      kind: raw.trimStart().startsWith("@") ? "at" : "rule",
      text: raw, head: raw.split("{")[0].trim(),
      body: started ? raw.slice(raw.indexOf("{") + 1, raw.lastIndexOf("}")) : null,
    });
    i = j;
  }
  return out;
}

/** A que modulo va cada regla, por su PRIMER selector. Gana la primera que casa. */
const REGLAS = [
  [/^(\*|html|body|#app|h[1-6]\b|a\b|input\b|select\b|textarea\b|\.h[1-6]\b|\.admin-typography|\.home-typography)/, "base"],
  [/deasy-workspace|deasy-sidebar|deasy-shell|deasy-context-header|deasy-secondary-nav/, "layout"],
  [/deasy-nav|deasy-inline-tab|deasy-secondary-tab|deasy-primary-nav/, "nav"],
  // `deasy-filter-btn` va con los botones, no con los filtros: es un boton, y ademas asi
  // conserva su orden original respecto a `.deasy-btn--md`. Clasificado como "forms" se
  // adelantaba y le ganaba, cambiandole el radio, el peso y el relleno.
  [/deasy-btn|admin-btn|hope-action|deasy-auth-button|deasy-filter-btn/, "buttons"],
  [/deasy-field|deasy-filter|deasy-form|deasy-dropzone|profile-text-input|profile-select|profile-textarea|profile-field|profile-inline|admin-select-field|admin-input|admin-lookup/, "forms"],
  [/deasy-table|table-institutional|profile-table|admin-data-table|^\.table\b/, "tables"],
  [/deasy-dialog|process-dialog|profile-dialog|deasy-modal|admin-modal|profile-confirm/, "dialogs"],
  [/deasy-tag/, "tags"],
  [/deasy-auth/, "auth"],
  [/admin-page-header|admin-workspace-frame|admin-surface-frame|admin-related-tabs|admin-menu|admin-feedback/, "admin"],
  [/deasy-card|deasy-panel|deasy-section|deasy-divider|deasy-col-|deasy-row|^\.card\b/, "surfaces"],
  [/^\.(bg|border|shadow|text|min-h)-/, "overrides"],
];

// El orden NO es alfabetico: es la cascada medida. `overrides` va al final porque sus
// reglas tienen que ganar a las de los componentes (por orden, no por !important).
const ORDEN = ["base", "layout", "nav", "surfaces", "buttons", "forms", "tables", "tags", "auth", "dialogs", "admin", "misc", "overrides"];

function moduloDeSelector(sel) {
  const s = sel.trim();
  for (const [re, mod] of REGLAS) if (re.test(s)) return mod;
  return "misc";
}

/**
 * A que modulo va una regla. Si su lista de selectores CRUZA VARIAS FAMILIAS, se asigna
 * a la que va MAS TARDE en `ORDEN`.
 *
 * No es un detalle: hay 18 reglas asi, y asignarlas por el primer selector rompe el
 * aspecto. Caso real medido — `.deasy-auth-visual, .deasy-dialog-footer { background }`
 * fue a `auth.css`, que se importa ANTES que `dialogs.css`; en el fichero original iba
 * DESPUES de la regla de `.deasy-dialog-footer`, asi que ganaba. Al adelantarla, perdio,
 * y el pie de los dialogos cambio de #f7fafc a #f8fafc.
 *
 * Tomando siempre la familia mas tardia, una regla nunca ADELANTA a otra que antes la
 * precedia: se queda en el modulo mas tardio de los que toca, que se importa igual o mas
 * tarde que cualquiera de sus familias.
 */
function moduloDe(head) {
  const mods = head.split(",").map(moduloDeSelector);
  return mods.reduce((a, b) => (ORDEN.indexOf(b) > ORDEN.indexOf(a) ? b : a));
}

const modulos = {};                                  // nombre -> [texto]
const add = (mod, texto) => (modulos[mod] ??= []).push(texto);

/* ---------------------------------------------- tailwind.css: cabecera + @layer base */

const tw = readFileSync(resolve(DIR, "tailwind.css"), "utf8");
const pTw = split(tw);
if (pTw.map((p) => p.text).join("") !== tw) throw new Error("tailwind.css: el troceo no reproduce el original");

let cabecera = "";                                   // @import, @plugin, @theme, @layer base
for (const p of pTw) {
  if (p.kind === "at" && /^@layer\s+components/.test(p.head)) {
    // Descender: repartir cada regla interna por familia, envuelta en su propia capa
    const dentro = split(p.body);
    let mod = null, buf = [];
    const volcar = () => { if (mod && buf.join("").trim()) add(mod, `@layer components {\n${buf.join("").replace(/^\n+|\n+$/g, "")}\n}\n`); buf = []; };
    for (const q of dentro) {
      if (q.kind === "ws") { if (mod) buf.push(q.text); continue; }
      if (q.kind === "comment") { buf.push(q.text); continue; }
      const m = q.kind === "rule" ? moduloDe(q.head) : mod || "misc";
      if (m !== mod) { volcar(); mod = m; }
      buf.push(q.text);
    }
    volcar();
    continue;
  }
  if (p.kind === "at" && /^@layer\s+utilities/.test(p.head)) { add("overrides", p.text + "\n"); continue; }
  cabecera += p.text;
}

/* -------------------------------------------------------- theme.css: todo sin capa */

const th = readFileSync(resolve(DIR, "theme.css"), "utf8");
const pTh = split(th);
if (pTh.map((p) => p.text).join("") !== th) throw new Error("theme.css: el troceo no reproduce el original");

let tokens = "";
let vistoRoot = false;
let enLaCola = false;
for (const p of pTh) {
  if (!vistoRoot) { tokens += p.text; if (p.kind === "rule" && p.head.includes(":root")) vistoRoot = true; continue; }
  if (p.kind === "ws" || p.kind === "comment") { tokens += ""; continue; }

  // Desde el primer repintado de utilidad hasta el final del fichero, TODO va junto a
  // `overrides` y en su orden original. Ese tramo es la capa de skin (el antiguo bloque
  // `local-dev`, ya promovido): repinta utilidades de Tailwind y luego declara sus
  // excepciones. Repartirlo por familias las separa y la excepcion deja de ganar —
  // medido: `.admin-workspace-frame--table`, que anula fondo, borde y sombra del marco,
  // acabo ANTES del repintado y el marco de las tablas se volvio blanco con borde.
  if (!enLaCola && p.kind === "rule" && /^\.(bg|border|shadow|min-h)-/.test(p.head.split(",")[0].trim())) enLaCola = true;

  add(enLaCola ? "overrides" : moduloDe(p.head), p.text + "\n\n");
}
// El @import de la fuente y el :root van a tokens.css
const idxEnable = tokens.indexOf("/* stylelint-enable color-no-hex */");
if (idxEnable !== -1) tokens = tokens.slice(0, idxEnable + "/* stylelint-enable color-no-hex */".length) + "\n";

/* ------------------------------------------------------------------------- salida */

const faltan = Object.keys(modulos).filter((m) => !ORDEN.includes(m));
if (faltan.length) throw new Error("modulos sin sitio en ORDEN: " + faltan.join(", "));

console.log("modulos:");
let total = 0;
for (const m of ORDEN) {
  if (!modulos[m]) continue;
  const n = modulos[m].join("").split("\n").length;
  total += n;
  console.log(`  ${String(n).padStart(5)} L  ${m}.css`);
}
console.log(`  ${String(tokens.split("\n").length).padStart(5)} L  tokens.css`);
console.log(`  ${String(cabecera.split("\n").length).padStart(5)} L  (cabecera: @import/@plugin/@theme/@layer base -> tokens.css)`);
console.log(`total ${total}`);

if (!apply) { console.log("\n(informe; usa --apply para escribir)"); process.exit(0); }

mkdirSync(resolve(DIR), { recursive: true });

// Los `@import` TIENEN que ir antes que cualquier otra regla: un `@import` colocado
// despues es invalido y el navegador lo DESCARTA EN SILENCIO. Al concatenar la cabecera
// de `tailwind.css` (que trae `@theme` y `@layer base`) con la de `theme.css` (que trae
// el `@import` de Google Fonts), este ultimo quedaba detras y dejaba de cargarse: la app
// entera pasaba a la tipografia de reserva. No lo vio el build; lo vio la huella, por un
// `<h1>` que medía 14px menos con TODOS sus estilos computados identicos.
// Por LINEAS, no por regex hasta el primer `;`: la URL de Google Fonts lleva puntos y
// coma dentro (`family=Inter:wght@300;400;500;600;700`) y cortar ahi parte el fichero.
const importsPrimero = (txt) => {
  const lineas = txt.split("\n");
  const imports = lineas.filter((l) => l.trimStart().startsWith("@import"));
  const resto = lineas.filter((l) => !l.trimStart().startsWith("@import"));
  return imports.join("\n") + "\n\n" + resto.join("\n").replace(/^\n+/, "");
};
writeFileSync(resolve(DIR, "tokens.css"), importsPrimero(cabecera.replace(/\n+$/, "\n") + "\n" + tokens.replace(/^\n+/, "")));
for (const m of ORDEN) if (modulos[m]) writeFileSync(resolve(DIR, `${m}.css`), modulos[m].join("").replace(/\n{3,}/g, "\n\n").trim() + "\n");

const imports = ["tokens", ...ORDEN.filter((m) => modulos[m])];
writeFileSync(resolve(DIR, "index.css"), `/* Punto de entrada unico de los estilos. \`main.js\` importa SOLO este fichero.

   EL ORDEN DE ESTOS IMPORTS NO ES ALFABETICO Y NO SE TOCA A LA LIGERA. En CSS, dos reglas
   de la misma especificidad se resuelven por orden de aparicion, asi que este orden ES
   parte del diseño. En concreto:

   - \`tokens.css\` va primero: declara la paleta y el \`@theme\` que registra los colores
     en Tailwind. Todo lo demas lo consume.
   - \`overrides.css\` va el ULTIMO. Contiene el repintado de las utilidades de Tailwind
     (\`.bg-white\`, \`.bg-slate-50\`, \`.shadow-sm\`...) a los valores de la marca, y tiene
     que ganar a las reglas de componente. Va por orden, no por \`!important\`.

   Si mueves un import, verificalo en el navegador con una huella de \`getComputedStyle\`
   antes/despues. Ni el build, ni el lint, ni los tests ven un estilo roto. */

${imports.map((m) => `@import "./${m}.css";`).join("\n")}
`);
console.log("\nescritos " + (imports.length + 1) + " ficheros.");
