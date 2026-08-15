#!/usr/bin/env node
/* G5 · DESTRUCTIVO — censo por ESTRUCTURA, quinto de la familia.
 *
 * El censo por funcion de G5 empezo marcando 38 no conformes y estaba MAL: contaba los 17
 * «Limpiar filtros», que no destruyen nada — restablecen una vista. El verbo de la etiqueta no
 * distingue lo uno de lo otro, y por eso aqui la señal es lo que el @click INVOCA:
 *
 *   > Un boton es destructivo cuando su accion borra, desliga o revoca algo que estaba guardado.
 *
 * `delete*`, `remove*`, `detach*`, `unassign*`, `revoke*`, `discard*`, `purge*`.
 *
 * ⚠️ Los falsos amigos de este grupo son los mas traicioneros porque comparten VERBO:
 *   · `removeFilter` / `clearFilters` — restablecen un control (G6), no borran nada
 *   · `clearToast` — cierra una alerta (G3)
 *   · `removePendingAttachment` — SI cuenta: quita un fichero que el usuario ya habia elegido
 *   · `resetWorkflow` — NO cuenta: reinicia una maquina de estados, no borra el entregable
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;   /* trinquete: G5 quedo limpio el 2026-08-15 */

const PULSABLE = /^(button|AppButton|AdminButton|AppDeleteButton)$/;
/* El verbo va en CUALQUIER posicion del manejador, no solo al principio: los que confirman o
   envuelven se llaman `requestDeleteField`, `handleAttachmentDelete`, `confirmDeleteEdge`, y
   buscarlos solo por prefijo perdia 5 de 19. */
const DESTRUYE = /(delete|remove|detach|unassign|revoke|discard|purge|erase)/i;
/* Comparten verbo y no destruyen nada guardado */
const EXCEPTO = [
  /^(remove|clear|delete)(Filter|Toast|Search|Query|Selection|Highlight)/i,
  /=\s*(false|null)\s*$/,   /* `showDeleteModal = false` CANCELA el borrado: eso es G3, no G5 */
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

    const accion = (attrs.match(/@click(?:\.[a-z]+)*="([^"]*)"/) || [, ""])[1];
    if (!DESTRUYE.test(accion) || EXCEPTO.some((re) => re.test(accion.trim()))) continue;

    const desde = m.index + todo.length;
    const cuerpo = auto ? "" : tpl.slice(desde, desde + 300).split(new RegExp(`</${tag}>`))[0];
    const texto = cuerpo.replace(/<[^>]*>/g, "").trim();
    const etiqueta = (attrs.match(/(?<![:@\w-])(?:title|aria-label|label)="([^"]*)"/) || [])[1] || texto || accion.slice(0, 24);

    const clases = ((attrs.match(/(?<![:@\w-])class(?:-name)?="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
    const sobra = clases.filter((c) =>
      !/^(absolute|relative|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|flex|inline-flex|sm:|md:|lg:)/.test(c)
      && !/^(top-|right-|bottom-|left-|-?translate-|opacity-|group-hover:|z-|transition-opacity|(focus|lg|sm|md):opacity-)/.test(c)
      && !/^(deasy|graph)-/.test(c));

    filas.push({
      f: ruta.slice(SRC.length + 1), linea: tpl.slice(0, m.index).split("\n").length,
      tag, etiqueta: etiqueta.slice(0, 30), texto: Boolean(texto),
      variante: (attrs.match(/(?<![:@\w-])variant="([a-zA-Z]+)"/) || [, null])[1],
      dinamica: /:variant=/.test(attrs), sobra,
      /* Los bloques del sistema que YA son destructivos por si mismos */
      bloqueRojo: clases.some((c) => /^(deasy-inline-action--danger|deasy-chip-remove|deasy-pdf-action--danger|graph-edge-btn--danger|graph-icon-btn--danger)$/.test(c)),
      sistema: clases.some((c) => /^(deasy|graph)-/.test(c)),
    });
  }
}

const motivos = (r) => [
  r.tag === "button" && !r.sistema ? "<button> CRUDO — usa AppDeleteButton o AppButton" : null,
  r.tag === "button" && r.sistema && !r.bloqueRojo
    ? "lleva clase del sistema pero NO la destructiva (¿falta el --danger?)" : null,
  /* Ambar tambien vale, y es decision de diseno, no laxitud: distingue borrar el PDF
     —conservando el registro del entregable— de borrar el entregable entero, que va al lado en
     rojo. Los dos destruyen; uno destruye menos. Lo que el gate sigue cazando es un destructivo
     pintado de gris, de azul o sin variante. */
  (r.tag === "AppButton" || r.tag === "AdminButton") && !r.dinamica && !/(danger|warning)/i.test(r.variante || "")
    ? `variante ${r.variante || "(ninguna)"}: lo destructivo se avisa en rojo o en ambar` : null,
  r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 4).join(" ")}` : null,
].filter(Boolean);

const mal = filas.filter((r) => motivos(r).length);

if (process.argv.includes("--listar")) {
  console.log(`\n${filas.length} botones que destruyen algo guardado:\n`);
  for (const r of filas) console.log(`  ${r.f}:${r.linea}  «${r.etiqueta}»  [${r.tag}${r.variante ? " " + r.variante : ""}]`);
  process.exit(0);
}

if (mal.length > TECHO) {
  console.error(`\ncheck:destructive-actions FALLA — ${mal.length} botones destructivos sin marcar (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs) console.error(`     :${String(r.linea).padEnd(5)} «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  console.error("\nBorrar algo guardado se avisa en ROJO, siempre: AppDeleteButton (icono),");
  console.error("AppButton variant=\"danger\"/\"softDanger\" (texto), o el bloque --danger que toque.\n");
  process.exit(1);
}
console.log(`check:destructive-actions OK — ${filas.length} botones destructivos, todos marcados en rojo.`);
