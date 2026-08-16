#!/usr/bin/env node
/**
 * El CONTADOR de valores arbitrarios: `X-[…]`. No los prohibe — vigila que no suban.
 *
 * POR QUE UN TECHO Y NO CERO
 * Un valor arbitrario no es un error por si mismo: `max-h-[calc(100vh-4rem)]` no tiene escalon
 * posible y esta bien escrito. Lo que era deuda es la ACUMULACION sin criterio — llego a haber
 * 423, con ocho tamanos de fuente distintos por debajo de 14 px y trece radios. Prohibirlos de
 * golpe obligaria a inventar tokens para casos unicos, que es la otra forma del mismo problema.
 *
 * Asi que esto es un trinquete: el techo baja cuando el trabajo lo baja, y nunca sube. Si tu
 * cambio lo pasa, o usas un escalon de la escala o bajas el techo en el mismo commit explicando
 * por que ese valor no tiene escalon.
 *
 * LOS TRES QUE MAS DUELEN, y por que van contados aparte:
 *   `text-[…]`     la escala tipografica bajo 14 px tiene DOS escalones (`text-theme-xs/sm`)
 *   `rounded-[…]`  el sistema tiene DOS radios: control (lg) y superficie (2xl)
 *   `shadow-[…]`   lo que flota lleva `shadow-theme-*`; lo que se apoya, borde
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/* El techo. SOLO BAJA.
 *
 * 2026-08-13 · 374 / text- 144 / rounded- 29 / shadow- 31 — mirando solo `.vue` y `.js`.
 * 2026-08-14 · 416 / text- 155 / rounded- 35 / shadow- 36 — **el gate abre tambien los `.css`**.
 *
 * ⚠️ El techo SUBIO una vez, y esta es esa vez: no porque creciera la deuda, sino porque el gate
 * estaba mirando a otro lado. Recorria `.vue` y `.js` y NO abria las hojas de estilo, asi que los
 * valores arbitrarios escritos dentro de un `@apply` —en el propio sistema de diseño— no los
 * contaba nadie. Son 42, repartidos en 10 modulos, y entre ellos **cinco radios distintos**
 * (`10px` x2, `12px`, `1rem`, `0.85rem`, `0.8rem`) y **once tamanos de texto**, con
 * `tables.css` escribiendo `text-[12px]` mientras `misc.css` usa `text-theme-xs`: el mismo valor
 * de dos formas, en la misma carpeta.
 *
 * A partir de aqui vuelve a ser un trinquete y solo baja. Bajarlo es la fase 5 del plan de la
 * 3.ª vuelta (`docs/planes/sistema-diseno-componentes/`), que es donde se decide la escala.
 */
/* 2026-08-14 · 414 / rounded- 33 — mueren los dos `rounded-[10px]` de `deasy-filter-btn` al
 * adoptar la base la geometria de TailAdmin: ese radio existia SOLO para no ser el 16 px de la
 * base, y con la base en 8 el filtro dejo de necesitar geometria propia. */
/* 2026-08-14 · 412 / shadow- 35 — el menu de seccion adopta el «button group» de TailAdmin y
 * pierde su `shadow-[var(--focus-ring)]` y su `min-w-[9.5rem]`: la sombra pasa al contenedor
 * (`shadow-theme-xs`, que es escalon de la escala) y el ancho lo da el contenido. */
const TECHO = { total: 300, "text-": 120, "rounded-": 13, "shadow-": 16 };

const SRC = resolve(process.argv[2] ?? "src");
const RE = /\b([a-z][a-z-]*-)\[[^\]]+\]/g;

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") || r.endsWith(".js") || r.endsWith(".css")) acc.push(r);
  }
  return acc;
};

/* ⚠️ En un `.css` hay que quitar los comentarios ANTES de contar. Estos modulos se documentan
   citando las clases de las que hablan —`overrides.css` nombra un radio arbitrario en prosa al
   explicar por que murio—, y esas citas no son usos: inflarian el contador y, peor, no bajarian
   nunca al arreglar el codigo. En `.vue`/`.js` no se toca nada: cambiarlo moveria el censo
   heredado y el techo dejaria de ser comparable. */
const fuente = (ruta) => {
  const texto = readFileSync(ruta, "utf8");
  return ruta.endsWith(".css") ? texto.replace(/\/\*[\s\S]*?\*\//g, "") : texto;
};

const cuenta = { total: 0 };
const porFichero = new Map();
for (const ruta of ficheros(SRC)) {
  let n = 0;
  for (const [, prefijo] of fuente(ruta).matchAll(RE)) {
    cuenta.total += 1;
    n += 1;
    if (prefijo in TECHO) cuenta[prefijo] = (cuenta[prefijo] ?? 0) + 1;
  }
  if (n) porFichero.set(ruta.slice(SRC.length + 1), n);
}

let mal = false;
for (const [clave, techo] of Object.entries(TECHO)) {
  const hoy = cuenta[clave] ?? 0;
  if (hoy > techo) {
    mal = true;
    console.error(`✖ ${clave.padEnd(10)} ${hoy} > ${techo} (techo)`);
  }
}

if (mal) {
  console.error("\nLos cinco ficheros que mas acumulan:");
  for (const [f, n] of [...porFichero].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.error(`  ${String(n).padStart(4)}  ${f}`);
  }
  console.error(
    "\nUsa un escalon de la escala, o baja el techo en `scripts/check-no-arbitrary.mjs`" +
    "\nEN EL MISMO COMMIT, explicando por que ese valor no tiene escalon posible.",
  );
  process.exit(1);
}

const bajados = Object.entries(TECHO)
  .filter(([k, v]) => (cuenta[k] ?? 0) < v)
  .map(([k, v]) => `${k}${cuenta[k] ?? 0}/${v}`);
console.log(
  `check:no-arbitrary OK — ${cuenta.total}/${TECHO.total} valores arbitrarios.` +
  (bajados.length ? ` Por debajo del techo: ${bajados.join(" ")} (bajalo).` : ""),
);
