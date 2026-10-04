#!/usr/bin/env node
// La puerta del mapa de módulos. Tres comprobaciones, y cada una caza algo distinto.
//
//   A · COBERTURA       cada tabla del esquema está en exactamente un módulo
//   B · ORDEN DE CAPAS  ninguna clave ajena apunta a una capa SUPERIOR
//   C · PROPIEDAD       cada tabla la escribe un solo módulo de código
//
// Por qué las tres y no una: A caza la tabla nueva que se queda fuera del mapa (ya lo hacía el
// post-procesado del DBML, aquí se adelanta y se dice mejor). B caza que el modelo se enrede: el
// día que una tabla de abajo apunte a una de arriba, el orden deja de existir y nadie se entera
// porque PostgreSQL no tiene opinión. C caza la escritura duplicada, que es donde dos sitios
// aplican la misma regla y uno se queda atrás.
//
// ⚠️ C NACE CON DEUDA DECLARADA, y a propósito. Son los casos que ya existían al poner la puerta,
// cada uno con su motivo en `_deuda_escritura`. La puerta falla con cualquiera NUEVO; cerrar los
// declarados se hace quitándolos de la lista, nunca ampliándola para callarla.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leerMapa, tablasDelEsquema, clavesAjenas, RUTA_MAPA } from "./lib/mapa.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ESQUEMA = join(RAIZ, "backend", "database", "postgres_schema.sql");

const mapa = leerMapa();
const tablas = tablasDelEsquema(ESQUEMA);
const fallos = [...mapa.fallos];
const avisos = [];

// ── A · Cobertura ─────────────────────────────────────────────────────────────────────────────
for (const tabla of tablas) {
  if (!mapa.moduloDe.has(tabla)) {
    fallos.push(`A · la tabla '${tabla}' no está en ningún módulo. Añádela a scripts/docs/dominios.json`);
  }
}
for (const tabla of mapa.moduloDe.keys()) {
  if (!tablas.includes(tabla)) {
    fallos.push(`A · el mapa nombra '${tabla}' (módulo '${mapa.moduloDe.get(tabla)}') y no existe en el esquema`);
  }
}

// ── B · Orden de capas ────────────────────────────────────────────────────────────────────────
const fks = clavesAjenas(ESQUEMA);
let bajan = 0;
let iguales = 0;
for (const { origen, columna, destino } of fks) {
  const a = mapa.capaDe.get(origen);
  const b = mapa.capaDe.get(destino);
  if (a === undefined || b === undefined) continue;
  if (b < a) bajan++;
  else if (b === a) iguales++;
  else {
    fallos.push(
      `B · ${origen}.${columna} → ${destino} sube de capa ${a} (${mapa.moduloDe.get(origen)}) a capa ${b} ` +
        `(${mapa.moduloDe.get(destino)}). O la tabla está en la capa equivocada, o la relación va al revés`
    );
  }
}

// ── C · Propiedad de escritura ────────────────────────────────────────────────────────────────
// El «grupo» de un fichero son sus dos primeras componentes bajo `backend/` (`services/users`,
// `controllers/users`), que es lo más fino que hoy distingue de verdad. No se usa el módulo del
// mapa porque las carpetas de código NO coinciden con los módulos del modelo —se midió: coinciden
// un 20 %— y moverlas cuesta 62 ficheros partidos. Lo que importa aquí es que haya UN escritor,
// no en qué carpeta vive.
// Las claves que empiezan por '_' son prosa, no tablas: el '_nota' del bloque explica la lista.
const deuda = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(RUTA_MAPA, "utf8"))._deuda_escritura ?? {}).filter(
    ([clave]) => !clave.startsWith("_")
  )
);

function ficheros(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "tests"].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) ficheros(p, acc);
    else if (/\.m?js$/.test(e.name) && !/\.test\.m?js$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const grupoDe = (p) => {
  const partes = relative(join(RAIZ, "backend"), p).split(sep);
  return partes[0] === "services" || partes[0] === "controllers" ? partes.slice(0, 2).join("/") : partes[0];
};

const contenidos = ficheros(join(RAIZ, "backend")).map((p) => [grupoDe(p), readFileSync(p, "utf8")]);
const transversales = new Set(mapa.transversales);

for (const tabla of tablas) {
  // Las tres formas de escribir. `INSERT INTO`, `UPDATE` y `DELETE FROM` cubren el SQL del repo;
  // un `UPSERT` se escribe aquí como `INSERT INTO ... ON DUPLICATE KEY`, así que entra solo.
  const escribe = new RegExp(`(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+${tabla}\\b`, "i");
  const grupos = new Set();
  for (const [g, c] of contenidos) if (escribe.test(c) && !transversales.has(g)) grupos.add(g);
  if (grupos.size <= 1) {
    if (deuda[tabla]) avisos.push(`C · '${tabla}' ya solo tiene un escritor: quita su línea de _deuda_escritura`);
    continue;
  }
  const lista = [...grupos].sort().join(" · ");
  if (deuda[tabla]) continue;
  fallos.push(
    `C · '${tabla}' la escriben ${grupos.size} sitios: ${lista}. Una tabla tiene un módulo dueño; ` +
      `el invariante va donde no se pueda esquivar, no en cada llamador`
  );
}

// ── Veredicto ─────────────────────────────────────────────────────────────────────────────────
const anchos = (n) => String(n).padStart(3);
console.log(`Mapa de módulos: ${mapa.modulos.size} módulos · ${Object.keys(mapa.dominios).length} dominios · ${tablas.length} tablas`);
console.log(`Claves ajenas:   ${anchos(bajan)} bajan de capa · ${anchos(iguales)} en su capa · ${anchos(fks.length - bajan - iguales)} suben`);
console.log(`Deuda declarada: ${Object.keys(deuda).length} tablas con más de un escritor`);

for (const a of avisos) console.log(`\n  ⚠ ${a}`);

if (fallos.length) {
  console.error(`\n✖ ${fallos.length} fallo(s):\n`);
  for (const f of fallos) console.error(`   · ${f}`);
  console.error("");
  process.exit(1);
}
console.log("\n✔ El mapa cuadra con el esquema y con el código.");
