#!/usr/bin/env node
/* G4 · PAGINACION — censo por ESTRUCTURA, cuarto de la familia.
 *
 * Su señal no es donde vive ni que le hace al contenedor: es que **mueve un indice**. Un boton de
 * paginacion lleva de un elemento al siguiente de una secuencia ordenada — pagina 3 de 12, paso 2
 * de 5, documento 4 de 9. Eso se ve en el @click: `prevX`/`nextX`, `goToPage`, o un `++`/`--`
 * sobre el indice.
 *
 * Aqui caen DOS cosas que parecen distintas y no lo son: el navegador de paginas de un PDF y el
 * «Atras»/«Siguiente» de un wizard. Las dos mueven un indice; lo que cambia es el destino —una
 * usa `AppCounterNavigator` (el widget con la lectura en medio) y la otra `AppButton`, porque un
 * wizard no muestra «2 / 5» en el propio boton—. El censo acepta las dos, y lo que exige es lo de
 * siempre: que salgan del componente y no lleven estilo por fuera.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;   /* trinquete: G4 quedo limpio el 2026-08-15 */

const PULSABLE = /^(button|AppButton|AdminButton|AppCounterNavigator)$/;
/* Mover un indice: por nombre de manejador o por aritmetica sobre el */
const MUEVE = [
  /^\s*(prev|next)[A-Z(]/,
  /^\s*goTo(Page|Step|Slide|Index|Item)\b/,   /* `goToLogin` navega a una RUTA: no es paginacion */
  /^\s*(prev|next)\s*\(/,
  /\b(currentPage|page|pageIndex|currentStep|stepIndex|currentIndex|activeIndex)\s*(\+\+|--)/,
  /\b(currentPage|page|pageIndex|currentStep|stepIndex|currentIndex|activeIndex)\s*=\s*[^=]*[+-]\s*1/,
  /\bgo(Prev|Next|To)\b/,
];

const ficheros = (d, a = []) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
    statSync(r).isDirectory() ? ficheros(r, a) : (r.endsWith(".vue") && !r.includes(".test.")) && a.push(r);
  }
  return a;
};

const filas = [];

for (const ruta of ficheros(SRC)) {
  const tpl = readFileSync(ruta, "utf8").replace(/<!--[\s\S]*?-->/g, "").split(/\n<script/)[0];
  const RE = /<(\/?)([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

  for (const m of tpl.matchAll(RE)) {
    const [todo, cierra, tag, attrs, auto] = m;
    if (cierra || !PULSABLE.test(tag)) continue;

    /* El widget no expone `@click` sino `@previous`/`@next`: cada uso suyo ES paginacion, y
       contarlo hace honesto el numero — si no, el censo dice «4 botones» cuando hay 4 sueltos
       mas todos los que el widget ya resolvio. */
    const esWidget = tag === "AppCounterNavigator";
    const accion = (attrs.match(/@click(?:\.[a-z]+)*="([^"]*)"/) || [, ""])[1];
    if (!esWidget && !MUEVE.some((re) => re.test(accion))) continue;

    const desde = m.index + todo.length;
    const cuerpo = auto ? "" : tpl.slice(desde, desde + 300).split(new RegExp(`</${tag}>`))[0];
    const texto = cuerpo.replace(/<[^>]*>/g, "").trim();
    const etiqueta = (attrs.match(/(?<![:@\w-])(?:title|aria-label)="([^"]*)"/) || [])[1] || texto || accion.slice(0, 24);

    const clases = ((attrs.match(/(?<![:@\w-])class(?:-name)?="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
    const sobra = clases.filter((c) =>
      !/^(absolute|relative|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|flex|inline-flex|sm:|md:|lg:)/.test(c)
      && !/^(deasy|graph)-/.test(c));

    filas.push({
      f: ruta.slice(SRC.length + 1), linea: tpl.slice(0, m.index).split("\n").length,
      tag, etiqueta: etiqueta.slice(0, 30),
      variante: (attrs.match(/(?<![:@\w-])variant="([a-zA-Z][a-zA-Z-]*)"/) || [, null])[1],
      dinamica: /:variant=/.test(attrs), sobra,
      sistema: clases.some((c) => /^deasy-/.test(c)),
    });
  }
}

const motivos = (r) => [
  r.tag === "button" && !r.sistema ? "<button> CRUDO — usa AppCounterNavigator o AppButton" : null,
  (r.tag === "AppButton" || r.tag === "AdminButton") && !r.variante && !r.dinamica ? "sin variante" : null,
  r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 4).join(" ")}` : null,
].filter(Boolean);

const mal = filas.filter((r) => motivos(r).length);

if (process.argv.includes("--listar")) {
  console.log(`\n${filas.length} botones que mueven un indice:\n`);
  for (const r of filas) console.log(`  ${r.f}:${r.linea}  «${r.etiqueta}»  [${r.tag}${r.variante ? " " + r.variante : ""}]`);
  process.exit(0);
}

if (mal.length > TECHO) {
  console.error(`\ncheck:paging-actions FALLA — ${mal.length} botones de paginacion fuera del componente (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs) console.error(`     :${String(r.linea).padEnd(5)} «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  console.error("\nEl navegador con lectura en medio es AppCounterNavigator (nav.css). El «Atras»/");
  console.error("«Siguiente» de un wizard es AppButton. Ninguno de los dos lleva utilidades sueltas.\n");
  process.exit(1);
}
console.log(`check:paging-actions OK — ${filas.length} botones de paginacion, todos por el componente.`);
