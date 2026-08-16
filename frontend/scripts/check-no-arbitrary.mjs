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

/* El techo, medido el 2026-08-13. SOLO BAJA.
   2026-08-14: total 374 -> 370. Al anadir la pestana de Historial del entregable (defecto 1.10)
   habrian sido cinco copias del mismo `tracking-[0.14em]`; extraerlas a `.deasy-tab` (nav.css)
   quito las cinco. El trinquete funcionando: el techo bajo porque el trabajo lo bajo. */
const TECHO = { total: 370, "text-": 144, "rounded-": 29, "shadow-": 31 };

const SRC = resolve(process.argv[2] ?? "src");
const RE = /\b([a-z][a-z-]*-)\[[^\]]+\]/g;

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") || r.endsWith(".js")) acc.push(r);
  }
  return acc;
};

const cuenta = { total: 0 };
const porFichero = new Map();
for (const ruta of ficheros(SRC)) {
  let n = 0;
  for (const [, prefijo] of readFileSync(ruta, "utf8").matchAll(RE)) {
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
