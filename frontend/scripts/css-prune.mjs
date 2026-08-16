#!/usr/bin/env node
/**
 * El sentido CONTRARIO de `check-orphan-classes`: una clase que declaramos y que **no consume
 * nadie**. Reglas que se emiten, ocupan bytes y no llegan a ningun nodo.
 *
 * Este fichero llevaba meses citado y sin existir: el comentario de `check-orphan-classes` decia
 * «`css-prune.mjs` cubre el sentido contrario» y no habia tal fichero. Por eso `deasy-alert--info`
 * vivio sin producir un solo nodo.
 *
 * ══ POR QUE ESTE NO PUEDE MIRAR EL CSS CONSTRUIDO ════════════════════════════════════════════
 * Su hermano si lo hace, y es lo correcto ahi: pregunta «¿existe esta clase?», y quien lo sabe es
 * el CSS emitido. Aqui la pregunta es otra —«¿la usa alguien?»— y el CSS construido **no
 * distingue**: nuestras reglas de `@layer components` son CSS escrito a mano, y se emiten se usen
 * o no. Solo las utilidades de Tailwind desaparecen al no usarse. Asi que la fuente es el codigo.
 *
 * ⚠️ Y POR ESO SU SALIDA ES «REVISA ESTO», NO «BORRA ESTO»
 * Una clase compuesta en runtime no aparece entera en ningun sitio:
 *
 *     el sufijo se pega con una plantilla de cadena a partir de una prop o de un tono
 *
 * Una limpieza automatica se llevo dos de esas y el build, el lint y los 304 tests pasaron en
 * verde **con la barra lateral sin color**. Asi que cuando una clase no aparece literalmente pero
 * SI aparece su raiz —el trozo anterior al ultimo `--` o `__`—, este script la da por
 * posiblemente compuesta y no la acusa. Prefiere el falso negativo.
 *
 * Es un TRINQUETE, como sus hermanos: el techo baja cuando el trabajo lo baja, y no sube.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/* El techo, medido el 2026-08-14. SOLO BAJA. */
const TECHO = 0;

const SRC = resolve(process.argv[2] ?? "src");
const STYLES = join(SRC, "shared/styles");

const ficheros = (dir, ext, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, ext, acc);
    else if (ext.some((e) => n.endsWith(e))) acc.push(r);
  }
  return acc;
};

/* ── 1. LO DECLARADO ────────────────────────────────────────────────────────────────────────────
 * Solo las clases PROPIAS. Una regla que cualifica una utilidad de Tailwind (`.text-muted` dentro
 * de un descendiente) no es una clase nuestra: no se declara, se repinta, y su consumidor es la
 * utilidad. Se distinguen por el patron de familia, que es el mismo que impone `.stylelintrc`. */
const PROPIA = /^(deasy|admin|graph|hope-action|btnsera|sera|profile|pdf-preview|custom|signature-workspace|theme|process-dialog|person)-/;

const declaradas = new Map();
for (const ruta of ficheros(SRC, [".css"])) {
  const css = readFileSync(ruta, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, nombre] of css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
    if (!PROPIA.test(nombre)) continue;
    if (!declaradas.has(nombre)) declaradas.set(nombre, ruta.slice(SRC.length + 1));
  }
}

/* ── 2. LO CONSUMIDO ────────────────────────────────────────────────────────────────────────────
 * Todo el codigo, no solo los atributos `class`: una clase se puede nombrar desde un mapa de
 * JavaScript, un `classList.add` o un test. Se busca la cadena literal.
 *
 * ⚠️ PERO SIN COMENTARIOS, y esto costo un falso verde el mismo dia que se escribio el script.
 * Al retirar una familia de clases se documento la retirada nombrandola en un comentario del
 * componente que la escribia — y ese comentario le dio un CONSUMIDOR FALSO a seis reglas que
 * acababan de quedarse muertas. El gate las dejo pasar y las encontro un `grep` a mano.
 *
 * Es la misma forma de la trampa de Tailwind escaneando los `.mjs`: la documentacion de una
 * clase no es un uso de esa clase. Aqui la diferencia es que **explicar por que borraste algo es
 * lo correcto**, asi que quien tiene que aprender a distinguirlas es el script. */
const sinComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");   /* el `[^:]` salva las URLs */

const codigo = ficheros(SRC, [".vue", ".js"])
  .filter((r) => !r.startsWith(STYLES))
  .map((r) => sinComentarios(readFileSync(r, "utf8")))
  .join("\n");

/* La raiz de una clase BEM: lo anterior al ultimo `--` (modificador) o `__` (elemento). Es lo que
   queda pegado al `${` cuando el sufijo se compone en runtime. */
const raiz = (nombre) => {
  const corte = Math.max(nombre.lastIndexOf("--"), nombre.lastIndexOf("__"));
  return corte > 0 ? nombre.slice(0, corte + 2) : null;
};

const huerfanas = [];
for (const [nombre, modulo] of declaradas) {
  if (codigo.includes(nombre)) continue;
  const base = raiz(nombre);
  if (base && codigo.includes(base)) continue;      /* posiblemente compuesta: no se acusa */
  huerfanas.push([nombre, modulo]);
}

if (process.argv.includes("--censo") || huerfanas.length > TECHO) {
  const rojo = huerfanas.length > TECHO;
  const log = rojo ? console.error : console.log;
  log(`${rojo ? "✖ " : ""}css-prune — ${huerfanas.length} clases propias declaradas y SIN CONSUMIDOR (techo ${TECHO}):\n`);
  for (const [nombre, modulo] of huerfanas.sort()) log(`  ${nombre.padEnd(40)} ${modulo}`);
  if (rojo) {
    console.error(
      "\nUna regla sin consumidor no es una API, es basura: ocupa bytes y no llega a ningun nodo." +
      "\nBorrala de su modulo —mirando si es el UNICO selector de la regla o va en una lista— o," +
      "\nsi se compone en runtime de una forma que este script no ve, baja el techo en" +
      "\n`scripts/css-prune.mjs` EN EL MISMO COMMIT diciendo cual y por que.",
    );
    process.exit(1);
  }
  process.exit(0);
}

console.log(`css-prune OK — ${declaradas.size} clases propias declaradas, todas con consumidor.`);
