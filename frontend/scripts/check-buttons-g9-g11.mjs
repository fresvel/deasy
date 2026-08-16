#!/usr/bin/env node
/* G9 · AUTH · G10 · SOLO ICONO · G11 · ENVIO — los tres ultimos grupos pequeños.
 *
 * Van en un script porque los tres son chicos y ninguno merece su propio fichero, pero cada uno
 * conserva SU señal: mezclarlas fue el error que dejo G2 abierto.
 *
 *   G9  · AUTH        — vive en `modules/auth/`. Es la unica señal de UBICACION de toda la
 *                       familia, y esta justificada: lo que define al grupo no es lo que hace el
 *                       boton sino que la pantalla se ve sin sesion, con su propia caja y su
 *                       propio ancho. `deasy-auth-button` murio el 2026-08-15 (era la QUINTA
 *                       geometria); lo que queda tiene que salir del sistema como todo lo demas.
 *   G10 · SOLO ICONO  — su cuerpo no tiene texto visible. Es el grupo que el inventario llamaba
 *                       «el unico limpio», y lo era porque solo conto 6 de los ~90 que hay.
 *   G11 · ENVIO       — `type="submit"`. La señal mas nitida de las once: o lo lleva o no.
 *
 * ⚠️ Los tres SOLAPAN con otros grupos a proposito, y eso no es un fallo del censo: el boton de
 * «Ingresar» es G9 (vive en auth), G11 (es submit) y podria ser G1. Un boton pertenece a varios
 * grupos porque los grupos son PREGUNTAS distintas sobre el mismo objeto. Lo que no puede es
 * conformar en uno e incumplir en otro.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;

const PULSABLE = /^(button|AppButton|AdminButton|AppCloseButton|AppDeleteButton|BtnSera)$/;
/* Bloques propios del sistema: un boton que lleva uno NO necesita salir de AppButton */
const BLOQUE = /^(deasy-tile|deasy-picker|deasy-btn|deasy-inline-tab|deasy-inline-action|deasy-inline-icon-button|deasy-chip-remove|deasy-pdf-action|deasy-fab|deasy-nav-|deasy-stepper__|deasy-section-nav|deasy-counter-nav|deasy-option|graph-|btnsera)/;

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
  const tpl = readFileSync(ruta, "utf8").replace(/<!--[\s\S]*?-->/g, "").split(/\n<script/)[0];
  /* La DEFINICION de un componente propio no es un uso suyo: ahi el markup crudo es el punto. */
  if (/^shared\/components\/(buttons|widgets)\/App\w+\.vue$/.test(corto)) continue;
  const enAuth = corto.startsWith("modules/auth/");
  const RE = /<(\/?)([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

  for (const m of tpl.matchAll(RE)) {
    const [todo, cierra, tag, attrs, auto] = m;
    if (cierra || !PULSABLE.test(tag)) continue;

    const desde = m.index + todo.length;
    const cuerpo = auto ? "" : tpl.slice(desde, desde + 400).split(new RegExp(`</${tag}>`))[0];
    const texto = cuerpo.replace(/<[^>]*>/g, "").trim();
    const tieneIcono = /<(Icon[A-Z]\w*|svg|font-awesome-icon|component)\b/.test(cuerpo) || /\bicon-only\b/.test(attrs);

    const esSubmit = /\btype="submit"/.test(attrs);
    /* `w-full` + `text-left` = el boton ES la fila entera (una tarjeta pulsable), no un boton
       de icono. Misma exclusion que en el censo de G2. */
    const esLaFila = /\bw-full\b/.test(attrs) && /\btext-left\b/.test(attrs);
    const soloIcono = tieneIcono && !texto && !esLaFila;
    if (!enAuth && !soloIcono && !esSubmit) continue;

    const grupos = [enAuth && "G9", soloIcono && "G10", esSubmit && "G11"].filter(Boolean);

    const clases = ((attrs.match(/(?<![:@\w-])class(?:-name)?="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
    const sobra = clases.filter((c) =>
      !/^(absolute|relative|fixed|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|w-auto|flex|inline-flex|sm:|md:|lg:|xl:|truncate|group)/.test(c)
      && !/^(top-|right-|bottom-|left-|inset-|my-auto|mx-auto|-?translate-|opacity-|group-hover:|z-|transition-opacity|(focus|lg|sm|md):opacity-)/.test(c)
      && !BLOQUE.test(c));

    filas.push({
      grupos, f: corto, linea: tpl.slice(0, m.index).split("\n").length,
      tag, etiqueta: ((attrs.match(/(?<![:@\w-])(?:title|aria-label|label)="([^"]*)"/) || [])[1] || texto || "?").slice(0, 28),
      variante: (attrs.match(/(?<![:@\w-])variant="([a-zA-Z]+)"/) || [, null])[1],
      dinamica: /:variant=/.test(attrs),
      iconOnly: /\bicon-only\b/.test(attrs), soloIcono, sobra,
      bloque: clases.some((c) => BLOQUE.test(c)),
    });
  }
}

const motivos = (r) => [
  r.tag === "button" && !r.bloque ? "<button> CRUDO — usa AppButton o un bloque del sistema" : null,
  (r.tag === "AppButton" || r.tag === "AdminButton") && !r.variante && !r.dinamica ? "sin variante" : null,
  /* G10: si el componente no lleva texto, tiene que DECIRLO con icon-only — si no, se le aplica
     el padding de un boton con etiqueta y el icono queda descentrado. */
  r.soloIcono && (r.tag === "AppButton" || r.tag === "AdminButton") && !r.iconOnly
    ? "solo icono pero sin `icon-only`: el padding es el de un boton con texto" : null,
  r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 4).join(" ")}` : null,
].filter(Boolean);

const mal = filas.filter((r) => motivos(r).length);
const cuenta = (g) => filas.filter((r) => r.grupos.includes(g)).length;

if (process.argv.includes("--listar")) {
  for (const g of ["G9", "G10", "G11"]) {
    const del = filas.filter((r) => r.grupos.includes(g));
    console.log(`\n${g} — ${del.length} elementos:\n`);
    for (const r of del) console.log(`  ${motivos(r).length ? "✖" : "✔"} ${r.f}:${r.linea}  «${r.etiqueta}»`);
  }
  process.exit(0);
}

if (mal.length > TECHO) {
  console.error(`\ncheck:buttons-g9-g11 FALLA — ${mal.length} fuera del sistema (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs) console.error(`     :${String(r.linea).padEnd(5)} [${r.grupos.join("+")}] «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  console.error("\n`deasy-auth-button` murio el 2026-08-15: las pantallas de acceso usan el boton del");
  console.error("sistema con `deasy-btn--block` cuando quieren ocupar la fila. No la resucites.\n");
  process.exit(1);
}
console.log(`check:buttons-g9-g11 OK — G9: ${cuenta("G9")} auth · G10: ${cuenta("G10")} solo icono · G11: ${cuenta("G11")} envio.`);
