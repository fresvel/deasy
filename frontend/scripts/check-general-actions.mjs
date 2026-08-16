#!/usr/bin/env node
/* G1 · ACCION GENERAL — el ultimo grupo, y el unico que se define POR DESCARTE.
 *
 * Los otros diez tienen una señal propia —el `v-for`, el contenedor, lo que le hace al padre, el
 * indice, el borrado, el `type="submit"`…—. G1 no: G1 es «un boton que ejecuta algo y no es
 * ninguno de los otros diez». Es el 63 % del sistema, y precisamente por eso es el que menos se
 * puede describir: no hay nada que lo distinga salvo no ser lo demas.
 *
 * ⚠️ Que se defina por descarte NO lo hace un cajon de sastre. Si un boton de aqui resulta tener
 * una señal propia —se repite en una lista, cierra algo, mueve un indice— es que pertenece a otro
 * grupo y hay que MOVERLO, no ensancharle a G1 la definicion. Eso es lo que paso con los paneles
 * de los grafos: parecian G1 y eran G2.
 *
 * Conformidad, la misma de siempre: sale del componente o de un bloque del sistema, con su
 * variante declarada, y sin estilo viajando por el atributo.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = Number(process.env.TECHO_G1 ?? 0);

const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "area", "col"]);
const PULSABLE = /^(button|AppButton|AdminButton)$/;
/* Bloques del sistema, incluidos los que no empiezan por `deasy-`: `admin-page-header__create`
   y `signature-workspace-card` son de familias de modulo, y `nodrag` es de Vue Flow (marca un
   nodo como no arrastrable — no es estilo). */
const BLOQUE = /^(deasy-btn|deasy-inline-tab|deasy-inline-action|deasy-inline-icon-button|deasy-chip-remove|deasy-pdf-action|deasy-fab|deasy-hero-back-button|deasy-nav-|deasy-stepper__|deasy-section-nav|deasy-counter-nav|deasy-option|deasy-tile|deasy-picker|deasy-alert|deasy-deliverable-action|graph-toggle|graph-|btnsera|admin-page-header__|signature-workspace-card|nodrag)/;

/* Las señales de los OTROS diez, para descartarlos. Cada una es la del gate que le toca. */
const CIERRA = [/\$emit\(\s*['"](close|cancel|dismiss|closed)['"]/, /^\s*(close|dismiss|hide)[A-Z$_(]/, /=\s*(null|false)\s*$/, /=\s*['"]{2}\s*$/];
const MUEVE = [/^\s*(prev|next)[A-Z(]/, /^\s*goTo(Page|Step|Slide|Index|Item)\b/, /\bgo(Prev|Next)\b/];
const DESTRUYE = /(delete|remove|detach|unassign|revoke|discard|purge|erase)/i;
const ZONA_FILTRO = /\bdeasy-filter-(shell|toolbar|field|search-row|actions|grid)\b/;
const ZONA_NAV = /\b(deasy-nav-shell|deasy-nav-group|deasy-nav-section|deasy-nav-tree)\b|\brole="navigation"/;

const ficheros = (d, a = []) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
    statSync(r).isDirectory() ? ficheros(r, a) : (r.endsWith(".vue") && !r.includes(".test.")) && a.push(r);
  }
  return a;
};

const filas = [];

for (const ruta of ficheros(SRC)) {
  const corto = ruta.slice(SRC.length + 1);
  if (/^shared\/components\/(buttons|widgets)\/(App\w+|Btn\w+)\.vue$/.test(corto)) continue;
  const enAuth = corto.startsWith("modules/auth/");
  const tpl = readFileSync(ruta, "utf8").replace(/<!--[\s\S]*?-->/g, "").split(/\n<script/)[0];

  const pila = [];
  const RE = /<(\/?)([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

  for (const m of tpl.matchAll(RE)) {
    const [todo, cierra, tag, attrs, auto] = m;

    if (cierra) {
      for (let i = pila.length - 1; i >= 0; i--) if (pila[i].tag === tag) { pila.length = i; break; }
      continue;
    }

    const propioVfor = /\bv-for=/.test(attrs);
    const heredaVfor = pila.some((p) => p.vfor);
    const enFiltro = pila.some((p) => p.filtro) || ZONA_FILTRO.test(attrs);
    const enNav = pila.some((p) => p.nav) || ZONA_NAV.test(attrs) || tag.toLowerCase() === "nav";
    const enTablist = pila.some((p) => p.tablist) || /\brole="tablist"/.test(attrs);

    if (PULSABLE.test(tag)) {
      const accion = (attrs.match(/@click(?:\.[a-z]+)*="([^"]*)"/) || [, ""])[1];
      const desde = m.index + todo.length;
      const cuerpo = auto ? "" : tpl.slice(desde, desde + 400).split(new RegExp(`</${tag}>`))[0];
      const texto = cuerpo.replace(/<[^>]*>/g, "").trim();
      const tieneIcono = /<(Icon[A-Z]\w*|svg|font-awesome-icon|component)\b/.test(cuerpo) || /\bicon-only\b/.test(attrs);
      const esLaFila = /\bw-full\b/.test(attrs) && /\btext-left\b/.test(attrs);

      /* ── El descarte: si cae en cualquiera de los otros diez, no es G1 ── */
      const otro =
        (heredaVfor && !propioVfor && !esLaFila)                                  /* G2  fila     */
        || CIERRA.some((re) => re.test(accion)) || /\bdata-modal-dismiss\b/.test(attrs)  /* G3  cerrar   */
        || MUEVE.some((re) => re.test(accion))                                    /* G4  paginar  */
        || DESTRUYE.test(accion)                                                  /* G5  destruir */
        || enFiltro                                                               /* G6  filtro   */
        || enTablist || /\brole="tab"\b/.test(attrs) || /\baria-selected\b/.test(attrs)  /* G7 pestaña */
        || enNav                                                                  /* G8  navegar  */
        || enAuth                                                                 /* G9  auth     */
        || (tieneIcono && !texto && !esLaFila)                                    /* G10 icono    */
        || /\btype="submit"/.test(attrs);                                         /* G11 envio    */
      if (otro) { if (!auto && !VOID.has(tag.toLowerCase())) pila.push({ tag, vfor: heredaVfor || propioVfor, filtro: enFiltro, nav: enNav, tablist: enTablist }); continue; }

      const clases = ((attrs.match(/(?<![:@\w-])class(?:-name)?="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
      const sobra = clases.filter((c) =>
        !/^(absolute|relative|fixed|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|w-auto|flex|inline-flex|sm:|md:|lg:|xl:|truncate|group|justify-|items-|gap-\d|order-)/.test(c)
        && !/^(top-|right-|bottom-|left-|inset-|my-auto|mx-auto|-?translate-|opacity-|group-hover:|z-|transition-opacity|(focus|lg|sm|md):opacity-)/.test(c)
        && !BLOQUE.test(c));

      filas.push({
        f: corto, linea: tpl.slice(0, m.index).split("\n").length, tag,
        etiqueta: ((attrs.match(/(?<![:@\w-])(?:title|aria-label)="([^"]*)"/) || [])[1] || texto || accion || "?").replace(/\s+/g, " ").slice(0, 34),
        variante: (attrs.match(/(?<![:@\w-])variant="([a-zA-Z][a-zA-Z-]*)"/) || [, null])[1],
        dinamica: /:variant=/.test(attrs),
        sobra, bloque: clases.some((c) => BLOQUE.test(c)),
      });
    }

    if (!auto && !VOID.has(tag.toLowerCase())) {
      pila.push({ tag, vfor: heredaVfor || propioVfor, filtro: enFiltro, nav: enNav, tablist: enTablist });
    }
  }
}

const motivos = (r) => [
  r.tag === "button" && !r.bloque ? "<button> CRUDO" : null,
  (r.tag === "AppButton" || r.tag === "AdminButton") && !r.variante && !r.dinamica ? "sin variante" : null,
  r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 5).join(" ")}` : null,
].filter(Boolean);

const mal = filas.filter((r) => motivos(r).length);

if (process.argv.includes("--listar")) {
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  console.log(`\nG1 — ${filas.length} acciones generales · ${mal.length} no conformes\n`);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${f}  (${rs.length})`);
    for (const r of rs) console.log(`     :${String(r.linea).padEnd(5)} «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  process.exit(0);
}

if (mal.length > TECHO) {
  console.error(`\ncheck:general-actions FALLA — ${mal.length} acciones generales fuera del componente (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs.slice(0, 6)) console.error(`     :${String(r.linea).padEnd(5)} «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
    if (rs.length > 6) console.error(`     … y ${rs.length - 6} mas`);
  }
  console.error("\nUn boton de accion sale de AppButton con su variante. Si ademas se repite en una");
  console.error("lista, cierra algo o mueve un indice, NO es G1: es de otro grupo y va a su gate.\n");
  process.exit(1);
}
console.log(`check:general-actions OK — ${filas.length} acciones generales${TECHO ? `, ${mal.length}/${TECHO} pendientes` : ", todas por el componente"}.`);
