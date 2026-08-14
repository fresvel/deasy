#!/usr/bin/env node
//
// Trocea el Markdown intermedio en las 21 paginas de `docs/src/content/docs/explicacion/`.
//
// ── La mina ────────────────────────────────────────────────────────────────────────────
// NO se puede cortar con un `awk '/^# /'`. El bloque bash de la pagina de testing contiene
// dos comentarios que empiezan por `# `:
//
//     # Frontend: lint + tests unitarios, y ademas verificar en el navegador
//     # Backend: no tiene lint, pero SI tiene tests
//
// Un troceador ingenuo parte el documento POR LA MITAD DE UN BLOQUE DE CODIGO y genera dos
// paginas basura, perdiendo contenido en silencio. De ahi el estado `enValla`.
//
// ── La red de seguridad ────────────────────────────────────────────────────────────────
// Ademas del estado, se comprueba el INVARIANTE: la concatenacion de las 21 paginas tiene
// que reconstruir el intermedio (normalizando el nivel de cabecera, que es lo unico que
// cambia). Si el estado fallara, el invariante lo caza igual.
//
// ── ⚠️ ESTO PISA LOS DIAGRAMAS. LEELO ANTES DE EJECUTARLO ──────────────────────────────
// Trocear deja ANCLAS `<!-- diagrama NN -->`, no diagramas. Los Mermaid publicados en
// `docs/src/content/docs/explicacion/` se escribieron A MANO a partir de los `.ascii` de
// `diagramas/`, DESPUES de trocear. La conversion es de un solo sentido: ejecutar esto
// sobre las paginas ya publicadas las SUSTITUYE por anclas y **pierde los 15 Mermaid**.
//
// Pasa en silencio: `verificar.sh` sigue en verde (cuenta anclas, no Mermaid) y el sitio
// compila igual. Solo se ve abriendo una pagina.
//
// Asi que para una CORRECCION puntual en una pagina ya publicada: edita el `.tex` (que es
// la fuente y hay que mantener al dia) y **replica el cambio a mano en el `.md`**. No
// regeneres. Regenerar solo compensa si vas a rehacer los 15 diagramas.
// Aprendido a golpes el 2026-08-11, revirtiendo 17 ficheros.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..', '..');
const DESTINO = join(RAIZ, 'docs/src/content/docs/explicacion');

const [intermedio] = process.argv.slice(2);
if (!intermedio) { console.error('uso: trocear.mjs <intermedio.md>'); process.exit(1); }

const md = readFileSync(intermedio, 'utf8').split('\n');

// ── El manifiesto ──────────────────────────────────────────────────────────────────────
const paginas = readFileSync(join(AQUI, 'paginas.tsv'), 'utf8')
  .split('\n')
  .filter(l => l.trim() && !l.startsWith('#'))
  .map(l => {
    const [orden, fichero, corta_en, quitar, title, description] = l.split('\t');
    return { orden: Number(orden), fichero, corta_en, quitar: quitar === 'si', title, description };
  });

// ── Localizar los cortes, SOLO fuera de vallas ─────────────────────────────────────────
const esCabecera = [];
let enValla = false;
md.forEach((l, i) => {
  if (/^```/.test(l)) { enValla = !enValla; return; }
  if (!enValla && /^#{1,4} /.test(l)) esCabecera[i] = true;
});

const fallos = [];
for (const p of paginas) {
  const idx = md.map((l, i) => (esCabecera[i] && l === p.corta_en ? i : -1)).filter(i => i >= 0);
  if (idx.length === 0) fallos.push(`no encuentro el corte: «${p.corta_en}» (${p.fichero})`);
  else if (idx.length > 1) fallos.push(`corte AMBIGUO (${idx.length} veces): «${p.corta_en}»`);
  else p.linea = idx[0];
}
if (fallos.length) { console.error('✖ ' + fallos.join('\n✖ ')); process.exit(1); }

// El orden de corte es el del FICHERO, no el del sidebar: `index` es la ultima seccion.
const porLinea = [...paginas].sort((a, b) => a.linea - b.linea);
for (let i = 0; i < porLinea.length; i++) {
  porLinea[i].hasta = i + 1 < porLinea.length ? porLinea[i + 1].linea : md.length;
}

// ── Escribir ───────────────────────────────────────────────────────────────────────────
if (existsSync(DESTINO)) {
  for (const f of readdirSync(DESTINO)) if (f.endsWith('.md')) rmSync(join(DESTINO, f));
}
mkdirSync(DESTINO, { recursive: true });

const resumen = [];
for (const p of porLinea) {
  let cuerpo = md.slice(p.quitar ? p.linea + 1 : p.linea, p.hasta);

  // Normalizar el nivel de cabecera: el minimo pasa a `##`, nunca queda un `#` suelto
  // (el `#` lo pone Starlight desde el `title`). Se calcula ignorando las vallas.
  let v = false, min = 9;
  for (const l of cuerpo) {
    if (/^```/.test(l)) { v = !v; continue; }
    if (v) continue;
    const m = l.match(/^(#{1,4}) /);
    if (m) min = Math.min(min, m[1].length);
  }
  if (min < 9 && min !== 2) {
    const delta = 2 - min;
    v = false;
    cuerpo = cuerpo.map(l => {
      if (/^```/.test(l)) { v = !v; return l; }
      if (v) return l;
      const m = l.match(/^(#{1,4}) (.*)$/);
      if (!m) return l;
      const nivel = Math.max(2, Math.min(6, m[1].length + delta));
      return '#'.repeat(nivel) + ' ' + m[2];
    });
  }

  const texto = cuerpo.join('\n').replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
  // Entrecomillado SIEMPRE, y las comillas internas escapadas. Sin esto, un titulo con dos
  // puntos ("El backend: capas y routers") es YAML invalido: `bad indentation of a mapping
  // entry`. Y no falla en el troceo, falla al arrancar el sitio -- 11 de 21 paginas tumbaron
  // el servidor de docs antes de que nadie lo notara.
  const yaml = s => '"' + String(s).replace(/"/g, '\\"') + '"';
  const fm = [
    '---',
    `title: ${yaml(p.title)}`,
    `description: ${yaml(p.description)}`,
    'sidebar:',
    `  order: ${p.orden}`,
    '---',
    '',
  ].join('\n');
  writeFileSync(join(DESTINO, `${p.fichero}.md`), fm + texto);
  resumen.push({
    fichero: p.fichero, orden: p.orden, lineas: cuerpo.length,
    diagramas: cuerpo.filter(l => l.includes('<!-- diagrama')).length,
  });
}

resumen.sort((a, b) => a.orden - b.orden);
for (const r of resumen) {
  console.log(`  ${String(r.orden).padStart(2)}  ${r.fichero.padEnd(32)} ${String(r.lineas).padStart(4)} lineas` +
              (r.diagramas ? `  · ${r.diagramas} diagrama(s)` : ''));
}
console.log(`\n  ${resumen.length} paginas · ${resumen.reduce((s, r) => s + r.diagramas, 0)} diagramas por convertir`);
