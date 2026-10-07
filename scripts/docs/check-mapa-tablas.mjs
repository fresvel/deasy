#!/usr/bin/env node
// La puerta del mapa de las tablas. Tres comprobaciones, y cada una caza algo distinto.
//
//   A · COBERTURA   cada tabla del esquema está en exactamente un dominio, con su nivel
//   B · NIVEL       ninguna clave ajena apunta a un nivel SUPERIOR
//   C · PROPIEDAD   cada tabla la escribe un solo sitio del código
//
// Por qué las tres: A caza la tabla nueva que se queda fuera del mapa. B caza que el modelo se
// enrede — el día que una tabla de abajo apunte a una de arriba, el orden de lectura deja de
// existir y nadie se entera porque PostgreSQL no tiene opinión. C caza la escritura duplicada,
// que es donde dos sitios aplican la misma regla y uno se queda atrás.
//
// ⚠️ ESTA PUERTA TUVO CINCO COMPROBACIONES. Las dos que faltan (D, los recursos de permiso, y E,
// los subgrupos de los mapas dibujados) se retiraron el 2026-10-04, el mismo día que se pusieron.
// Lo que hacían era declarar las DIFERENCIAS entre esta clasificación y las otras dos, y fallar si
// cambiaban: documentaban el desorden y lo protegían. Si alguna vez se echan de menos, están en el
// historial de git en el commit que las creó.
//
// ⚠️ C NACE CON DEUDA DECLARADA, y a propósito. Son los casos que ya existían al poner la puerta,
// cada uno con su motivo en `_deuda_escritura`. Falla con cualquiera NUEVO; cerrar los declarados
// se hace quitándolos de la lista, nunca ampliándola para callarla.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leerMapa, tablasDelEsquema, clavesAjenas, RUTA_MAPA } from "./lib/mapa.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ESQUEMA = join(RAIZ, "backend", "database", "postgres_schema.sql");

const mapa = leerMapa();
const tablas = tablasDelEsquema(ESQUEMA);
const fallos = [...mapa.fallos];
const avisos = [];

// ── 0 · La PALABRA ───────────────────────────────────────────────────────────────────────────
// Tres palabras, tres significados: DOMINIO (de qué trata, 8) · NIVEL (de qué depende, 0..7) ·
// CAPA (routes/controllers/services/datos, dentro del código). Se fijó el 2026-10-07 y se vigila
// aquí porque YA SE MEZCLÓ: en la primera versión del mapa los dos ejes se llamaban «dominio» y
// «capa», así que un «capa 3» heredado habla de un NIVEL y uno nuevo habla de `services/`. La fuente
// única no puede volver a decir ninguna de las dos.
{
  const crudo = readFileSync(RUTA_MAPA, "utf8");
  for (const palabra of ["tema", "temas", "capa", "capas"]) {
    if (new RegExp(`\\b${palabra}\\b`, "i").test(crudo)) {
      fallos.push(
        `0 · 'dominios.json' dice '${palabra}'. Son DOMINIO (de qué trata), NIVEL (de qué depende) ` +
        `y CAPA (routes/controllers/services/datos, sólo dentro del código). Ver lib/mapa.mjs`
      );
    }
  }
}

// ── A · Cobertura ─────────────────────────────────────────────────────────────────────────────
for (const tabla of tablas) {
  if (!mapa.dominioDe.has(tabla)) {
    fallos.push(`A · la tabla '${tabla}' no está en ningún dominio. Añádela a scripts/docs/dominios.json`);
  }
}
for (const tabla of mapa.dominioDe.keys()) {
  if (!tablas.includes(tabla)) {
    fallos.push(`A · el mapa nombra '${tabla}' (dominio '${mapa.dominioDe.get(tabla)}') y no existe en el esquema`);
  }
}

// ── B · El nivel ──────────────────────────────────────────────────────────────────────────────
const fks = clavesAjenas(ESQUEMA);
let bajan = 0;
let iguales = 0;
for (const { origen, columna, destino } of fks) {
  const a = mapa.nivelDe.get(origen);
  const b = mapa.nivelDe.get(destino);
  if (a === undefined || b === undefined) continue;
  if (b < a) bajan++;
  else if (b === a) iguales++;
  else {
    fallos.push(
      `B · ${origen}.${columna} → ${destino} sube del nivel ${a} al ${b}. ` +
        `O la tabla está en el nivel equivocado, o la relación va al revés`
    );
  }
}

// ── C · Propiedad de escritura ────────────────────────────────────────────────────────────────
// El «sitio» de un fichero son sus dos primeras componentes bajo `backend/` (`services/users`,
// `controllers/users`), que es lo más fino que hoy distingue de verdad. Lo que importa aquí es que
// haya UN escritor, no en qué carpeta vive: el día que el código se reparta por dominios, esto pasa a
// comprobar que el escritor es el dominio dueño.
//
// ⚠️ LA EXENCIÓN ES POR FICHERO, NO POR CARPETA (desde el 2026-10-07, F7.1). Antes se eximían
// `services/admin` y `services/system` enteras --31 ficheros, 15 de ellos escritores-- y sólo 3 lo
// merecen. Lo que tapaba era real pero pequeño: una tabla, `fill_requests`.
//
// Y los FLUJOS (`_flujos`) no están eximidos a secas: cada uno declara QUÉ dominios escribe, y la
// comprobación D falla si escribe uno que no declaró.
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

const sitioDe = (p) => {
  const partes = relative(join(RAIZ, "backend"), p).split(sep);
  return partes[0] === "services" || partes[0] === "controllers" ? partes.slice(0, 2).join("/") : partes[0];
};

const rutaDe = (p) => relative(join(RAIZ, "backend"), p).split(sep).join("/");
const contenidos = ficheros(join(RAIZ, "backend")).map((p) => [rutaDe(p), sitioDe(p), readFileSync(p, "utf8")]);
const transversales = new Set(mapa.transversales);
const flujos = mapa.flujos;
const eximido = (ruta) => transversales.has(ruta) || Object.hasOwn(flujos, ruta);

for (const tabla of tablas) {
  const escribe = new RegExp(`(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(?:\\w+\\.)?${tabla}\\b`, "i");
  const sitios = new Set();
  for (const [ruta, s, c] of contenidos) if (escribe.test(c) && !eximido(ruta)) sitios.add(s);
  if (sitios.size <= 1) {
    if (deuda[tabla]) avisos.push(`C · '${tabla}' ya solo tiene un escritor: quita su línea de _deuda_escritura`);
    continue;
  }
  if (deuda[tabla]) continue;
  fallos.push(
    `C · '${tabla}' la escriben ${sitios.size} sitios: ${[...sitios].sort().join(" · ")}. ` +
      `Una tabla tiene un dominio dueño; el invariante va donde no se pueda esquivar, no en cada llamador`
  );
}

// ── D · Los flujos escriben sólo lo que declaran ──────────────────────────────────────────────
// Un flujo cruza dominios por diseño y por eso está fuera de la comprobación C. El precio es que
// declare CUÁLES: si mañana alguien le añade una escritura a un cuarto dominio, esto lo para.
for (const [ruta, decl] of Object.entries(flujos)) {
  const fila = contenidos.find(([r]) => r === ruta);
  if (!fila) {
    fallos.push(`D · '_flujos' nombra '${ruta}' y ese fichero no existe. Si se movió, actualiza el mapa`);
    continue;
  }
  const declarados = new Set(decl.dominios ?? []);
  for (const d of declarados) {
    if (!Object.hasOwn(mapa.dominios, d)) fallos.push(`D · el flujo '${ruta}' declara el dominio '${d}', que no existe`);
  }
  const escritos = new Set();
  for (const tabla of tablas) {
    const escribe = new RegExp(`(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+(?:\\w+\\.)?${tabla}\\b`, "i");
    if (escribe.test(fila[2])) escritos.add(mapa.dominioDe.get(tabla));
  }
  for (const d of escritos) {
    if (!declarados.has(d)) {
      fallos.push(
        `D · el flujo '${ruta}' escribe tablas de '${d}' y no lo declara en '_flujos'. ` +
          `Decláralo con su motivo, o saca esa escritura al \`datos/\` de su dominio`
      );
    }
  }
  for (const d of declarados) {
    if (!escritos.has(d)) avisos.push(`D · el flujo '${ruta}' declara '${d}' y ya no escribe ninguna de sus tablas: quítalo`);
  }
  if (escritos.size <= 1) avisos.push(`D · '${ruta}' ya sólo escribe un dominio: deja de ser un flujo y se mueve a él`);
}

// ── E · El `datos/` de un dominio sólo nombra SUS tablas ──────────────────────────────────────
// La mitad limpia del acceso a datos, y es la única regla de esta puerta que se puede comprobar sobre
// las LECTURAS. Medido el 2026-10-07: el 29 % de las consultas del backend cruza dominios, así que
// prohibirlo sería absurdo — pero se puede exigir que lo que cruza esté SEPARADO:
//
//     dominios/<d>/datos/            SOLO tablas de <d>        <- esto comprueba E
//     dominios/<d>/datos/consulta/   lo que necesite           <- exento, es su contrato
//
// Sin esa separación `datos/` podría nombrar cualquier tabla y nada distinguiría una lectura legítima
// que cruza de un error. Con ella, la mitad propia queda vigilada.
{
  const RAIZ_DOM = join(RAIZ, "backend", "dominios");
  if (existsSync(RAIZ_DOM)) {
    for (const dominio of readdirSync(RAIZ_DOM, { withFileTypes: true })) {
      if (!dominio.isDirectory()) continue;
      if (!Object.hasOwn(mapa.dominios, dominio.name)) {
        fallos.push(`E · 'backend/dominios/${dominio.name}' no es un dominio del mapa`);
        continue;
      }
      const carpetaDatos = join(RAIZ_DOM, dominio.name, "datos");
      if (!existsSync(carpetaDatos)) continue;
      for (const p of ficheros(carpetaDatos)) {
        const rel = relative(join(RAIZ, "backend"), p).split(sep).join("/");
        if (rel.includes("/datos/consulta/")) continue;   // su contrato ES cruzar
        const cuerpo = readFileSync(p, "utf8").replace(/--[^\n]*/g, " ");
        for (const tabla of tablas) {
          if (!new RegExp(`\\b${tabla}\\b`).test(cuerpo)) continue;
          const duena = mapa.dominioDe.get(tabla);
          if (duena !== dominio.name) {
            fallos.push(
              `E · '${rel}' nombra '${tabla}', que es de '${duena}'. El \`datos/\` de un dominio sólo ` +
                `nombra SUS tablas; lo que cruza va a '${dominio.name}/datos/consulta/'`
            );
          }
        }
      }
    }
  }
}

// ── A-bis · Los esquemas de la base son los dominios ──────────────────────────────────────────────
// Desde el 2026-10-04 cada dominio es un esquema de PostgreSQL, así que el `SET search_path` del
// fichero del esquema tiene que listar exactamente estos ocho dominios, más `public` al final (donde
// viven las 12 funciones de los disparadores).
//
// Si se separan, el fallo no se ve al arrancar: las consultas de un dominio entero empiezan a
// responder «relation does not exist» mientras el resto funciona. La otra mitad de esta vigilancia
// --que el pool del backend use la misma lista-- está en `backend/config/postgres.searchPath.test.js`,
// que sí puede leer los dos ficheros que compara.
const sqlEsquema = readFileSync(ESQUEMA, "utf8");
const lineaRuta = sqlEsquema.match(/^SET search_path = (.+);$/m);
if (!lineaRuta) {
  fallos.push("A-bis · postgres_schema.sql no lleva un 'SET search_path = ...;' en una línea");
} else {
  const declarados = lineaRuta[1].split(",").map((x) => x.trim());
  const dominios = Object.keys(mapa.dominios);
  const esperado = [...dominios, "public"];
  if (declarados.join(",") !== esperado.join(",")) {
    fallos.push(
      `A-bis · el search_path del esquema no coincide con los dominios del mapa.\n       esquema: ${declarados.join(", ")}\n       mapa:    ${esperado.join(", ")}`
    );
  }
  for (const tabla of tablas) {
    const dominio = mapa.dominioDe.get(tabla);
    if (!dominio) continue;
    if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${dominio}\\.${tabla}\\b`).test(sqlEsquema)) {
      fallos.push(
        `A-bis · el mapa dice que '${tabla}' es de '${dominio}' y el esquema no la crea en ese esquema de la base`
      );
    }
  }
}

// ── Veredicto ─────────────────────────────────────────────────────────────────────────────────
const n = (x) => String(x).padStart(3);
console.log(`Mapa de tablas:  ${Object.keys(mapa.dominios).length} dominios · 8 niveles · ${tablas.length} tablas`);
console.log(`Claves ajenas:   ${n(bajan)} bajan de nivel · ${n(iguales)} en su nivel · ${n(fks.length - bajan - iguales)} suben`);
console.log(`Deuda declarada: ${Object.keys(deuda).length} tablas con más de un escritor`);
console.log(`Declarados:      ${transversales.size} transversales · ${Object.keys(flujos).length} flujos que cruzan dominios`);

for (const a of avisos) console.log(`\n  ⚠ ${a}`);

if (fallos.length) {
  console.error(`\n✖ ${fallos.length} fallo(s):\n`);
  for (const f of fallos) console.error(`   · ${f}`);
  console.error("");
  process.exit(1);
}
console.log("\n✔ El mapa cuadra con el esquema y con el código.");
