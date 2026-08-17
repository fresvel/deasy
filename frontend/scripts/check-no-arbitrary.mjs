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
/* 2026-08-16 · 292 / rounded- 11 — muere `deasy-hero-back-button` y con el sus DOS arbitrarios:
 * `min-h-[2.85rem]` (45,6 px, que no era ninguno de los tres tamaños del sistema) y el
 * `rounded-[0.8rem]` de su caja de icono (12,8 px, que no es un paso de la escala). Los dos
 * existian por lo mismo que el `rounded-[10px]` del filtro dos dias antes: para NO ser el valor
 * de la base. Con la base ya unificada, el motivo desaparece y el valor sobra. */
/* 2026-08-16 · 291 — muere el `w-[21.5rem]` del panel lateral al colapsar rail+panel en una sola
 * barra (F4.C·B): el ancho pasa a ser `w-full` dentro de una aside que ya mide 282 px, asi que el
 * numero deja de escribirse dos veces (uno para movil, otro para escritorio) y deja de ser un
 * valor suelto. Es el tercer arbitrario del dia que cae por lo mismo: existia para NO ser el valor
 * de al lado. */
/* 2026-08-16 · 290 — al reconciliar con `develop`, la pestaña «Historial» que llegaba de alli
 * escrita con utilidades sueltas pasa al bloque `deasy-inline-tab`, y con ella se va su
 * `min-w-[1.25rem]`. No es una poda buscada: es lo que pasa cuando un elemento vuelve a su
 * bloque — los valores sueltos que necesitaba para imitarlo dejan de hacer falta. */
/* 2026-08-16 · 189 / text- 17 — **F5.1, la decision del dueño del 13-ago ejecutada**: los 107
 * tamanos de texto por debajo de 12 px (y los 5 que YA median 12 escritos a mano) pasan a
 * `text-theme-xs`, que es el suelo de la escala adoptada. Es la poda mas grande que ha tenido
 * este contador: `text-` cae de 118 a 17 de golpe.
 *
 * ⚠️ Y de los 17 que quedan, DOS NO SON TAMANOS: `text-[#7a869a]` y `text-[#21517a]` son
 * COLORES escritos con la sintaxis de tamaño — la ambiguedad de Tailwind v4 que el skill
 * advierte y que aqui costo 114 nodos con el borde en `currentColor`. Van a la fase de color,
 * no a esta. */
/* 2026-08-17 · 186 — el `w-[282px]` de la `aside` pasa a `w-(--ancho-barra-lateral)`. Al devolver
 * el despliegue por hover, el panel del vistazo necesitaba ESE MISMO ancho, y escribirlo otra vez
 * habria hecho 188. Es el cuarto arbitrario que cae por el mismo motivo de siempre: existia para
 * decir un numero que ya decia otro sitio. Ojo con la sintaxis — `w-(--var)` es el atajo de v4
 * para `w-[var(--var)]` y NO cuenta como arbitrario, que es justo lo que se quiere: el valor pasa
 * a tener un nombre. */
/* 2026-08-17 · 185 — muere el relleno izquierdo del header (68 px, y 80 a partir de `xl`). Existia
 * para reservarle sitio a un logo posicionado en absoluto; al pasar el logo a una celda del flujo
 * que mide lo que mide la barra lateral, el hueco lo da el ancho de la celda. Quinto arbitrario
 * que cae por lo de siempre: era un numero a mano para imitar otro que ya existia.
 *
 * 🪤 Y ESTE CONTADOR LEE LOS COMENTARIOS. Al documentar ese cambio, citar en prosa las dos
 * utilidades que se retiraban las dejo VIVAS en el censo, y el gate salio rojo (187 > 186) por un
 * commit que solo restaba. Es la trampa que `tokens.css` corta para Tailwind con `@source not`,
 * vista por el otro lado: alli la prosa CREA la utilidad, aqui la MANTIENE. En un comentario,
 * describe el valor —«68 px»—, no escribas la clase. */
const TECHO = { total: 159, "text-": 2, "rounded-": 1, "shadow-": 16 };

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
