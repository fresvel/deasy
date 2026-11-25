#!/usr/bin/env node
/**
 * UNA BALDOSA DE MENU VIVE EN `deasy-tile-grid`, NO EN UNA REJILLA ESCRITA A MANO.
 *
 * ══ QUE CAZA ════════════════════════════════════════════════════════════════════════════════
 * Un `<AppNavCard>` o un elemento con `deasy-tile` cuyo contenedor de rejilla mas cercano NO es
 * `deasy-tile-grid`. Si no hay ningun ancestro con `grid`, no dice nada: una baldosa suelta fuera
 * de rejilla es legitima.
 *
 * ══ DE DONDE SALE (F13.6, 2026-08-21) ═══════════════════════════════════════════════════════
 * La fase colapso **CINCO rejillas distintas** en una: `xl:grid-cols-3` en `/home`,
 * `xl:grid-cols-4` en firmas, `lg:grid-cols-3` en `/admin` y `/perfil`, con huecos de 16 y 24
 * segun la pantalla. El dueño fijo **cuatro por fila** en pantalla grande.
 *
 * 🪤 **Y se me escapo una — dos, contando la gemela.** Las rejillas de «Trazabilidad y soporte» de
 * `/admin` y `/procesos` viven **dentro de un desplegable** (`v-show="traceabilityOpen"`), asi que
 * no salen en la primera pantalla y ninguna medicion las vio: seguian a `lg:grid-cols-3` mientras
 * las de arriba ya iban a 4. **Lo vio el dueño, no yo.** Este gate existe por eso: la vista no
 * alcanza lo que esta plegado, y un censo hecho con el navegador solo mide lo que se renderiza.
 *
 * ══ COMO MIRA ═══════════════════════════════════════════════════════════════════════════════
 * Con una PILA DE ETIQUETAS, no con una ventana de lineas. La version rapida —«sube N lineas
 * buscando un `class` con grid»— confunde a los hermanos de un `v-for` con elementos sin rejilla,
 * y ahi es donde se esconde el caso que fallo.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");
const TECHO = 0;
/* Etiquetas HTML sin cierre: si no se saltan, la pila se desequilibra y todo lo de abajo cuelga
   del ancestro equivocado. */
const VACIAS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "track", "area",
                        "base", "col", "embed", "param", "wbr"]);

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

const ETIQUETA = /<\/?([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const claseDe = (attrs) => {
  const m = /\sclass="([^"]*)"/.exec(attrs);
  return m ? m[1] : "";
};
const esBaldosa = (tag, clase) =>
  tag === "AppNavCard" || /(^|\s)deasy-tile(\s|$)/.test(clase);

const fuera = [];
let baldosas = 0;

for (const f of ficheros(SRC)) {
  const src = readFileSync(f, "utf8");
  const rel = f.replace(SRC + "/", "");
  const pila = [];
  for (const m of src.matchAll(ETIQUETA)) {
    const [todo, tag, attrs = "", auto] = m;
    const cierre = todo.startsWith("</");
    if (cierre) { 
      /* Cierra hasta encontrar su apertura; una plantilla mal balanceada no debe tumbar el gate. */
      const i = pila.map((x) => x.tag).lastIndexOf(tag);
      if (i >= 0) pila.length = i;
      continue;
    }
    const clase = claseDe(attrs);
    if (esBaldosa(tag, clase)) {
      baldosas++;
      const rejilla = [...pila].reverse().find((x) => /(^|\s)(grid|deasy-tile-grid)(\s|$)/.test(x.clase)
                                                     || /\bgrid-cols-/.test(x.clase));
      if (rejilla && !/(^|\s)deasy-tile-grid(\s|$)/.test(rejilla.clase)) {
        fuera.push({ f: rel, n: src.slice(0, m.index).split("\n").length,
                     baldosa: tag === "AppNavCard" ? "<AppNavCard>" : ".deasy-tile",
                     rejilla: rejilla.clase.slice(0, 66) });
      }
    }
    if (!auto && !VACIAS.has(tag)) pila.push({ tag, clase });
  }
}

if (fuera.length > TECHO) {
  console.error(`\ncheck:tile-grid — ${fuera.length} baldosas en una rejilla escrita a mano (techo ${TECHO})\n`);
  for (const x of fuera) console.error(`   ${x.f}:${x.n}  ${x.baldosa}\n      dentro de  class="${x.rejilla}"`);
  console.error("\nLa rejilla de baldosas se llama `deasy-tile-grid` y vive en `surfaces.css`.");
  console.error("Son CUATRO por fila en pantalla grande (decision del dueño, F13.6) y el hueco");
  console.error("es el paso SECCION de la escala: 24 px. Si esta rejilla necesita otra cosa,");
  console.error("entonces lo que lleva dentro no es una baldosa de menu.\n");
  process.exit(1);
}

console.log(`check:tile-grid OK — ${baldosas} baldosas, ninguna en rejilla escrita a mano.`);
