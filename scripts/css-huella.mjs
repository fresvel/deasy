#!/usr/bin/env node
/**
 * La HUELLA DE ESTILOS COMPUTADOS: la unica verificacion que sirve para un cambio de CSS.
 *
 * POR QUE EXISTE
 * Ni el build, ni el lint, ni los 304 tests detectan que rompiste un estilo. Esta demostrado
 * SEIS veces en este repo, y las seis con todas las puertas en verde:
 *
 *   - Dos clases de la barra lateral se quedaron sin color.
 *   - La tipografia Inter dejo de cargarse ENTERA (`document.fonts.size === 0`).
 *   - 114 nodos perdieron el borde por una autorreferencia de token.
 *   - 43 botones perdieron su fondo por un hex partido a la mitad (`#fff` dentro de `#fff0ed`).
 *   - Los conectores de Vue Flow volvieron a los valores de la libreria al mover una regla
 *     capada, porque la precedencia de capa gana a la especificidad.
 *   - Tres tarjetas del escritorio de firmas perdieron los margenes de su icono.
 *
 * Los cuatro primeros los caza esta huella. Un screenshot NO vale: hay que mirarlo y el ojo
 * perdona. Esto da un numero, no una impresion.
 *
 * COMO SE USA
 *
 *   1. Sacar el fragmento de captura y ejecutarlo en la consola del navegador ANTES del cambio:
 *
 *        node scripts/css-huella.mjs --captura        # imprime la funcion, lista para pegar
 *
 *      Guarda lo que devuelve como `antes.json`.
 *
 *   2. Aplicar el cambio, recargar con cache desactivada, repetir -> `despues.json`.
 *
 *   3. Comparar:
 *
 *        node scripts/css-huella.mjs antes.json despues.json
 *
 *      Sale 0 si no hay diferencias, 1 si las hay. En un refactor puro el numero tiene que ser
 *      CERO; cualquier diferencia significa que la regla que tocaste SI se aplicaba.
 *
 * CINCO COSAS QUE HAY QUE SABER, TODAS PAGADAS
 *
 *   1. ESPERA A `document.fonts.ready` ANTES DE MEDIR. Si no, los anchos mienten y salen
 *      diferencias de geometria que no existen. La captura ya lo hace.
 *
 *   2. COMPRUEBA EL NUMERO DE NODOS DE LA BASE ANTES DE FIARTE DE ELLA. Una captura salio con
 *      4 nodos (pagina a medio renderizar) y no se detecto hasta comparar. Si `count` es
 *      absurdamente bajo, o si `font-family` sale "Times New Roman", la app no habia montado:
 *      repite la captura.
 *
 *   3. LA HUELLA NO VE LOS PSEUDO-ELEMENTOS. `::-webkit-scrollbar`, `::placeholder` y
 *      `::before/::after` son invisibles para `getComputedStyle` sobre el nodo. Un cambio ahi
 *      hay que verificarlo leyendo el CSS servido y mirando. (Y en el Chrome de las pilas las
 *      barras son superpuestas: tampoco reservan ancho, asi que `offsetWidth - clientWidth`
 *      tampoco sirve.)
 *
 *   4. EL EMPAREJAMIENTO ES POR RUTA EN EL DOM. Si el contenido cambia de orden entre las dos
 *      capturas —nodos de un grafo, filas de una tabla sin ordenar— comparas elementos
 *      distintos y salen diferencias falsas. Captura las dos en el MISMO estado.
 *
 *   5. HAY ESTADOS QUE NO SALEN SOLOS. El drawer del organigrama se abre pulsando un nodo; el
 *      mapa de procesos necesita los toggles «Configuraciones» y «Entregables»; la tarjeta de
 *      entregable necesita `npm run seed:dev` y pulsar «Iniciar». Y el admin NO puede ver
 *      `/home` ni `/perfil` (`meta.blockedForAdmin`): hay que entrar como usuario o gestor.
 *
 * RUTAS DE REFERENCIA
 *   /login · /home · /home/firmas · /perfil · /admin
 *   /admin/academia/unidades/organigrama · /admin/gestiones/procesos/mapa
 */
import { readFileSync } from "node:fs";

// Las 37 propiedades. Cubren color, borde, sombra, tipografia, caja y posicion: si una regla
// deja de aplicarse, casi siempre se nota en alguna de estas.
const PROPS = [
  "color", "background-color", "background-image",
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius",
  "border-top-color", "border-top-width", "border-top-style",
  "border-bottom-color", "border-bottom-width",
  "box-shadow", "opacity", "backdrop-filter",
  "font-size", "font-weight", "font-family", "line-height", "letter-spacing", "text-transform",
  "padding-top", "padding-bottom", "padding-left", "margin-top", "margin-bottom",
  "display", "flex-direction", "gap", "align-items", "justify-content", "text-align",
  "width", "height", "min-height", "max-width",
  "position", "z-index", "transform", "inset",
];

const FRAGMENTO = `
// ── HUELLA DE ESTILOS COMPUTADOS ────────────────────────────────────────────────────
// Pegar en la consola del navegador. Devuelve un objeto: guardalo como JSON.
// OJO: comprueba que "count" no sea absurdamente bajo antes de fiarte de la captura.
(async () => {
  await document.fonts.ready;
  const PROPS = ${JSON.stringify(PROPS)};
  const out = [];
  const walk = (el, path) => {
    const cs = getComputedStyle(el);
    const cls = el.className && el.className.baseVal !== undefined
      ? el.className.baseVal            // los SVG llevan SVGAnimatedString, no string
      : String(el.className || "");
    const s = {};
    for (const p of PROPS) s[p] = cs.getPropertyValue(p);
    const r = el.getBoundingClientRect();
    out.push({
      p: path,
      t: el.tagName.toLowerCase(),
      c: cls.trim().slice(0, 80),
      s,
      r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    });
    let i = 0;
    for (const ch of el.children) walk(ch, path + "/" + ch.tagName.toLowerCase() + "[" + (i++) + "]");
  };
  walk(document.body, "body");
  return { url: location.pathname, count: out.length, fuentes: document.fonts.size, nodes: out };
})()
`.trim();

if (process.argv.includes("--captura")) {
  console.log(FRAGMENTO);
  process.exit(0);
}

const [rutaA, rutaB] = process.argv.slice(2);
if (!rutaA || !rutaB) {
  console.error("uso:  node scripts/css-huella.mjs <antes.json> <despues.json>");
  console.error("      node scripts/css-huella.mjs --captura        # el fragmento del navegador");
  process.exit(2);
}

const A = JSON.parse(readFileSync(rutaA, "utf8"));
const B = JSON.parse(readFileSync(rutaB, "utf8"));

for (const [nombre, h] of [["ANTES", A], ["DESPUES", B]]) {
  if (!Array.isArray(h.nodes)) {
    console.error(`${nombre}: no tiene 'nodes'. ¿Guardaste el objeto entero que devuelve la captura?`);
    process.exit(2);
  }
  // Trampa 2: una base a medio renderizar pasa desapercibida hasta que ya has decidido.
  if (h.nodes.length < 50) {
    console.error(`\n⚠️  ${nombre} tiene solo ${h.nodes.length} nodos: la pagina no habia montado.`);
    console.error("   Repite la captura. Comparar contra esto no demuestra nada.\n");
    process.exit(2);
  }
  if (h.fuentes === 0) {
    console.error(`\n⚠️  ${nombre} capturo con 0 fuentes cargadas: la tipografia no llego.`);
    console.error("   Puede ser un fallo real (ya paso) o una captura prematura. Compruebalo.\n");
  }
}

const clave = (n) => n.p + "|" + n.t;
const mapaA = new Map(A.nodes.map((n) => [clave(n), n]));
const mapaB = new Map(B.nodes.map((n) => [clave(n), n]));

const soloA = [...mapaA.keys()].filter((k) => !mapaB.has(k));
const soloB = [...mapaB.keys()].filter((k) => !mapaA.has(k));

const difs = [];
for (const [k, na] of mapaA) {
  const nb = mapaB.get(k);
  if (!nb) continue;
  const cambios = [];
  for (const p of Object.keys(na.s)) {
    if (na.s[p] !== nb.s[p]) cambios.push(`${p}: ${na.s[p]} -> ${nb.s[p]}`);
  }
  // Geometria con tolerancia de 1px: el redondeo del layout no es deuda.
  for (let i = 0; i < 4; i++) {
    if (Math.abs(na.r[i] - nb.r[i]) > 1) {
      cambios.push(`rect[${"xywh"[i]}]: ${na.r[i]} -> ${nb.r[i]}`);
    }
  }
  if (cambios.length) difs.push({ p: k, c: na.c.slice(0, 90), cambios });
}

console.log(`nodos: ${A.nodes.length} -> ${B.nodes.length}`);
console.log(`solo en ANTES: ${soloA.length}   solo en DESPUES: ${soloB.length}`);
console.log(`nodos con alguna diferencia: ${difs.length}`);
if (soloA.length) console.log("  faltan:", soloA.slice(0, 10));
if (soloB.length) console.log("  nuevos:", soloB.slice(0, 10));

// Agrupar por propiedad: el patron dice mas que la lista. 28 diferencias todas en
// `background-color` sobre `.vue-flow__handle` es un cambio previsto; repartidas por seis
// propiedades distintas, es una regresion.
const porProp = new Map();
for (const d of difs) {
  for (const c of d.cambios) {
    const p = c.split(":")[0];
    porProp.set(p, (porProp.get(p) || 0) + 1);
  }
}
if (porProp.size) {
  console.log("\npor propiedad:");
  for (const [p, n] of [...porProp].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${String(n).padStart(5)}  ${p}`);
  }
}

if (difs.length) {
  console.log("\nprimeros 25 nodos con diferencia:");
  for (const d of difs.slice(0, 25)) {
    console.log(`  ${d.p}`);
    console.log(`     class: ${d.c}`);
    for (const c of d.cambios.slice(0, 6)) console.log(`     ${c}`);
  }
}

process.exit(difs.length || soloA.length || soloB.length ? 1 : 0);
