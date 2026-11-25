#!/usr/bin/env node
// Comprueba que una misma tabla dibujada en VARIOS erDiagram del sitio declare
// SIEMPRE las mismas columnas.
//
// POR QUE EXISTE. El 2026-09-04 la seccion 4 de complemento/expediente.md se
// reescribio siete veces y las secciones 1 y 3 se quedaron con el diseño viejo:
// el mismo `expediente_titulos` aparecia con nueve columnas en un diagrama y con
// seis en otro, en LA MISMA PAGINA. Lo vio el dueño, no ningun gate. Ni el build
// de Astro ni check-doc-modelo.mjs lo miran: para los dos, un nombre retirado que
// sigue existiendo en el esquema es correcto.
//
// UN DIAGRAMA PARCIAL ES LEGITIMO -- dibujar dos columnas de una tabla para
// enseñar una relacion-- y se declara poniendo `%% parcial` dentro del bloque
// mermaid. Sin esa marca, toda declaracion de la misma tabla tiene que coincidir.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = "docs/src/content/docs";
const paginas = [];
(function anda(dir) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) anda(ruta);
    else if (entrada.endsWith(".md") || entrada.endsWith(".mdx")) paginas.push(ruta);
  }
})(RAIZ);

const declaraciones = new Map();
for (const pagina of paginas) {
  const lineas = readFileSync(pagina, "utf8").split("\n");
  let dentro = false, parcial = false, tabla = null, columnas = null, linea = 0;
  lineas.forEach((texto, i) => {
    if (/^```mermaid/.test(texto)) { dentro = true; parcial = false; return; }
    if (/^```\s*$/.test(texto)) { dentro = false; tabla = null; return; }
    if (!dentro) return;
    if (/^\s*%%\s*parcial\b/.test(texto)) { parcial = true; return; }
    const abre = texto.match(/^\s*([a-z_][a-z0-9_]*)\s*\{\s*$/i);
    if (abre) { tabla = abre[1]; columnas = []; linea = i + 1; return; }
    if (tabla && /^\s*\}\s*$/.test(texto)) {
      if (!parcial) {
        if (!declaraciones.has(tabla)) declaraciones.set(tabla, []);
        declaraciones.get(tabla).push({ pagina: relative(".", pagina), linea, columnas });
      }
      tabla = null;
      return;
    }
    if (tabla) {
      const col = texto.trim().match(/^\S+\s+([a-z_][a-z0-9_]*)/i);
      if (col) columnas.push(col[1]);
    }
  });
}

let incoherentes = 0;
for (const [tabla, apariciones] of [...declaraciones].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  if (apariciones.length < 2) continue;
  const firmas = new Set(apariciones.map((a) => [...a.columnas].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(",")));
  if (firmas.size === 1) continue;
  incoherentes++;
  console.log(`\n✖ ${tabla} — dibujada ${apariciones.length} veces con columnas DISTINTAS`);
  const union = [...new Set(apariciones.flatMap((a) => a.columnas))];
  for (const a of apariciones) {
    const faltan = union.filter((c) => !a.columnas.includes(c));
    console.log(
      `   ${a.pagina}:${a.linea} (${a.columnas.length} col)` +
        (faltan.length ? `  · le faltan: ${faltan.join(", ")}` : "  · tiene todas")
    );
  }
}

if (incoherentes) {
  console.log(
    `\n✖ ${incoherentes} tabla(s) con diagramas incoherentes.\n` +
      "  Deja una sola version correcta, o marca el bloque parcial con `%% parcial`\n" +
      "  si dibuja solo unas columnas a proposito."
  );
  process.exit(1);
}
console.log(
  `✓ diagramas coherentes: ${declaraciones.size} tablas dibujadas en ${paginas.length} paginas, ninguna se contradice.`
);
