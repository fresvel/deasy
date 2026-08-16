#!/usr/bin/env node
/* G2 · ACCION DE FILA — censo por ESTRUCTURA, no por donde yo crea que estan las listas.
 *
 * Los tres censos anteriores fallaron por lo mismo: buscaban donde ya sabian que habia algo.
 * `data-modal-dismiss` perdio 5 botones (G3), `deasy-filter-btn` perdio home y perfil (G6), y
 * mirar solo AdminTableActions/DossierDocumentActions/HomeSignatureEntry perdio los paneles de
 * los grafos (G2). El intento de arreglarlo restringiendo a `<td>` devolvio CERO, porque aqui
 * las tablas se pintan por metadata y las listas de panel son `<ul>`.
 *
 * La senal fiable no es el contenedor: es el `v-for`. Un boton dentro de un `v-for` actua sobre
 * UN elemento de una coleccion repetida, y eso es exactamente lo que significa «accion de fila»
 * — de un `<tr>`, de un `<li>` de panel o de una tarjeta, da igual.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;   /* trinquete: G2 quedo en 48/48 el 2026-08-15 y de ahi no sube */
const VOID = new Set(["input", "img", "br", "hr", "meta", "link", "source", "area", "col"]);
const PULSABLE = /^(button|AppButton|AdminButton|AppDeleteButton|AppCloseButton|BtnSera)$/;

const ficheros = (d, a = []) => {
  for (const n of readdirSync(d)) {
    const r = join(d, n);
    statSync(r).isDirectory() ? ficheros(r, a) : (r.endsWith(".vue") && !r.includes(".test.")) && a.push(r);
  }
  return a;
};

const filas = [];

for (const ruta of ficheros(SRC)) {
  const bruto = readFileSync(ruta, "utf8");
  const tpl = bruto.replace(/<!--[\s\S]*?-->/g, "").split(/\n<script/)[0];

  /* Pila de ancestros. Cada entrada sabe si ELLA o alguno por encima trae v-for. */
  const pila = [];
  const RE = /<(\/?)([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

  for (const m of tpl.matchAll(RE)) {
    const [todo, cierra, tag, attrs, auto] = m;

    if (cierra) {
      for (let i = pila.length - 1; i >= 0; i--) {
        if (pila[i].tag === tag) { pila.length = i; break; }
      }
      continue;
    }

    const propioVfor = /\bv-for=/.test(attrs);
    const heredaVfor = pila.some((p) => p.vfor);
    const enLista = heredaVfor || propioVfor;

    /* `text-left` o `w-full` es la firma de que el boton OCUPA la fila entera: es el item
       seleccionable (un resultado de busqueda, un documento de la cola), no una accion sobre el. */
    const esLaFila = /\b(text-left|w-full)\b/.test(attrs);
    if (PULSABLE.test(tag) && heredaVfor && !propioVfor && !esLaFila) {
      /* El cuerpo: hasta su cierre, para saber si lleva texto visible o solo icono */
      const desde = m.index + todo.length;
      const cuerpo = auto ? "" : tpl.slice(desde, desde + 400).split(new RegExp(`</${tag}>`))[0];
      const texto = cuerpo.replace(/<[^>]*>/g, "").trim();   /* {{ }} cuenta: es texto visible */
      const etiqueta = (attrs.match(/(?<![:@\w-])(?:title|aria-label|label|message)="([^"]*)"/) || [])[1] || texto || "?";

      const variante = (attrs.match(/(?<![:@\w-])variant="([a-zA-Z]+)"/) || [, null])[1];
      const varDinamica = /:variant=/.test(attrs);
      const clases = ((attrs.match(/(?<![:@\w-])class(?:-name)?="([^"]*)"/) || [, ""])[1]).split(/\s+/).filter(Boolean);
      /* posicion y separacion las decide el contenedor: no cuentan como estilo por fuera */
      const sobra = clases.filter((c) =>
        !/^(absolute|relative|shrink-0|self-|ml-auto|mr-auto|m[trblxy]?-\d|w-full|flex|inline-flex)/.test(c)
        && !/deasy-tile|deasy-picker|deasy-stepper__|deasy-nav-avatar|graph-node__badge|^(deasy|graph|btnsera)-/.test(c)                      /* clase del sistema: esta en su sitio */
        && !/^(top-|right-|bottom-|left-|-?translate-|opacity-|group-hover:|z-|transition-opacity|(focus|lg|sm|md):opacity-)/.test(c));  /* posicion: la decide el contenedor */

      filas.push({
        f: ruta.slice(SRC.length + 1), linea: tpl.slice(0, m.index).split("\n").length,
        tag, etiqueta: etiqueta.slice(0, 30), variante, varDinamica,
        icono: /\\bicon-only\\b/.test(attrs), texto: Boolean(texto), sobra,
        sistema: clases.some((c) => /^(deasy|graph)-/.test(c)),
      });
    }

    if (!auto && !VOID.has(tag.toLowerCase())) {
      pila.push({ tag, vfor: enLista });
    }
  }
}

/* Conforme: componente propio del sistema, sin estilo por fuera, y —si es de solo icono—
   con variante suave. Un boton de fila CON TEXTO es legitimo (un «Abrir» ancho), pero
   tiene que salir del componente igual.

   ⚠️ EL SUFIJO ERA UN PREFIJO HASTA EL 2026-08-16. Las variantes se llamaban `softSuccess`;
   hoy se llaman `successSoft`, porque el nombre dice antes el tono que el modo y asi la
   matriz de variantes se lee por filas. Este gate fue el unico de los diecinueve que se
   entero del renombrado —los demas leen los mapas del componente— y grito con 14 falsos
   positivos. Vale como recordatorio: una convencion de nombres codificada en un script es
   una copia de la verdad, y las copias caducan. */
const SUAVE = /Soft$/;

const motivos = (r) => [
  r.tag === "button" && !r.sistema ? "<button> CRUDO" : null,
  r.tag === "AppButton" || r.tag === "AdminButton"
    ? (!r.variante && !r.varDinamica ? "sin variante" : null) : null,
  (r.tag === "AppButton" || r.tag === "AdminButton") && r.variante && !r.texto && !SUAVE.test(r.variante)
    ? `icono con variante ${r.variante}, no es {tono}Soft` : null,
  r.sobra.length ? `estilo por fuera: ${r.sobra.slice(0, 4).join(" ")}` : null,
].filter(Boolean);

const mal = filas.filter((r) => motivos(r).length);

if (mal.length > TECHO) {
  console.error(`\ncheck:row-actions FALLA — ${mal.length} acciones de fila fuera del componente (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of mal) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs) console.error(`     :${String(r.linea).padEnd(5)} «${r.etiqueta}»  →  ${motivos(r).join(" · ")}`);
  }
  console.error("\nUna accion de fila sale de AppButton con variante {tono}Soft, o de un bloque propio");
  console.error("del sistema (deasy-inline-action, deasy-chip-remove). Nunca con utilidades sueltas.\n");
  process.exit(1);
}
console.log(`check:row-actions OK — ${filas.length} acciones de fila, todas por el componente.`);