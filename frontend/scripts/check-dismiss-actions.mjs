#!/usr/bin/env node
/* G3 · CERRAR / CANCELAR — censo por ESTRUCTURA, tercero de la familia.
 *
 * G3 se censo dos veces mal. La primera por `data-modal-dismiss`, que perdio 5 «Cerrar» que
 * cierran por su propio @click. La segunda por FUNCION —el verbo de la etiqueta—, que encontro 14
 * huecos mas pero seguia dependiendo de que alguien escribiera «Cerrar» o «Cancelar»: un boton que
 * ponga «Volver», «Listo» o «Ahora no» cierra igual y no lo veria ninguno de los dos.
 *
 * Ni el `v-for` de G2 ni el contenedor de G6 sirven aqui: un boton de cerrar no se repite y vive
 * en cualquier sitio (un modal, una alerta, un panel lateral, el chat). Su señal es lo que le HACE
 * al contenedor:
 *
 *   > Un boton es de cierre cuando su accion hace DESAPARECER aquello en lo que vive.
 *
 * Eso se ve en el @click: emitir `close`/`cancel`/`dismiss`, poner a `null` o `false` la variable
 * que abre el contenedor, o llamar a un `closeX()` / `dismissX()` / `hideX()`.
 *
 * ⚠️ Falsos amigos descartados: `closeDetail` seguido de otra accion no cuenta si el boton hace
 * algo mas (guardar Y cerrar es G11, envio); y `$emit("update:open", false)` de un armazon es el
 * armazon cerrandose a si mismo, no un boton.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;   /* trinquete: G3 quedo limpio el 2026-08-15 y de ahi no sube */

const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "area", "col"]);
const PULSABLE = /^(button|AppButton|AdminButton|AppCloseButton|AppDeleteButton)$/;

/* Lo que hace desaparecer al contenedor */
const CIERRA = [
  /\$emit\(\s*['"](close|cancel|dismiss|closed)['"]/,        /* emite el cierre */
  /^\s*(close|dismiss|hide)[A-Z$_]/,                          /* closeModal(), dismissToast()… */
  /^\s*(close|dismiss|hide)\s*\(/,                            /* close() a secas */
  /=\s*null\s*$/,                                             /* selectedEdge = null */
  /=\s*false\s*$/,                                            /* showPanel = false */
  /=\s*['"]{2}\s*$/,                                          /* errorMessage = "" — cierra la alerta */
];
const DISMISS_ATTR = /\bdata-modal-dismiss\b/;

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
    if (!DISMISS_ATTR.test(attrs) && !CIERRA.some((re) => re.test(accion))) continue;
    /* Si ademas guarda, crea o envia, no es un boton de cierre: es el de confirmar (G11). */
    if (/\b(save|submit|confirm|create|update|delete|remove|apply|send)[A-Z(]/i.test(accion)
        && !/^\s*(close|dismiss|hide)/.test(accion)) continue;

    const desde = m.index + todo.length;
    const cuerpo = auto ? "" : tpl.slice(desde, desde + 300).split(new RegExp(`</${tag}>`))[0];
    const texto = cuerpo.replace(/<[^>]*>/g, "").trim();
    const etiqueta = (attrs.match(/(?<![:@\w-])(?:title|aria-label|label)="([^"]*)"/) || [])[1] || texto || "?";

    const variante = (attrs.match(/(?<![:@\w-])variant="([a-zA-Z]+)"/) || [, null])[1];
    const clases = ((attrs.match(/(?<![:@\w-])class(?:-name)?="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
    const sobra = clases.filter((c) =>
      !/^(absolute|relative|fixed|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|flex|inline-flex|sm:|md:|lg:)/.test(c)
      && !/^(top-|right-|bottom-|left-|-?translate-|z-)/.test(c)
      && !/^(deasy|graph)-/.test(c));

    filas.push({
      f: ruta.slice(SRC.length + 1), linea: tpl.slice(0, m.index).split("\n").length,
      tag, etiqueta: etiqueta.slice(0, 30), variante, texto: Boolean(texto), sobra,
      sistema: clases.some((c) => /^deasy-/.test(c)),
    });
  }
}

/* La ✕ (sin texto) es AppCloseButton; la de texto sale de AppButton, y ahi manda la ETIQUETA:
   «Cancelar» descarta lo escrito y por eso es `dangerOutline`; cerrar sin más no descarta nada
   y es `neutralOutline`.

   ⚠️ LOS DOS NOMBRES CAMBIARON EL 2026-08-16 y este gate los tenia escritos a mano — `cancel`
   y `secondary`—, asi que dio 47 falsos positivos sobre codigo correcto. Es el segundo de los
   diecinueve al que le pasa en el mismo commit, y por el mismo motivo: los demas leen el mapa
   de variantes del propio componente, y estos dos guardaban una COPIA de la convencion. La
   copia caduca; el mapa no.

   Y la distincion que vigila sigue siendo la misma, solo que ahora el nombre la dice: cancelar
   es una accion con consecuencia (se pierde lo escrito) y por eso va en el tono de peligro;
   cerrar no la tiene y va en el neutro. Antes habia que saberselo. */
const CANCELAR = "dangerOutline";
const CERRAR = "neutralOutline";

const motivos = (r) => {
  const et = r.etiqueta.toLowerCase();
  return [
    !r.texto && r.tag !== "AppCloseButton" && r.tag !== "AppDeleteButton"
      ? "la ✕ de cerrar sale de AppCloseButton" : null,
    r.texto && r.tag === "button" && !r.sistema ? "<button> CRUDO" : null,
    r.texto && /^cancelar/.test(et) && r.variante && r.variante !== CANCELAR
      ? `dice «Cancelar» y usa ${r.variante}` : null,
    r.texto && /^cerrar/.test(et) && r.variante && r.variante !== CERRAR
      ? `dice «Cerrar» y usa ${r.variante}` : null,
    r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 4).join(" ")}` : null,
  ].filter(Boolean);
};

const mal = filas.filter((r) => motivos(r).length);

if (process.argv.includes("--listar")) {
  const sinVerbo = filas.filter((r) => !/cerrar|cancelar|close|dismiss|salir|volver/i.test(r.etiqueta));
  console.log(`\n${filas.length} botones de cierre. ${sinVerbo.length} SIN verbo de cierre en la etiqueta`);
  console.log("(esos son los que un censo por FUNCION no habria visto):\n");
  for (const r of sinVerbo) console.log(`  ${r.f}:${r.linea}  «${r.etiqueta}»  [${r.tag}${r.variante ? " " + r.variante : ""}]`);
  process.exit(0);
}

if (mal.length > TECHO) {
  console.error(`\ncheck:dismiss-actions FALLA — ${mal.length} botones de cierre fuera del componente (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs) console.error(`     :${String(r.linea).padEnd(5)} «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  console.error("\nLa ✕ es AppCloseButton. El de texto es AppButton, y manda la etiqueta:");
  console.error(`«Cancelar» → variant="${CANCELAR}"; cerrar sin descartar nada → variant="${CERRAR}".\n`);
  process.exit(1);
}
console.log(`check:dismiss-actions OK — ${filas.length} botones de cierre, todos por el componente.`);
