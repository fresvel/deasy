#!/usr/bin/env node
/**
 * Clases HUERFANAS: las que una plantilla escribe y NO EXISTEN en el CSS que llega al navegador.
 *
 * POR QUE EXISTE
 * Un nombre de clase mal escrito no rompe nada. No falla el build, ni `eslint`, ni `stylelint`
 * (que solo mira `src/**\/*.css`), ni los tests: para todos ellos una clase es una cadena de
 * texto. La app arranca y el elemento simplemente no se pinta. Este gate es lo unico que lo ve.
 *
 * ══ DE DONDE SALE LA VERDAD, Y POR QUE CAMBIO EL 2026-08-14 ══════════════════════════════════
 * Antes este script ADIVINABA. Consideraba «nuestra» una clase por su PREFIJO, con una lista
 * escrita a mano (`deasy-`, `admin-`, `profile-`…), y todo lo demas lo daba por utilidad de
 * Tailwind y lo dejaba pasar. Ese diseño tenia el fallo dentro: la lista se queda corta sola.
 * Le faltaba `person-`, y por ese hueco **6 clases muertas en 16 sitios** llevaban meses
 * invisibles — se encontraron mirando a mano, no con el gate.
 *
 * Ahora la fuente es el **CSS CONSTRUIDO** (`dist/assets/*.css`), que es el unico sitio donde
 * consta que existe de verdad:
 *
 *   · las clases que declaramos nosotros, de los 18 modulos de `shared/styles/`;
 *   · las utilidades que Tailwind GENERA, que no son un catalogo fijo — las emite escaneando el
 *     codigo fuente, asi que `gap-3` existe si alguien la escribio y no existe si no;
 *   · y las de terceros (leaflet, Vue Flow), que entran con su hoja.
 *
 * Lo que no aparece ahi no pinta nada. Sin listas que mantener, y sin agujero por prefijo: un
 * `alumno-tabla` inventado mañana cae igual que un `deasy-` mal escrito.
 *
 * LO QUE SIGUE SIN PODER VER, Y NO SE INTENTA
 * Una clase compuesta en runtime — `` `deasy-tag--${variant}` ``, `classList.add('show')` — no
 * aparece en ningun atributo estatico. Este script NO las inventa: solo mira lo escrito.
 *
 * ⚠️ Este comentario NO trae ejemplos de utilidades escritos tal cual: Tailwind escanea el codigo
 * fuente buscando candidatos, ESTE FICHERO INCLUIDO. La primera version citaba tres en prosa y
 * las tres acabaron emitidas en el CSS construido. Verificado en el diff.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");
const STYLES = join(SRC, "shared/styles");
const DIST = resolve(new URL("../dist/assets", import.meta.url).pathname);

const ficheros = (dir, ext, acc = []) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) ficheros(ruta, ext, acc);
    else if (ext.some((e) => nombre.endsWith(e))) acc.push(ruta);
  }
  return acc;
};

/* ── 1. EL CSS CONSTRUIDO, Y QUE ESTE FRESCO ────────────────────────────────────────────────────
 * Un `dist/` viejo daria un VERDE FALSO, que es peor que no tener gate: mediria el arbol de
 * antes de tu cambio. Asi que se comprueba que no haya ningun fuente mas nuevo que el CSS
 * emitido. `pnpm run lint` construye antes justamente para que esto no salte nunca en su camino;
 * si lo ves, es que has llamado al script a mano. */
if (!existsSync(DIST)) {
  console.error("✖ check:orphan-classes — no hay CSS construido en `dist/assets`.");
  console.error("  Este gate lee lo que de verdad llega al navegador. Construye antes: `pnpm run build`.");
  process.exit(1);
}

const css = ficheros(DIST, [".css"]);
if (!css.length) {
  console.error("✖ check:orphan-classes — `dist/assets` no tiene ningun `.css`. Construye: `pnpm run build`.");
  process.exit(1);
}

const construidoEn = Math.min(...css.map((r) => statSync(r).mtimeMs));
const fuentes = ficheros(SRC, [".vue", ".js", ".css"]);
const masNuevo = fuentes
  .map((r) => [r, statSync(r).mtimeMs])
  .sort((a, b) => b[1] - a[1])[0];
if (masNuevo && masNuevo[1] > construidoEn) {
  console.error("✖ check:orphan-classes — el CSS construido es MAS VIEJO que el codigo fuente.");
  console.error(`  Cambio despues de construir: ${masNuevo[0].slice(SRC.length + 1)}`);
  console.error("  Medir contra un `dist/` rancio da un verde falso. Construye: `pnpm run build`.");
  process.exit(1);
}

/* ── 2. QUE CLASES EXISTEN ──────────────────────────────────────────────────────────────────────
 * En el CSS emitido los nombres van ESCAPADOS, y de DOS formas distintas. Hay que leer las dos o
 * media hoja parece huerfana:
 *
 *   1. Escape por barra: la `/` de una opacidad, los `:` de una variante, el `.` de un decimal y
 *      los parentesis y comas de un valor arbitrario llevan `\` delante.
 *   2. **Escape HEXADECIMAL con espacio final**, que es el que no se ve venir. Un identificador
 *      CSS no puede empezar por digito, asi que una utilidad con prefijo de punto de ruptura sale
 *      como `\32 xl\:…` — el `2` codificado, y **un espacio que forma parte del escape**. Leerlo
 *      como escape normal parte el nombre justo ahi y la clase se declara huerfana estando viva.
 *
 * El nombre termina en el primer caracter SIN escapar que no puede formar parte de una clase. */
const desescapar = (s) => s.replace(
  /\\([0-9a-fA-F]{1,6})[ ]?|\\(.)/g,
  (_, hex, literal) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : literal),
);

const existentes = new Set();
for (const ruta of css) {
  const hoja = readFileSync(ruta, "utf8");
  for (const [, crudo] of hoja.matchAll(/\.((?:\\[0-9a-fA-F]{1,6}[ ]?|\\.|[^\s.,:>+~()[\]{}"'\\])+)/g)) {
    existentes.add(desescapar(crudo));
  }
}

/* ── 2-bis. LAS QUE NO PINTAN A PROPOSITO ───────────────────────────────────────────────────────
 * Dos casos reales en los que una clase escrita NO tiene —ni debe tener— regla en el CSS. No son
 * excepciones de conveniencia: en los dos, exigir una regla seria exigir algo que no existe.
 *
 *   · `nodrag` / `nopan` / `nowheel` son la **API de Vue Flow**: la libreria las lee del DOM para
 *     desactivar arrastre, paneo y rueda sobre un nodo. Son de COMPORTAMIENTO, no de aspecto.
 *   · `group` y `peer` (con nombre, `group/loquesea`) son **marcadores de Tailwind**: el
 *     contenedor no genera regla propia; quien la genera es el hijo que lo mira.
 */
const SIN_REGLA_A_PROPOSITO = /^(nodrag|nopan|nowheel|(group|peer)(\/[a-zA-Z0-9_-]+)?)$/;

/* ── 3. QUE ESCRIBEN LAS PLANTILLAS ─────────────────────────────────────────────────────────────
 * Solo atributos ESTATICOS: un `:algo` con expresion no es texto literal. Y no solo `class=` —
 * la clase llega tambien POR PROP (`table-class`, `body-class`, `class-name`…), que es por donde
 * entraron 8 usos de una clase inexistente mientras `frontend/CLAUDE.md` §2.12 ya lo advertia.
 *
 * El `-` del lookbehind es lo que hace que funcione: con el prefijo opcional delante, el motor
 * podria casar el `class` interior de `:table-class` —saltandose el `:` que marca el enlace
 * dinamico— y ese `-` lo impide. */
const ATRIBUTO_CLASE = /(?<![:@\w-])(?:[a-z]+(?:-[a-z]+)*-)?class(?:-name)?="([^"]*)"/g;

/* ⚠️ Y se mira SOLO el markup: fuera `<script>` y `<style>`. Un componente que DOCUMENTA un fallo
   escribiendo el atributo tal cual —`AppButton.vue` explica en prosa que una variante desconocida
   acababa estampada como clase literal— hacia que el gate leyera la documentacion como uso y
   acusara a dos clases que nadie escribe. Es la version en espejo de la trampa ya pagada con
   Tailwind, que escanea los `.mjs` y emitio tres utilidades citadas en un comentario. */
const soloMarkup = (fuente) => fuente
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "");

const usos = new Map();
for (const ruta of ficheros(SRC, [".vue"])) {
  if (ruta.startsWith(STYLES)) continue;
  const fuente = soloMarkup(readFileSync(ruta, "utf8"));
  for (const [, valor] of fuente.matchAll(ATRIBUTO_CLASE)) {
    for (const clase of valor.split(/\s+/).filter(Boolean)) {
      if (clase.includes("{") || clase.includes("$")) continue;   /* interpolacion: no es literal */
      if (SIN_REGLA_A_PROPOSITO.test(clase)) continue;
      if (existentes.has(clase)) continue;
      if (!usos.has(clase)) usos.set(clase, []);
      usos.get(clase).push(ruta.slice(SRC.length + 1));
    }
  }
}

/* ── 4. Y QUE COMPONE EL JAVASCRIPT ─────────────────────────────────────────────────────────────
 * La señal 3 mira el markup a proposito, porque leer el `<script>` entero acusaba a las clases
 * que un comentario CITA. Pero eso dejaba fuera justo el sitio donde este repo esconde sus
 * peores clases muertas: **las que se componen en un mapa o en un ternario de JavaScript**.
 *
 * Lo pago dos veces el mismo fichero. `AppButton.vue` documento en 2026-08-14 que cuatro clases
 * viajaban al DOM sin pintar porque «los gates leen atributos `class`, y estas viven en un mapa
 * de JavaScript»… y en la misma frase dejo viva `admin-btn`, que tres dias despues se quedo sin
 * su unica regla y siguio estampandose en los ~317 botones de la aplicacion. Nadie la vio.
 *
 * La señal esquiva el falso positivo que motivo la exclusion, con dos acotaciones:
 *   · solo dentro de LITERALES DE CADENA, no en cualquier texto del script;
 *   · solo nombres con NUESTROS prefijos (`deasy-`, `admin-`), no utilidades de Tailwind —que
 *     son infinitas y se generan bajo demanda, asi que compararlas contra el CSS no dice nada.
 * Y se quitan los comentarios antes de mirar, que es la trampa ya pagada tres veces en este repo.
 */
const NUESTRA_CLASE = /^(?:deasy|admin)-[a-z0-9]+(?:-{1,2}[a-z0-9]+)*$/;

const sinComentarios = (fuente) => fuente
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const soloScript = (fuente, esVue) => {
  if (!esVue) return fuente;
  const trozos = [...fuente.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  return trozos.map((m) => m[1]).join("\n");
};

for (const ruta of ficheros(SRC, [".vue", ".js"])) {
  if (ruta.startsWith(STYLES)) continue;
  const esVue = ruta.endsWith(".vue");
  const fuente = sinComentarios(soloScript(readFileSync(ruta, "utf8"), esVue));
  for (const m of fuente.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
    const cadena = m[1] ?? m[2] ?? m[3];
    if (!cadena) continue;
    const piezas = cadena.split(/\s+/).filter(Boolean);
    /* ⚠️ UN NOMBRE CON NUESTRO PREFIJO NO ES SIEMPRE UNA CLASE. La primera version de esta señal
       acuso a `deasy-bootstrap-status`, que es una CLAVE DE `sessionStorage`. Asi que un literal
       solo cuenta si trae VARIAS clases —que es la forma de las listas de clases: `"deasy-btn
       admin-btn"`— o si en su vecindario aparece la palabra `class`. Una clave suelta no cumple
       ninguna de las dos, y una lista de clases cumple la primera siempre. */
    const vecindario = fuente.slice(Math.max(0, m.index - 90), m.index + cadena.length + 30);
    if (piezas.length < 2 && !/class/i.test(vecindario)) continue;
    for (const clase of piezas) {
      if (!NUESTRA_CLASE.test(clase)) continue;
      if (SIN_REGLA_A_PROPOSITO.test(clase)) continue;
      if (existentes.has(clase)) continue;
      if (!usos.has(clase)) usos.set(clase, []);
      usos.get(clase).push(ruta.slice(SRC.length + 1) + " (compuesta en JS)");
    }
  }
}

if (usos.size === 0) {
  console.log(`check:orphan-classes OK — ninguna clase escrita fuera del CSS construido (${existentes.size} existen).`);
  process.exit(0);
}

console.error(`check:orphan-classes — ${usos.size} clases que NO existen en el CSS construido:\n`);
for (const [clase, rutas] of [...usos].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${clase}  (${rutas.length})`);
  for (const ruta of [...new Set(rutas)]) console.error(`      ${ruta}`);
}
console.error(
  "\nCada una es o un gancho que sobra (borrala de la plantilla), o una regla que falta" +
  "\n(escribela en su modulo), o una utilidad MAL ESCRITA — que antes se colaba entera." +
  "\nLo que no vale es dejarla: no pinta nada y parece que si.",
);
process.exit(1);
