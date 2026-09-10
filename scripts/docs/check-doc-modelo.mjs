#!/usr/bin/env node
//
// Vigila que las paginas del sitio sigan hablando del modelo que existe.
//
// ┌─ POR QUE HACE FALTA ────────────────────────────────────────────────────────────────────┐
// │ Todas las capas del repositorio tienen puerta menos esta:                                │
// │                                                                                          │
// │   el esquema  -> gen-dbml.sh --check   los enlaces -> check-enlaces-internos.mjs         │
// │   el codigo   -> 27 gates de lint, check:imports, check:sql-*, char, unitarios           │
// │   LA PROSA    -> NADA                                                                    │
// │                                                                                          │
// │ El build de Astro pasa EN VERDE con una pagina que miente: solo comprueba que compile.   │
// │                                                                                          │
// │ El 2026-08-29 se entrego un frente de nueve tareas con los planes, el CLAUDE.md y el     │
// │ modelo generado al dia, y CUATRO PAGINAS describiendo el sistema anterior. Se descubrio  │
// │ porque el dueno pregunto donde podia verificarlo.                                        │
// └──────────────────────────────────────────────────────────────────────────────────────────┘
//
// TRES CHEQUEOS, y cada uno caza una cosa distinta:
//
//   A · HUERFANOS   una pagina nombra algo que YA NO EXISTE en el esquema.
//                   Es lo que paso con `tipos_documento` y `tipo_id`.
//
//   B · COBERTURA   una tabla del esquema NO la nombra ninguna pagina.
//                   Es lo que paso al anadir `instituciones`: se documento a medias.
//
//   C · HUELLAS     una tabla CAMBIO y la pagina que la describe no se toco.
//                   Caza lo que A y B no pueden: que algo cambie de significado SIN cambiar
//                   de nombre. No afirma que la pagina sea correcta -- afirma que ALGUIEN
//                   LA MIRO. Es el mismo trato que un golden-master.
//
// ⚠️ LO QUE ESTE GATE **NO** PUEDE CAZAR, y conviene saberlo para no confiarse:
//    una frase falsa que no nombre nada muerto. «Se entra por cualquiera de ellos» era falsa
//    y no contiene un solo identificador retirado. Esto reduce el hueco; no lo cierra.
//
// Uso:  node scripts/docs/check-doc-modelo.mjs            comprueba (sale 1 si algo falla)
//       node scripts/docs/check-doc-modelo.mjs --update   re-graba las huellas del chequeo C

import { readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const RAIZ_DOCS = new URL('../../docs/src/content/docs/', import.meta.url).pathname;
const ESQUEMA = new URL('../../backend/database/postgres_schema.sql', import.meta.url).pathname;
const EXCEPCIONES = new URL('./doc-modelo-excepciones.json', import.meta.url).pathname;
const HUELLAS = new URL('./doc-modelo-huellas.json', import.meta.url).pathname;

const actualizar = process.argv.includes('--update');

// ── Lo que EXISTE, leido del esquema ─────────────────────────────────────────────────────────
const sql = readFileSync(ESQUEMA, 'utf8');

const tablas = new Set([...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]));
const vistas = new Set([...sql.matchAll(/CREATE (?:OR REPLACE )?VIEW (\w+)/g)].map((m) => m[1]));
const indices = new Set([...sql.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/g)].map((m) => m[1]));
// Y las RESTRICCIONES CON NOMBRE (`CONSTRAINT chk_… CHECK (…)`, las claves ajenas), que hasta el
// 2026-09-09 no se leian: solo entraban los indices. Los `uq_*` pasaban porque son `CREATE INDEX`;
// el primer `chk_*` que una pagina nombro —`chk_documentos_categoria_visa`— salio "sin clasificar",
// y la salida correcta NO era una excepcion: la restriccion existe y la pagina acierta. Era la
// puerta la que no sabia mirar ahi.
const restricciones = new Set([...sql.matchAll(/\bCONSTRAINT (\w+)/g)].map((m) => m[1]));
const triggers = new Set([
  ...[...sql.matchAll(/CREATE OR REPLACE TRIGGER (\w+)/g)].map((m) => m[1]),
  ...[...sql.matchAll(/CREATE OR REPLACE FUNCTION (\w+)/g)].map((m) => m[1]),
]);

// Columnas: la primera palabra de cada linea DENTRO de un CREATE TABLE.
const columnas = new Set();
let dentro = false;
for (const linea of sql.split('\n')) {
  if (/^CREATE TABLE IF NOT EXISTS \w+/.test(linea)) { dentro = true; continue; }
  if (dentro && linea.startsWith(');')) { dentro = false; continue; }
  const m = dentro && /^\s+([a-z][a-z0-9_]*)\s+[A-Z]/.exec(linea);
  if (m) columnas.add(m[1]);
}
// Los valores de los CHECK y de los INSERT del esquema: `documento_nacional`, `unit_exact`...
const valores = new Set([...sql.matchAll(/'([a-z][a-z0-9_]{3,})'/g)].map((m) => m[1]));

// Y los NOMBRES DE FICHERO del repositorio, que la doc cita constantemente —`user_router`,
// `postgres_schema`— y que no son objetos de base. Sin esto el chequeo A nace con 123 falsos
// positivos y se ignora, que es peor que no tenerlo.
const ficheros = new Set();
const recorrerCodigo = async (dir) => {
  let entradas;
  try { entradas = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entradas) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const ruta = join(dir, e.name);
    if (e.isDirectory()) { ficheros.add(e.name); await recorrerCodigo(ruta); }
    else ficheros.add(e.name.replace(/\..*$/, ''));   // TODAS las extensiones: `x.test.mjs` -> `x`
  }
};
const RAIZ_REPO = new URL('../../', import.meta.url).pathname;
for (const sub of ['backend', 'frontend/src', 'scripts', 'signer', 'docker']) {
  await recorrerCodigo(join(RAIZ_REPO, sub));
}

const EXISTE = new Set([
  ...tablas, ...vistas, ...indices, ...restricciones, ...triggers, ...columnas, ...valores, ...ficheros,
]);

// ── Lo que las paginas NOMBRAN ───────────────────────────────────────────────────────────────
const paginas = [];
const recorrer = async (dir) => {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) await recorrer(ruta);
    else if (e.name.endsWith('.md')) paginas.push(ruta);
  }
};
await recorrer(RAIZ_DOCS);
paginas.sort();

// Un identificador con forma de objeto de base: snake_case entre acentos graves, o un nombre
// que sabemos que existe. Se mira TAMBIEN dentro de los bloques mermaid: un `erDiagram` que
// nombra una tabla borrada miente igual que un parrafo.
const citas = new Map();   // nombre -> Set(pagina)
for (const ruta of paginas) {
  const rel = relative(RAIZ_DOCS, ruta);
  const texto = readFileSync(ruta, 'utf8');
  const enMermaid = [...texto.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
  for (const cuerpo of [texto, enMermaid]) {
    for (const m of cuerpo.matchAll(/`?\b([a-z][a-z0-9_]{3,})\b`?/g)) {
      const n = m[1];
      // `chat_`, `firma_`, `fill_flow_`: en la prosa son COMODINES («las tablas `chat_*`»),
      // no nombres. Terminar en guion bajo los delata.
      if (n.endsWith('_')) continue;
      if (!n.includes('_') && !EXISTE.has(n)) continue;
      if (!citas.has(n)) citas.set(n, new Set());
      citas.get(n).add(rel);
    }
  }
}

const excepciones = JSON.parse(readFileSync(EXCEPCIONES, 'utf8'));

// ── A · HUERFANOS ────────────────────────────────────────────────────────────────────────────
//
// La excepcion se ata a LAS PAGINAS donde vale, no solo al nombre. Perdonar `tipos_documento` en
// la pagina que cuenta por que murio es correcto; perdonarlo en una pagina NUEVA que lo cite como
// si existiera, no. Una excepcion global habria dejado ese hueco abierto para siempre.
const paginasPerdonadas = (n) => {
  const e = (excepciones.nombres ?? {})[n];
  if (e === undefined) return null;
  return new Set(e.paginas ?? []);
};

const huerfanos = [];
for (const [n, donde] of citas) {
  if (EXISTE.has(n)) continue;
  const permitidas = paginasPerdonadas(n);
  if (permitidas === null) { huerfanos.push([n, donde, 'sin clasificar']); continue; }
  const nuevas = [...donde].filter((pag) => !permitidas.has(pag));
  if (nuevas.length) huerfanos.push([n, new Set(nuevas), 'perdonado en otras paginas, NO en estas']);
}
huerfanos.sort((a, b) => b[1].size - a[1].size);

// ── B · COBERTURA ────────────────────────────────────────────────────────────────────────────
const sinDocumentar = [...tablas]
  .filter((t) => !citas.has(t) && !(excepciones.tablas_sin_pagina ?? {})[t])
  .sort();

// ── C · HUELLAS ──────────────────────────────────────────────────────────────────────────────
// La definicion de una tabla es su CREATE TABLE mas todo lo que la nombra despues: indices,
// triggers y claves ajenas. Si cualquiera de esas lineas cambia, la huella cambia.
const definicionDe = (tabla) => {
  const inicio = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${tabla} (`);
  const fin = inicio >= 0 ? sql.indexOf('\n);', inicio) : -1;
  const bloque = inicio >= 0 ? sql.slice(inicio, fin) : '';
  const sueltas = sql
    .split('\n')
    .filter((l) => /^CREATE (UNIQUE )?INDEX|^CREATE OR REPLACE TRIGGER/.test(l) && l.includes(` ${tabla} `))
    .join('\n');
  // Sin comentarios ni espacios: reescribir un comentario NO debe disparar el gate.
  return `${bloque}\n${sueltas}`
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
};

const huellaDe = (tabla) => createHash('sha256').update(definicionDe(tabla)).digest('hex').slice(0, 16);

// La pagina DESCRIBE una tabla si la nombra. Se deriva sola: no hay manifiesto que mantener a
// mano, y por tanto no hay manifiesto que se quede viejo.
const huellasActuales = {};
for (const tabla of [...tablas].sort()) {
  const donde = [...(citas.get(tabla) ?? [])].sort();
  if (donde.length) huellasActuales[tabla] = { huella: huellaDe(tabla), paginas: donde };
}

if (actualizar) {
  // Cada excepcion recuerda DONDE vale hoy. Si manana aparece en otra pagina, el gate lo dice.
  for (const [n, e] of Object.entries(excepciones.nombres ?? {})) {
    if (citas.has(n)) e.paginas = [...citas.get(n)].sort();
  }
  writeFileSync(EXCEPCIONES, `${JSON.stringify(excepciones, null, 2)}\n`);
  writeFileSync(HUELLAS, `${JSON.stringify(huellasActuales, null, 2)}\n`);
  console.log(`✓ huellas re-grabadas: ${Object.keys(huellasActuales).length} tablas documentadas.`);
  process.exit(0);
}

const huellasGrabadas = JSON.parse(readFileSync(HUELLAS, 'utf8'));
const cambiadas = Object.entries(huellasActuales)
  .filter(([t, v]) => huellasGrabadas[t] && huellasGrabadas[t].huella !== v.huella)
  .map(([t, v]) => ({ tabla: t, paginas: v.paginas }));

// ── El informe ───────────────────────────────────────────────────────────────────────────────
let falla = false;

if (huerfanos.length) {
  falla = true;
  console.log(`\n✖ A · ${huerfanos.length} nombre(s) que el sitio cita y NO EXISTEN en el esquema:\n`);
  for (const [n, donde, motivo] of huerfanos) {
    console.log(`   · ${n}   (${motivo})\n       ${[...donde].join('\n       ')}`);
  }
  console.log(`\n  O la pagina esta desactualizada, o la mencion es HISTORICA a proposito.`);
  console.log(`  Si es historica, anadela a scripts/docs/doc-modelo-excepciones.json CON SU MOTIVO.`);
}

if (sinDocumentar.length) {
  falla = true;
  console.log(`\n✖ B · ${sinDocumentar.length} tabla(s) del esquema que NINGUNA pagina nombra:\n`);
  for (const t of sinDocumentar) console.log(`   · ${t}`);
  console.log(`\n  Una tabla que no se cuenta en ninguna parte no existe para quien lea la doc.`);
}

if (cambiadas.length) {
  falla = true;
  console.log(`\n✖ C · ${cambiadas.length} tabla(s) CAMBIARON y su pagina no se ha revisado:\n`);
  for (const c of cambiadas) console.log(`   · ${c.tabla}\n       ${c.paginas.join('\n       ')}`);
  console.log(`\n  Esto NO dice que la pagina este mal: dice que nadie la ha mirado desde el cambio.`);
  console.log(`  Leela, corrigela si hace falta, y despues:`);
  console.log(`      node scripts/docs/check-doc-modelo.mjs --update`);
}

if (falla) process.exit(1);

console.log(
  `✓ doc del modelo: ${tablas.size} tablas · ${citas.size} nombres citados · ` +
  `${Object.keys(huellasActuales).length} tablas con pagina y huella al dia.`
);
