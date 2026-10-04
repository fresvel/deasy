#!/usr/bin/env node
// La puerta del mapa de módulos. Tres comprobaciones, y cada una caza algo distinto.
//
//   A · COBERTURA       cada tabla del esquema está en exactamente un módulo
//   B · ORDEN DE CAPAS  ninguna clave ajena apunta a una capa SUPERIOR
//   C · PROPIEDAD       cada tabla la escribe un solo módulo de código
//   D · RECURSOS RBAC   ningún recurso de permiso crece hacia un módulo sin declararlo
//   E · MAPAS DIBUJADOS ningún subgrupo de los mapas crece hacia un módulo sin declararlo
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
import { leerMapa, tablasDelEsquema, clavesAjenas, subgruposDibujados, RUTA_MAPA } from "./lib/mapa.mjs";
import { SQL_TABLES } from "../../backend/config/sqlTables.js";

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

// ── D · Los recursos de permiso ───────────────────────────────────────────────────────────────
// Un recurso RBAC no agrupa como un módulo, y no tiene por qué: agrupa por QUIÉN PUEDE ACTUAR, no
// por qué depende de qué. Se midió que juntan lo mismo en un 28 %. Lo que no vale es que un recurso
// se extienda a un módulo nuevo sin que nadie lo decida — eso es dar permiso sobre una parte del
// sistema que no se pensó, y no rompe nada visible.
const crudo = JSON.parse(readFileSync(RUTA_MAPA, "utf8"));
const declaradoRbac = crudo._recursos_rbac ?? {};
const motivosRbac = declaradoRbac._motivos ?? {};

const fuente = readFileSync(join(RAIZ, "backend", "config", "rbacCatalog.js"), "utf8");
const bloqueMapa = fuente.match(/TABLE_RESOURCE_MAP\s*=\s*\{([\s\S]*?)\n\};/);
const recursoDe = new Map();
if (!bloqueMapa) {
  fallos.push("D · no encuentro TABLE_RESOURCE_MAP en backend/config/rbacCatalog.js");
} else {
  for (const linea of bloqueMapa[1].matchAll(/^\s*([a-z_]+)\s*:\s*"([a-z_]+)"/gm)) {
    recursoDe.set(linea[1], linea[2]);
  }
}

// Una tabla que el editor genérico expone y que no tiene recurso queda DENEGADA para todo el mundo
// --el camino es fail-closed a propósito--, y eso se descubre cuando alguien no puede editarla.
const expuestas = SQL_TABLES.map((t) => t.table);
for (const tabla of expuestas) {
  if (!recursoDe.has(tabla)) {
    fallos.push(
      `D · '${tabla}' está en sqlTables.js (la expone /admin) y no tiene recurso en TABLE_RESOURCE_MAP: ` +
        "quedaría denegada para todo el mundo, en silencio"
    );
  }
}
for (const tabla of recursoDe.keys()) {
  if (!tablas.includes(tabla)) {
    fallos.push(`D · TABLE_RESOURCE_MAP nombra '${tabla}' y no existe en el esquema`);
  }
}

const modulosPorRecurso = new Map();
for (const [tabla, recurso] of recursoDe) {
  if (!mapa.moduloDe.has(tabla)) continue;
  if (!modulosPorRecurso.has(recurso)) modulosPorRecurso.set(recurso, new Set());
  modulosPorRecurso.get(recurso).add(mapa.moduloDe.get(tabla));
}
for (const [recurso, modulos] of modulosPorRecurso) {
  const declarados = declaradoRbac[recurso];
  if (!Array.isArray(declarados)) {
    fallos.push(
      `D · el recurso '${recurso}' no está declarado en _recursos_rbac. Abarca ${[...modulos].sort().join(" · ")}`
    );
    continue;
  }
  const esperados = new Set(declarados);
  for (const m of modulos) {
    if (!esperados.has(m)) {
      fallos.push(
        `D · el recurso '${recurso}' ha crecido al módulo '${m}' y no estaba declarado. ` +
          "O la tabla tiene el recurso equivocado, o el recurso abarca más de lo que se pensó"
      );
    }
  }
  for (const m of esperados) {
    if (!modulos.has(m)) avisos.push(`D · '${recurso}' ya no abarca '${m}': quita el módulo de su lista`);
  }
  if (modulos.size > 1 && !motivosRbac[recurso]) {
    fallos.push(`D · '${recurso}' abarca ${modulos.size} módulos y no tiene motivo en _recursos_rbac._motivos`);
  }
}

// ── E · Los subgrupos de los mapas dibujados ──────────────────────────────────────────────────
// Lo mismo por el otro lado. Un subgrupo agrupa por NARRATIVA --«Cómo se te localiza»-- para que el
// dibujo se pueda leer sin conocer el sistema, así que tampoco coincide con los módulos (27 %). Una
// tabla caída en la caja narrativa equivocada no rompe nada y nadie se entera nunca.
const declaradoDibujo = crudo._subgrupos_dibujados ?? {};
const motivosDibujo = declaradoDibujo._motivos ?? {};
const sueltasDeclaradas = new Set(declaradoDibujo._sueltas ?? []);
const dibujados = subgruposDibujados(join(RAIZ, "docs", "src", "content", "docs"), tablas);

const vistas = new Set();
const sueltasVistas = new Set();
for (const [clave, mapaDibujado] of Object.entries(dibujados)) {
  const esperadoDelMapa = declaradoDibujo[clave] ?? {};
  for (const t of mapaDibujado.sueltas) {
    vistas.add(t);
    sueltasVistas.add(t);
    if (!sueltasDeclaradas.has(t)) {
      fallos.push(
        `E · '${t}' está dibujada en ${clave} FUERA de todo subgrupo y no está en _sueltas. ` +
          "O le falta su subgrupo, o es una suelta a conciencia y hay que declararla"
      );
    }
  }
  for (const [id, grupo] of mapaDibujado.grupos) {
    grupo.tablas.forEach((t) => vistas.add(t));
    const declarados = esperadoDelMapa[id];
    const modulos = new Set(grupo.tablas.map((t) => mapa.moduloDe.get(t)).filter(Boolean));
    if (!Array.isArray(declarados)) {
      fallos.push(
        `E · el subgrupo '${id}' («${grupo.titulo}») del mapa ${clave} no está declarado en ` +
          `_subgrupos_dibujados.${clave}. Abarca ${[...modulos].sort().join(" · ")}`
      );
      continue;
    }
    const esperados = new Set(declarados);
    for (const m of modulos) {
      if (!esperados.has(m)) {
        fallos.push(
          `E · el subgrupo '${id}' («${grupo.titulo}») ha crecido al módulo '${m}' y no estaba declarado`
        );
      }
    }
    for (const m of esperados) {
      if (!modulos.has(m)) avisos.push(`E · el subgrupo '${id}' ya no abarca '${m}': quítalo de su lista`);
    }
    if (modulos.size > 1 && !motivosDibujo[id]) {
      fallos.push(`E · '${id}' abarca ${modulos.size} módulos y no tiene motivo en _subgrupos_dibujados._motivos`);
    }
  }
}
for (const t of sueltasDeclaradas) {
  if (!sueltasVistas.has(t)) avisos.push(`E · '${t}' ya no está suelta: quítala de _sueltas`);
}
// Y la red que impide que ESTE lector se separe del que compone las páginas: si los dos no leen la
// misma gramática de mermaid, la suma deja de dar las tablas del esquema.
if (vistas.size !== tablas.length) {
  fallos.push(
    `E · los dos mapas dibujan ${vistas.size} tablas y el esquema tiene ${tablas.length}. ` +
      "Falta dibujar alguna, o el lector de mermaid se ha quedado atrás"
  );
}

// ── Veredicto ─────────────────────────────────────────────────────────────────────────────────
const anchos = (n) => String(n).padStart(3);
console.log(`Mapa de módulos: ${mapa.modulos.size} módulos · ${Object.keys(mapa.dominios).length} dominios · ${tablas.length} tablas`);
console.log(`Claves ajenas:   ${anchos(bajan)} bajan de capa · ${anchos(iguales)} en su capa · ${anchos(fks.length - bajan - iguales)} suben`);
console.log(`Deuda declarada: ${Object.keys(deuda).length} tablas con más de un escritor`);
console.log(`Recursos RBAC:   ${modulosPorRecurso.size} recursos sobre ${recursoDe.size} tablas · ${expuestas.length} expuestas por /admin`);
console.log(`Mapas dibujados: ${Object.values(dibujados).reduce((a, m) => a + m.grupos.size, 0)} subgrupos · ${sueltasVistas.size} tablas sueltas declaradas`);

for (const a of avisos) console.log(`\n  ⚠ ${a}`);

if (fallos.length) {
  console.error(`\n✖ ${fallos.length} fallo(s):\n`);
  for (const f of fallos) console.error(`   · ${f}`);
  console.error("");
  process.exit(1);
}
console.log("\n✔ El mapa cuadra con el esquema y con el código.");
