#!/usr/bin/env node
/**
 * UN `<label>` QUE PARECE UN BOTON TIENE QUE LLEVAR LA RECETA DEL BOTON.
 *
 * ══ DE DONDE SALE (F13.4, 2026-08-21) ═══════════════════════════════════════════════════════
 * El dueño lo vio en pantalla: «¿por que el boton agregar anexo es diferente a toooodos los demas?
 * su radio y altura no estan correctas». Medido, no era un boton:
 *
 *     <label class="inline-flex cursor-pointer items-center gap-2 rounded-2xl border
 *                   border-brand-300 bg-white px-4 py-2 …">
 *       <input type="file" class="hidden" …>
 *
 * `rounded-2xl` son **16 px cuando el sistema usa 8** (F5.2), y `px-4 py-2` sin altura da **~40 px
 * contra los 44** que F4 fijo para todo control. Llevaba meses asi.
 *
 * ⚠️ **Y ningun gate lo vio, ni podia**: los ONCE gates de boton de este frente miran `<button>` y
 * `AppButton`, y esto es un `<label>` que envuelve un `<input type="file">` oculto — la unica forma
 * de abrir el selector de ficheros sin JavaScript, asi que **no puede** ser un `<button>`. Es el
 * punto ciego exacto: un elemento que hace de boton sin serlo.
 *
 * ══ QUE CAZA ════════════════════════════════════════════════════════════════════════════════
 * Un `<label>` cuyo `class` trae señales de boton —`rounded-*`, `border`, `px-*`/`py-*`, `bg-*`—
 * sin llevar `deasy-btn`. No mira los `<label>` de formulario, que no pintan caja: la señal es la
 * CAJA, no la etiqueta.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");
const TECHO = 0;

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

/* Dos señales de «esto pinta una caja»: un radio y un borde o un fondo. Con una sola habria falsos
   positivos —una etiqueta con `px-2` para separar el texto no es un boton—. */
const RADIO = /\brounded(-[a-z0-9]+)?\b/;
const CAJA = /\bborder(-[a-z0-9-]+)?\b|\bbg-[a-z]/;
const fuera = [];
let etiquetas = 0;

for (const f of ficheros(SRC)) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/<label\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g)) {
    const attrs = m[1] || "";
    const c = /\sclass="([^"]*)"/.exec(attrs);
    if (!c) continue;
    etiquetas++;
    const clase = c[1];
    /* ⚠️ SE SALTA CUALQUIER ETIQUETA QUE YA LLEVE UNA RECETA `deasy-*`, no solo `deasy-btn`.
       La primera version solo perdonaba `deasy-btn` y acuso a TRES etiquetas que llevan
       `deasy-elegible` —la receta que F12 creo para «esto esta elegido»—: un `<label>` que envuelve
       un radio y se pinta como tarjeta seleccionable NO es un boton. Lo que este gate persigue es
       la etiqueta pintada **con utilidades sueltas y ninguna receta**, que es como se colo el
       «Agregar anexo».
       (Que esas tres re-declaren `rounded-xl px-3 py-2.5` ENCIMA de su receta es otra deuda, y de
       ella se ocupa `check:overrides`, no esta.) */
    if (/\bdeasy-[a-z]/.test(clase)) continue;
    if (!RADIO.test(clase) || !CAJA.test(clase)) continue;
    fuera.push({ f: f.replace(SRC + "/", ""), n: src.slice(0, m.index).split("\n").length,
                 clase: clase.slice(0, 78) });
  }
}

if (fuera.length > TECHO) {
  console.error(`\ncheck:boton-a-mano — ${fuera.length} etiquetas pintadas como boton (techo ${TECHO})\n`);
  for (const x of fuera) console.error(`   ${x.f}:${x.n}\n      class="${x.clase}"`);
  console.error("\nSi hace de boton, lleva la receta del boton: `deasy-btn` mas su variante y su");
  console.error("tamaño. La forma —radio 8, altura 44— la decide `buttons.css` para todos por igual,");
  console.error("y escribirla a mano es como se colaron los 16 px de radio del «Agregar anexo».\n");
  process.exit(1);
}

console.log(`check:boton-a-mano OK — ${etiquetas} etiquetas con clase, ninguna pintada a mano como boton.`);
