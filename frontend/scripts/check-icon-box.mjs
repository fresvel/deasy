#!/usr/bin/env node
/* F3.1 · LA CAJA DE ICONO — el cuadrado centrado que sostiene un icono.
 *
 * Su señal es puramente FORMAL, no funcional: `flex` + `items-center` + `justify-center` + un
 * alto y un ancho IGUALES + un radio. Es la unica de la familia que no pregunta que hace el
 * elemento sino que forma tiene, y es correcto que asi sea: una caja de icono no hace nada — la
 * accion, si la hay, la tiene el boton que la contiene.
 *
 * Antes de F3.1 habia 42 usos en 32 recetas (76 % de unicidad), con ONCE tamaños, TRES radios y
 * ONCE fondos. En el CSS no existia ninguna clase: lo que habia eran SEIS fragmentos privados de
 * otros componentes —`deasy-nav-item__icon`, `deasy-dropzone__icon`, `btnsera-status__icon`,
 * `deasy-form-section__icon`, `deasy-tag__icon` y `deasy-deliverable-action__chip`— o sea seis
 * componentes reinventando la misma caja dentro de su fichero.
 *
 * 🪤 Y el sintoma que lo delataba: CUATRO sitios usaban `deasy-alert` como caja de icono y le
 * tapaban el borde despues. Un componente de MENSAJE DE ESTADO usado por su color, porque no
 * existia una caja tintada.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] ?? "src";
const TECHO = 0;

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
  for (const m of tpl.matchAll(/class="([^"]*)"/g)) {
    const c = m.group ? m.group(1) : m[1];
    const s = new Set(c.split(/\s+/).filter(Boolean));
    if (!((s.has("flex") || s.has("inline-flex")) && s.has("items-center") && s.has("justify-center"))) continue;
    const h = c.match(/\bh-(\[[^\]]+\]|[\d.]+)\b/);
    const w = c.match(/\bw-(\[[^\]]+\]|[\d.]+)\b/);
    const r = c.match(/\brounded-(\[[^\]]+\]|\w+)\b/);
    if (!(h && w && r) || h[1] !== w[1]) continue;   /* cuadrada: mismo alto que ancho */
    filas.push({
      f: ruta.slice(SRC.length + 1), linea: tpl.slice(0, m.index).split("\n").length,
      receta: [...s].filter((x) => /^(h-|w-|rounded-|bg-)/.test(x)).join(" "),
    });
  }
}

if (filas.length > TECHO) {
  console.error(`\ncheck:icon-box FALLA — ${filas.length} cajas de icono escritas a mano (techo ${TECHO})\n`);
  const porFichero = {};
  for (const r of filas) (porFichero[r.f] ??= []).push(r);
  for (const [f, rs] of Object.entries(porFichero).sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${f}  (${rs.length})`);
    for (const r of rs.slice(0, 5)) console.error(`     :${String(r.linea).padEnd(5)} ${r.receta}`);
    if (rs.length > 5) console.error(`     … y ${rs.length - 5} mas`);
  }
  console.error("\nLa caja de icono es `deasy-icon-box` + su tamaño (--sm/--md/--lg/--xl) y, si lleva");
  console.error("color, su tono (--primary/--info/--success/--warning/--danger/--neutral).\n");
  process.exit(1);
}
console.log("check:icon-box OK — ninguna caja de icono escrita a mano.");
