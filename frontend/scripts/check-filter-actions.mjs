#!/usr/bin/env node
/* G6 · FILTRO — censo por ESTRUCTURA, hermano de `check-row-actions.mjs`.
 *
 * G6 se cerro el 2026-08-14 buscando `deasy-filter-btn`, y esa busqueda no vio ni uno de home ni
 * de perfil: la clase habia muerto justo ahi. Es el mismo error que dejo G2 abierto, y por eso
 * este censo no busca cómo esta escrito el boton sino DONDE VIVE.
 *
 * La señal de G2 era el `v-for`. La de G6 es el CONTENEDOR: un boton dentro de la zona de filtros
 * —`deasy-filter-shell`, `-toolbar`, `-field`, `-search-row`, `-actions`— filtra, se llame como se
 * llame. Y para lo que vive fuera de una shell (el organigrama tiene su barra suelta), la segunda
 * señal es el manejador: `resetXFilters`, `clearXFilters`, `applyFilters`, `searchAndCenter`.
 *
 * ⚠️ Falsos amigos descartados a proposito: `clearToast` cierra una alerta (G3), `clearQueue`
 * borra la cola de firma (G5, destructivo) y `closeTaskFiltersModal` cierra un dialogo (G3).
 * Empiezan por «clear» y no filtran nada.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;   /* trinquete: G6 quedo limpio el 2026-08-15 y de ahi no sube */

const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "area", "col"]);
const PULSABLE = /^(button|AppButton|AdminButton|AppDeleteButton|AppCloseButton)$/;
const ZONA = /\bdeasy-filter-(shell|toolbar|field|search-row|actions|grid)\b/;
const MANEJA = /^(reset[A-Za-z]*Filters?|clear[A-Za-z]*Filters?|applyFilters?|searchAndCenter|resetGenericSearch|showAdvancedFilters|toggle[A-Za-z]*Filter)\b/;

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
  const pila = [];
  const RE = /<(\/?)([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

  for (const m of tpl.matchAll(RE)) {
    const [todo, cierra, tag, attrs, auto] = m;

    if (cierra) {
      for (let i = pila.length - 1; i >= 0; i--) if (pila[i].tag === tag) { pila.length = i; break; }
      continue;
    }

    const enZona = pila.some((p) => p.zona) || ZONA.test(attrs);

    if (PULSABLE.test(tag)) {
      const manejador = (attrs.match(/@click(?:\.[a-z]+)*="([a-zA-Z_$][\w$]*)/) || [])[1] || "";
      if (enZona || MANEJA.test(manejador)) {
        const desde = m.index + todo.length;
        const cuerpo = auto ? "" : tpl.slice(desde, desde + 300).split(new RegExp(`</${tag}>`))[0];
        const texto = cuerpo.replace(/<[^>]*>/g, "").trim();
        const etiqueta = (attrs.match(/(?<![:@\w-])(?:title|aria-label)="([^"]*)"/) || [])[1] || texto || manejador || "?";

        const variante = (attrs.match(/(?<![:@\w-])variant="([a-zA-Z]+)"/) || [, null])[1];
        const clases = ((attrs.match(/(?<![:@\w-])class(?:-name)?="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
        const sobra = clases.filter((c) =>
          !/^(absolute|relative|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|flex|inline-flex|sm:|md:|lg:)/.test(c)
          && !/^(deasy|graph)-/.test(c));

        filas.push({
          f: ruta.slice(SRC.length + 1), linea: tpl.slice(0, m.index).split("\n").length,
          tag, etiqueta: etiqueta.slice(0, 30), variante,
          dinamica: /:variant=/.test(attrs), sobra,
          sistema: clases.some((c) => /^deasy-/.test(c)),
        });
      }
    }

    if (!auto && !VOID.has(tag.toLowerCase())) pila.push({ tag, zona: enZona });
  }
}

const motivos = (r) => [
  r.tag === "button" && !r.sistema ? "<button> CRUDO" : null,
  (r.tag === "AppButton" || r.tag === "AdminButton") && !r.variante && !r.dinamica ? "sin variante" : null,
  r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 4).join(" ")}` : null,
].filter(Boolean);

const mal = filas.filter((r) => motivos(r).length);

if (mal.length > TECHO) {
  console.error(`\ncheck:filter-actions FALLA — ${mal.length} botones de filtro fuera del componente (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs) console.error(`     :${String(r.linea).padEnd(5)} «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  console.error("\nUn boton de la zona de filtros sale de AppButton con su variante. `deasy-filter-btn`");
  console.error("murio el 2026-08-14 porque repintaba 5 variantes: no la resucites.\n");
  process.exit(1);
}
console.log(`check:filter-actions OK — ${filas.length} botones de filtro, todos por el componente.`);
