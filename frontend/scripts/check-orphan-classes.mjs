#!/usr/bin/env node
/**
 * Clases HUERFANAS: las que una plantilla escribe y ningun CSS declara.
 *
 * POR QUE EXISTE
 * `css-prune.mjs` cubre el sentido contrario (clase declarada sin consumidor). Este cubre el que
 * no vigilaba nadie y que ademas es el que se ve: un gancho de clase que no pinta NADA. Cuando se
 * midio por primera vez habia ~26 nombres en ~40 sitios, restos de refactores en los que el CSS se
 * borro y el atributo se quedo. Ni el build, ni `eslint`, ni `stylelint`, ni los tests ven uno:
 * `stylelint` solo mira `src/**\/*.css` y para el resto una clase es una cadena de texto.
 *
 * LO QUE NO PUEDE VER, Y POR QUE NO SE INTENTA
 * Una clase compuesta en runtime — `` `deasy-tag--${variant}` ``, `classList.add('show')` — no
 * aparece en ningun atributo `class`. Este script NO las inventa: solo mira lo que esta escrito.
 * Por eso su salida es «revisa esto», no «borra esto».
 *
 * EL FILTRO QUE IMPORTA
 * La mayoria de las clases de una plantilla son utilidades de Tailwind, que por definicion no
 * estan declaradas en nuestro CSS. Distinguirlas POR SINTAXIS es un pozo: hay variantes apiladas,
 * selectores de atributo entre corchetes, fracciones y nombres de grupo con barra. Se hace al
 * reves y es exacto: se consideran NUESTRAS solo las que empiezan por uno de los prefijos de
 * familia declarados abajo. Una clase propia con un nombre fuera de esa lista es, precisamente, el
 * problema que persigue el gate `selector-class-pattern`.
 *
 * ⚠️ Y por eso este comentario NO trae ejemplos escritos: Tailwind v4 escanea el codigo fuente
 * buscando candidatos a clase, ESTE FICHERO INCLUIDO. La primera version citaba tres utilidades de
 * ejemplo en la prosa y las tres acabaron EMITIDAS en el CSS construido. Verificado en el diff.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");
const STYLES = join(SRC, "shared/styles");

/* Las familias de nombres propias. Al colapsarlas sobre `deasy-` esta lista encoge con ellas. */
const PREFIJOS = [
  "deasy-", "admin-", "graph-", "hope-action", "btnsera", "sera-", "profile-",
  "pdf-preview", "custom-", "signature-", "theme-info", "available-formats", "unit-graph",
];

/* Clases de terceros: las inyecta una libreria, no las declaramos y no son huerfanas. */
const TERCEROS = /^(router-link-|vue-flow__|leaflet-|v-|swiper-)/;

const ficheros = (dir, ext, acc = []) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) ficheros(ruta, ext, acc);
    else if (ext.some((e) => nombre.endsWith(e))) acc.push(ruta);
  }
  return acc;
};

/* Lo declarado. Se lee de TODO el CSS, no solo de `shared/styles`, por si alguna vez vuelve a
   haber una hoja suelta: preferimos un falso negativo a acusar a una clase que si existe. */
const declaradas = new Set();
for (const ruta of ficheros(SRC, [".css"])) {
  const css = readFileSync(ruta, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, nombre] of css.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) declaradas.add(nombre);
}

/* Lo escrito. Solo atributos `class` estaticos: un `:class` con expresion no es texto literal. */
const usos = new Map();
for (const ruta of ficheros(SRC, [".vue"])) {
  if (ruta.startsWith(STYLES)) continue;
  const fuente = readFileSync(ruta, "utf8");
  for (const [, valor] of fuente.matchAll(/(?<![:@\w-])class="([^"]*)"/g)) {
    for (const clase of valor.split(/\s+/).filter(Boolean)) {
      if (clase.includes("{") || clase.includes("$")) continue;
      if (TERCEROS.test(clase)) continue;
      if (!PREFIJOS.some((p) => clase.startsWith(p))) continue;
      if (declaradas.has(clase)) continue;
      if (!usos.has(clase)) usos.set(clase, []);
      usos.get(clase).push(ruta.slice(SRC.length + 1));
    }
  }
}

if (usos.size === 0) {
  console.log("check:orphan-classes OK — ninguna clase propia sin regla.");
  process.exit(0);
}

console.error(`check:orphan-classes — ${usos.size} clases propias que NO declara ningun CSS:\n`);
for (const [clase, rutas] of [...usos].sort((a, b) => b[1].length - a[1].length)) {
  console.error(`  ${clase}  (${rutas.length})`);
  for (const ruta of [...new Set(rutas)]) console.error(`      ${ruta}`);
}
console.error(
  "\nCada una es o un gancho que sobra (borrala de la plantilla) o una regla que falta" +
  "\n(escribela en su modulo). Lo que no vale es dejarla: no pinta nada y parece que si.",
);
process.exit(1);
