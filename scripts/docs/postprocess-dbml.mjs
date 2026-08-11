#!/usr/bin/env node
//
// Toma el DBML crudo que produce `db2dbml` y lo convierte en los artefactos publicables:
// el consolidado y un fichero por dominio.
//
// Corre DENTRO del contenedor de node que lanza `scripts/docs/gen-dbml.sh`. No se ejecuta
// suelto: espera rutas absolutas del contenedor.
//
// Lo que añade sobre el crudo:
//   1. Cabecera de "esto es un artefacto, no lo edites".
//   2. `note:` en las columnas GENERADAS (STORED). db2dbml no las marca, pero PostgreSQL
//      sabe cuáles son, así que se derivan en vez de mantenerse a mano — que es como
//      estaban antes, y por eso derivaron.
//   3. Las anotaciones semánticas de `docs/02-dominio-datos/anotaciones.json`.
//   4. El troceo por dominios.
//
// Falla —a propósito, y ruidosamente— si:
//   · una tabla del esquema no está en ningún dominio, o está en dos;
//   · una anotación nombra una tabla o columna que no existe.
// Las dos cosas son documentación que dejó de describir algo, y en silencio no sirven de nada.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [rawPath, generatedColsPath, anotacionesPath, dominiosPath, outDir] = process.argv.slice(2);

const raw = readFileSync(rawPath, 'utf8');
const generadas = readFileSync(generatedColsPath, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const anotaciones = JSON.parse(readFileSync(anotacionesPath, 'utf8'));
const dominios = JSON.parse(readFileSync(dominiosPath, 'utf8'));

const fallos = [];

// ── Trocear el crudo en bloques ────────────────────────────────────────────────────────────
// db2dbml emite `Table "x" { ... }` y `Ref "nombre":"a"."c" > "b"."d"`. Se parsea por bloques
// en vez de con una gramática: el formato es estable y una dependencia más no se paga sola.
const tablas = new Map();          // nombre -> texto del bloque
const refs = [];                   // { texto, origen, destino }

const reTabla = /^Table\s+"([^"]+)"\s*\{\n([\s\S]*?)^\}\n/gm;
let m;
while ((m = reTabla.exec(raw)) !== null) {
  tablas.set(m[1], { cabecera: m[1], cuerpo: m[2] });
}

// Los operadores de cardinalidad de db2dbml son `<`, `>`, `-`, y sus variantes opcionales
// `<?`, `?<?`, `>?`... El `?` marca lado nullable. Olvidarlo dejaba fuera las 139 relaciones.
for (const linea of raw.split('\n')) {
  if (!linea.startsWith('Ref')) continue;
  const mm = /"([^"]+)"\."[^"]+"\s*[<>?~-]+\s*"([^"]+)"\."[^"]+"/.exec(linea);
  if (mm) refs.push({ texto: linea, origen: mm[1], destino: mm[2] });
  else fallos.push(`Ref que no se pudo parsear: ${linea}`);
}

// Parte una línea de columna en declaración y atributos.
//
// No se hace con un regex a propósito: los atributos pueden llevar CORCHETES DENTRO, en
// expresiones entre backticks. `item_mode` es el caso real:
//
//   "item_mode" text [not null, check: `item_mode = ANY (ARRAY['single'::text, ...])`, default: 'single']
//                                                          ^^^^^^^^^^^^^^^^^^^^^^^^
// Un `\[([^\]]*)\]` corta en el primer `]` de ARRAY[...] y descuadra la línea entera.
// Así que se escanea buscando el primer `[` que esté FUERA de backticks.
function partirColumna(linea) {
  let enBacktick = false, inicio = -1;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '`') enBacktick = !enBacktick;
    else if (c === '[' && !enBacktick) { inicio = i; break; }
  }
  if (inicio === -1) return { decl: linea.replace(/\s+$/, ''), attrs: null };
  const fin = linea.lastIndexOf(']');
  if (fin < inicio) return null;
  return {
    decl: linea.slice(0, inicio).replace(/\s+$/, ''),
    attrs: linea.slice(inicio + 1, fin),
  };
}

// Aplica `transformar(attrs) -> attrs'` a la columna `columna` de la tabla `t`.
// Devuelve false si la columna no está, para que quien llama lo reporte.
function editarColumna(t, columna, transformar) {
  const lineas = t.cuerpo.split('\n');
  const idx = lineas.findIndex(l => new RegExp(`^\\s*"${columna}"\\s`).test(l));
  if (idx === -1) return false;
  const partes = partirColumna(lineas[idx]);
  if (!partes) return false;
  const nuevos = transformar(partes.attrs);
  lineas[idx] = `${partes.decl} [${nuevos}]`;
  t.cuerpo = lineas.join('\n');
  return true;
}

if (tablas.size === 0) fallos.push('No se parseó ninguna tabla del DBML crudo. ¿Cambió el formato de db2dbml?');

// ── 2. note: en las columnas generadas ─────────────────────────────────────────────────────
let notasPuestas = 0;
for (const ref of generadas) {
  const [tabla, columna] = ref.split('.');
  const t = tablas.get(tabla);
  if (!t) { fallos.push(`Columna generada en tabla desconocida: ${ref}`); continue; }
  const nota = 'note: "columna generada (STORED)"';
  const ok = editarColumna(t, columna, attrs => (attrs ? `${attrs}, ${nota}` : nota));
  if (!ok) { fallos.push(`No se encontró la columna ${ref} en el DBML`); continue; }
  notasPuestas++;
}

// ── 3. Anotaciones semánticas ──────────────────────────────────────────────────────────────
const esc = s => s.replace(/'/g, "\\'");
let notasTabla = 0, notasColumna = 0;

for (const [tabla, nota] of Object.entries(anotaciones.tablas ?? {})) {
  const t = tablas.get(tabla);
  if (!t) { fallos.push(`anotaciones.json: la tabla '${tabla}' no existe en el esquema`); continue; }
  t.cuerpo = `${t.cuerpo.replace(/\s*$/, '')}\n\n  Note: '''${esc(nota)}'''\n`;
  notasTabla++;
}

for (const [ref, nota] of Object.entries(anotaciones.columnas ?? {})) {
  const [tabla, columna] = ref.split('.');
  const t = tablas.get(tabla);
  if (!t) { fallos.push(`anotaciones.json: la tabla '${tabla}' (de '${ref}') no existe`); continue; }
  const n = `note: '''${esc(nota)}'''`;
  const ok = editarColumna(t, columna, attrs => (attrs ? `${attrs}, ${n}` : n));
  if (!ok) { fallos.push(`anotaciones.json: la columna '${ref}' no existe`); continue; }
  notasColumna++;
}

// ── 1. Cabecera ────────────────────────────────────────────────────────────────────────────
const CABECERA = (extra) => `// ============================================================================
// ARTEFACTO GENERADO — NO EDITAR A MANO.
//
// Lo produce \`bash scripts/docs/gen-dbml.sh\` levantando un PostgreSQL desechable,
// aplicando \`backend/database/postgres_schema.sql\` e introspeccionando la base.
// Cualquier cambio hecho aquí se pierde en la siguiente regeneración, y la puerta
// de CI (.github/workflows/docs-dbml.yml) lo detecta.
//
// ¿Quieres explicar qué SIGNIFICA una tabla o una columna?
//   -> docs/02-dominio-datos/anotaciones.json  (eso sí se escribe a mano)
// ${extra}
// ============================================================================

`;

const bloqueTabla = (nombre) => {
  const t = tablas.get(nombre);
  return `Table "${nombre}" {\n${t.cuerpo.replace(/\s*$/, '')}\n}\n`;
};

// ── Consolidado ────────────────────────────────────────────────────────────────────────────
const nombresOrdenados = [...tablas.keys()].sort();
let consolidado = CABECERA(`Diagramas por dominio: docs/02-dominio-datos/dominios/`);
consolidado += `Project deasy {\n  database_type: 'PostgreSQL'\n  Note: '''Modelo de datos de Deasy. ${tablas.size} tablas.'''\n}\n\n`;
consolidado += nombresOrdenados.map(bloqueTabla).join('\n');
consolidado += '\n' + refs.map(r => r.texto).join('\n') + '\n';

// ── 4. Dominios ────────────────────────────────────────────────────────────────────────────
const asignadas = new Map();
for (const [clave, dom] of Object.entries(dominios)) {
  if (clave.startsWith('_')) continue;
  for (const t of dom.tablas) {
    if (asignadas.has(t)) fallos.push(`La tabla '${t}' está en dos dominios: '${asignadas.get(t)}' y '${clave}'`);
    asignadas.set(t, clave);
    if (!tablas.has(t)) fallos.push(`dominios.json: la tabla '${t}' (dominio '${clave}') no existe en el esquema`);
  }
}
for (const t of tablas.keys()) {
  if (!asignadas.has(t)) fallos.push(`La tabla '${t}' no está en ningún dominio. Añádela a scripts/docs/dominios.json`);
}

if (fallos.length) {
  console.error('\n✖ El post-procesado del DBML falló:\n');
  for (const f of fallos) console.error(`   · ${f}`);
  console.error('');
  process.exit(1);
}

const domDir = join(outDir, 'dominios');
if (existsSync(domDir)) rmSync(domDir, { recursive: true });
mkdirSync(domDir, { recursive: true });

const resumen = [];
for (const [clave, dom] of Object.entries(dominios)) {
  if (clave.startsWith('_')) continue;
  const suyas = new Set(dom.tablas);
  const internos = refs.filter(r => suyas.has(r.origen) && suyas.has(r.destino));
  const salientes = refs.filter(r => suyas.has(r.origen) !== suyas.has(r.destino));

  let txt = CABECERA(`Dominio: ${dom.titulo}. Reparto: scripts/docs/dominios.json`);
  txt += `Project ${clave} {\n  database_type: 'PostgreSQL'\n  Note: '''${esc(dom.titulo)} — ${esc(dom.descripcion)}'''\n}\n\n`;
  txt += dom.tablas.slice().sort().map(bloqueTabla).join('\n');
  txt += '\n' + internos.map(r => r.texto).join('\n') + '\n';

  // Las relaciones que SALEN del dominio se listan como comentario. Si no, el diagrama
  // se lee como si el dominio viviera aislado, que es justo lo que no hace.
  if (salientes.length) {
    txt += `\n// ── Relaciones con otros dominios (no se dibujan aquí) ──\n`;
    for (const r of salientes.sort((a, b) => a.texto.localeCompare(b.texto))) {
      const fuera = suyas.has(r.origen) ? r.destino : r.origen;
      txt += `//   ${r.origen} -> ${r.destino}   [${asignadas.get(fuera) ?? '?'}]\n`;
    }
  }

  writeFileSync(join(domDir, `${clave}.dbml`), txt);
  resumen.push({ clave, tablas: dom.tablas.length, internos: internos.length, salientes: salientes.length });
}

writeFileSync(join(outDir, 'consolidado.dbml'), consolidado);

console.log(`  tablas:              ${tablas.size}`);
console.log(`  relaciones:          ${refs.length}`);
console.log(`  columnas generadas:  ${notasPuestas}`);
console.log(`  notas de tabla:      ${notasTabla}`);
console.log(`  notas de columna:    ${notasColumna}`);
console.log(`  dominios:            ${resumen.length}`);
for (const r of resumen) {
  console.log(`     ${r.clave.padEnd(14)} ${String(r.tablas).padStart(2)} tablas · ${String(r.internos).padStart(2)} refs internas · ${r.salientes} salientes`);
}
