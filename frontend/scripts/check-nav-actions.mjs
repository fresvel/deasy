#!/usr/bin/env node
/* G7 · PESTAÑA y G8 · NAVEGACION — censo por ESTRUCTURA, sexto y septimo de la familia.
 *
 * Van juntos porque comparten lo que los separa del resto: **no ejecutan, llevan**. Y por eso el
 * plan (§2) decidio que NO salen de `AppButton`: un boton no tiene estado «activo / actual», y
 * darselo obliga al componente entero a cargar con un estado que solo usan estos 33. La geometria
 * tampoco es la suya —una pestaña lleva subrayado y no lleva borde—.
 *
 * Sus dos señales:
 *
 *   G7 · PESTAÑA     — selecciona una vista dentro de un conjunto EXCLUYENTE: `role="tab"`,
 *                      `aria-selected`, o un @click que asigna a una variable `*Tab`.
 *   G8 · NAVEGACION  — lleva a OTRO SITIO: `router.push`, o un @click que cambia la seccion o la
 *                      vista activa.
 *
 * La diferencia entre las dos es real y no cosmetica: una pestaña deja el contexto donde esta
 * (cambia el panel, no la URL) y la navegacion lo abandona. Por eso `deasy-inline-tab` subraya y
 * `deasy-nav-item` se rellena.
 *
 * ⚠️ Falso amigo: un @click que pone `activeTab` para ABRIR un modal en una pestaña concreta no
 * es G7 — es G1 abriendo algo. Se distingue en que el boton no vive dentro de un `role="tablist"`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;

const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "area", "col"]);
const PULSABLE = /^(button|AppButton|AdminButton)$/;

const ES_TAB = [
  /\brole="tab"/,
  /\baria-selected\b/,
];
const TAB_POR_ACCION = /^[\s\w$.]*\b\w*[Tt]ab\w*\s*=\s*/;
/* ⚠️ G8 NO se define por «navega»: cualquier boton puede navegar —«Ir al login», «Volver»,
   una tarjeta del panel de inicio— y meterlos aqui convertiria G8 en G1. Un elemento de MENU se
   reconoce por donde vive, igual que un boton de filtro: dentro de una estructura de navegacion.
   Lo que navega puntualmente desde otro sitio es una accion general, y le toca su grupo. */
const ZONA_NAV = /\b(deasy-nav-shell|deasy-nav-group|deasy-nav-section|deasy-nav-tree)\b|\brole="navigation"/;

/* Los bloques del sistema que ya son navegacion */
const BLOQUE_TAB = /^(deasy-tile|deasy-picker|deasy-stepper__|deasy-nav-avatar|graph-node__badge|deasy-inline-tab|deasy-inline-tab--active|admin-related-tabs)$/;
const BLOQUE_NAV = /^(deasy-nav-item|deasy-nav-item--active|deasy-nav-item--subtle-active|deasy-nav-action|deasy-nav-group-title|deasy-hero-back-button|deasy-section-nav|deasy-section-nav--active|deasy-section-nav--stacked)$/;

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

    const enTablist = pila.some((p) => p.tablist) || /\brole="tablist"/.test(attrs);
    const enZonaNav = pila.some((p) => p.zonaNav) || ZONA_NAV.test(attrs) || tag.toLowerCase() === "nav";

    if (PULSABLE.test(tag)) {
      const accion = (attrs.match(/@click(?:\.[a-z]+)*="([^"]*)"/) || [, ""])[1];
      const esTab = ES_TAB.some((re) => re.test(attrs)) || (enTablist && TAB_POR_ACCION.test(accion));
      const esNav = !esTab && enZonaNav;

      if (esTab || esNav) {
        const desde = m.index + todo.length;
        const cuerpo = auto ? "" : tpl.slice(desde, desde + 300).split(new RegExp(`</${tag}>`))[0];
        const texto = cuerpo.replace(/<[^>]*>/g, "").trim();
        const etiqueta = (attrs.match(/(?<![:@\w-])(?:title|aria-label)="([^"]*)"/) || [])[1] || texto || accion.slice(0, 26);

        const estaticas = ((attrs.match(/(?<![:@\w-])class="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
        /* `:class` dinamico: se mira solo si NOMBRA el modificador activo del bloque */
        const dinamicas = (attrs.match(/:class="([^"]*)"/) || [, ""])[1];
        const sobra = estaticas.filter((c) =>
          !/^(absolute|relative|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|flex|inline-flex|sm:|md:|lg:|truncate)/.test(c)
          && !/^(deasy|admin-related)-/.test(c));

        filas.push({
          grupo: esTab ? "G7" : "G8",
          f: ruta.slice(SRC.length + 1), linea: tpl.slice(0, m.index).split("\n").length,
          tag, etiqueta: etiqueta.slice(0, 32), sobra,
          bloque: estaticas.some((c) => (esTab ? BLOQUE_TAB : BLOQUE_NAV).test(c)),
          activoPorBloque: /deasy-(inline-tab|nav-item|section-nav)--(active|subtle-active)/.test(dinamicas + " " + estaticas.join(" ")),
          tieneActivo: Boolean(dinamicas) || /--active/.test(estaticas.join(" ")),
        });
      }
    }

    if (!auto && !VOID.has(tag.toLowerCase())) {
      pila.push({ tag, tablist: enTablist, zonaNav: enZonaNav });
    }
  }
}

const motivos = (r) => [
  r.tag !== "button" ? `${r.tag}: navegar no es ejecutar — usa el bloque de ${r.grupo}` : null,
  !r.bloque ? `sin el bloque del sistema (${r.grupo === "G7" ? "deasy-inline-tab" : "deasy-nav-item / -action / -group-title"})` : null,
  r.bloque && r.tieneActivo && !r.activoPorBloque
    ? "pinta el estado activo a mano en vez de con el modificador --active" : null,
  r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 4).join(" ")}` : null,
].filter(Boolean);

const mal = filas.filter((r) => motivos(r).length);

if (process.argv.includes("--listar")) {
  for (const g of ["G7", "G8"]) {
    const del = filas.filter((r) => r.grupo === g);
    console.log(`\n${g} — ${del.length} elementos:\n`);
    for (const r of del) console.log(`  ${r.f}:${r.linea}  «${r.etiqueta}»${motivos(r).length ? "  ✖" : "  ✔"}`);
  }
  process.exit(0);
}

if (mal.length > TECHO) {
  const n7 = mal.filter((r) => r.grupo === "G7").length;
  console.error(`\ncheck:nav-actions FALLA — ${mal.length} (G7: ${n7} · G8: ${mal.length - n7}) fuera del bloque (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs) console.error(`     :${String(r.linea).padEnd(5)} [${r.grupo}] «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  console.error("\nUna pestaña es `deasy-inline-tab` + `--active`; un elemento de menu es");
  console.error("`deasy-nav-item` + `--active`. NO salen de AppButton: un boton no tiene «actual».\n");
  process.exit(1);
}
const n7 = filas.filter((r) => r.grupo === "G7").length;
console.log(`check:nav-actions OK — ${filas.length} elementos de navegacion (G7: ${n7} · G8: ${filas.length - n7}), todos por su bloque.`);
