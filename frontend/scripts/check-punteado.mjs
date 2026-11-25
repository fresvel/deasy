#!/usr/bin/env node
/**
 * EL BORDE DISCONTINUO SALE DE UNA RECETA, NO DE LA PLANTILLA.
 *
 * ══ DE DONDE SALE (F13.8, 2026-08-22) ═══════════════════════════════════════════════════════
 * Grupo 4 de `auditoria-cajas-2026-08-21.md`. Habia **18 apariciones de `border-dashed` y solo 2
 * venian de receta**: `AppEmpty` (el «aqui no hay nada») y `deasy-dropzone__surface` (el «suelta un
 * fichero»). Las otras **16 estaban escritas a mano**, y al mirarlas con su contexto **DOCE eran
 * estados vacios** que ya tenian componente desde F2 — cada uno con su radio, su padding y su
 * icono elegidos a ojo: `rounded-xl` aqui y `rounded-2xl` alla, `py-4`, `py-5`, `py-6` y `p-5`.
 *
 * ⚠️ Y uno de los doce ni siquiera parecia un vacio: `RoutedProcessPanel` escribia su circulo de
 * icono con un `deasy-card` de 56 px, su titulo y su borde, los tres a mano, bajo un
 * `v-else-if="!activeItems.length"` que lo delataba.
 *
 * ══ LO QUE SE PERDONA, Y POR QUE CADA UNO ═══════════════════════════════════════════════════
 * Quedan CUATRO, y ninguno es un vacio:
 *
 *   1. `SignatureBox` — el marcador de firma sobre el PDF. ⚠️ Aqui hay un hallazgo SIN CERRAR: su
 *      caja exterior ya lleva `deasy-firma-caja`, que F12 declaro **con `border-style: dashed`**,
 *      y este div interior dibuja un SEGUNDO discontinuo. Son dos bordes concentricos separados
 *      por 4 px. No se toca porque **no se puede verificar**: hace falta un PDF con campos
 *      colocados, la misma limitacion que F12 dejo escrita para sus 5 casos de firma.
 *   2. `MultiSignerPanel` — el rectangulo de seleccion mientras arrastras sobre el PDF. Es un
 *      gesto en curso, no una superficie.
 *   3. `DeliverableAttachmentsTab` — el bloque de subida, con tinte de marca. No es un vacio ni
 *      una zona de soltar: es un grupo de formulario destacado.
 *   4. `AdminDefinitionRulesPanel` — un `border-t` discontinuo: **es un SEPARADOR, no una caja**.
 *
 * Si aparece un quinto, o es un vacio —y entonces es `AppEmpty`— o hay que decidir si merece
 * receta. Subir el techo sin escribir cual y por que es como se llego a los 16.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");
const TECHO = 4;

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

const fuera = [];
for (const f of ficheros(SRC)) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/border-dashed|border-dotted/g)) {
    fuera.push({ f: f.replace(SRC + "/", ""), n: src.slice(0, m.index).split("\n").length });
  }
}

if (fuera.length > TECHO) {
  console.error(`\ncheck:punteado — ${fuera.length} bordes discontinuos escritos a mano (techo ${TECHO})\n`);
  for (const x of fuera) console.error(`   ${x.f}:${x.n}`);
  console.error("\nUn borde discontinuo dice algo, y quien lo dice es una receta:");
  console.error("    `AppEmpty`                 «aqui no hay nada»");
  console.error("    `deasy-dropzone__surface`  «suelta un fichero aqui»");
  console.error("\nSi lo tuyo es un vacio —lo delata un `v-if=\"!algo.length\"`— usa `AppEmpty`: pone");
  console.error("la caja, el icono y el titulo, y el icono deja de elegirlo cada autor a ojo.");
  console.error("Si no lo es, dilo en la cabecera de este fichero y sube el techo EN EL MISMO COMMIT.\n");
  process.exit(1);
}

console.log(`check:punteado OK — ${fuera.length}/${TECHO} bordes discontinuos a mano, los ${fuera.length} declarados.`);
