#!/usr/bin/env node
//
// Comprueba que todo enlace interno del sitio apunte a una pagina que existe.
//
// ┌─ POR QUE HACE FALTA ────────────────────────────────────────────────────────────────────┐
// │ Ni el build de Astro ni `docs-links.yml` cubren esto:                                   │
// │                                                                                          │
// │  · El build de Astro SOLO valida los `slug` del `sidebar` de `astro.config.mjs`.         │
// │    Un `[texto](/ruta/que/no/existe/)` dentro de un `.md` construye en VERDE y da 404     │
// │    al hacer clic.                                                                        │
// │  · `lychee` (`.github/workflows/docs-links.yml`) EXCLUYE `docs/src/**` a proposito,      │
// │    porque las rutas del sitio no son ficheros del repo y las daria todas por rotas.      │
// │                                                                                          │
// │ Resultado: los enlaces internos del sitio no los miraba nadie. El 2026-08-26, al quitar  │
// │ el segmento `explicacion/` de las URLs, aparecio uno que llevaba roto desde el 24: el    │
// │ generador `backend/scripts/docs/gen-campos-md.mjs` escribia un enlace a una pagina que   │
// │ se habia partido en carpeta. Nadie se entero porque nadie miraba.                        │
// └──────────────────────────────────────────────────────────────────────────────────────────┘
//
// Uso:  node scripts/docs/check-enlaces-internos.mjs
// Sale con codigo 1 si hay algun enlace roto, imprimiendo fichero:linea -> destino.

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const RAIZ = new URL('../../docs/src/content/docs/', import.meta.url).pathname;
// `docs/public/` se sirve tal cual desde la raiz del sitio: `public/diagramas/chat.svg` es
// `/diagramas/chat.svg`. Son destinos legitimos y NO son paginas, asi que van aparte.
const PUBLICO = new URL('../../docs/public/', import.meta.url).pathname;

/** Todas las paginas del sitio, como rutas normalizadas (`/backend/auth/`). */
async function paginas(dir = RAIZ, acc = new Set()) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { await paginas(p, acc); continue; }
    if (!/\.mdx?$/.test(e.name)) continue;
    const rel = relative(RAIZ, p).split(sep).join('/').replace(/\.mdx?$/, '');
    // `index` ES su carpeta: `modelo/index.md` -> `/modelo/`; y el `index` de la raiz -> `/`.
    acc.add(rel === 'index' ? '/' : `/${rel.replace(/\/index$/, '')}/`);
  }
  return acc;
}

/** Los ficheros fuente, para poder citar fichero:linea. */
async function fuentes(dir = RAIZ, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await fuentes(p, acc);
    else if (/\.mdx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** Todo lo que cuelga de `docs/public/`, como ruta servida (`/diagramas/chat.svg`). */
async function estaticos(dir = PUBLICO, acc = new Set()) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await estaticos(p, acc);
    else acc.add(`/${relative(PUBLICO, p).split(sep).join('/')}`);
  }
  return acc;
}

const validas = await paginas();
const ficheros = await estaticos();
const rotos = [];

for (const f of await fuentes()) {
  const lineas = readFileSync(f, 'utf8').split('\n');
  let enValla = false;
  lineas.forEach((linea, i) => {
    // Las vallas de codigo no llevan enlaces: un `](/algo)` dentro de un bloque es texto.
    if (/^\s*```/.test(linea)) { enValla = !enValla; return; }
    if (enValla) return;
    // `](/ruta)` en Markdown y `link: /ruta` en el frontmatter del hero.
    for (const m of linea.matchAll(/\]\((\/[^)\s#]*)[^)]*\)|^\s*link:\s*(\/\S*)/g)) {
      const destino = m[1] ?? m[2];
      if (!destino || destino.startsWith('//')) continue;
      if (ficheros.has(destino)) continue; // un estatico de `docs/public/`
      const norm = destino.endsWith('/') ? destino : `${destino}/`;
      if (!validas.has(norm)) {
        rotos.push({
          fichero: relative(RAIZ, f).split(sep).join('/'),
          linea: i + 1,
          destino,
        });
      }
    }
  });
}

if (rotos.length) {
  console.error(`\n✗ ${rotos.length} enlace(s) interno(s) roto(s):\n`);
  for (const r of rotos) console.error(`  ${r.fichero}:${r.linea}  ->  ${r.destino}`);
  console.error(`\n  Paginas que SI existen (${validas.size}):`);
  console.error([...validas].sort().map((p) => `    ${p}`).join('\n'));
  process.exit(1);
}

console.log(
  `✓ enlaces internos: 0 rotos sobre ${validas.size} paginas y ${ficheros.size} estaticos`,
);
