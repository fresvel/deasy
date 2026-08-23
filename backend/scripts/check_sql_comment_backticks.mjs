#!/usr/bin/env node
// Detector de "backtick dentro de un comentario SQL".
//
// POR QUÉ EXISTE. El SQL de este backend vive dentro de plantillas de JavaScript (`` ` ``), y sus
// comentarios se escriben con `--`. Poner un backtick ahí —para citar una columna, que es lo
// natural al documentar— **CIERRA LA PLANTILLA**:
//
//     const sql = `SELECT 1
//       -- ojo con `t.status`, que ya no existe      ← el backtick cierra aquí
//       FROM tasks`;
//
// Lo que pasa después depende de dónde caiga el corte:
//
//   - Con suerte, `node --check` lo caza con un "missing ) after argument list", y el mensaje
//     apunta a la primera línea de la plantilla —no a la del backtick—, así que se busca en el
//     sitio equivocado.
//   - Sin suerte, el resto de la consulta queda como expresión JavaScript válida y el fichero
//     compila: entonces el fallo aparece en tiempo de ejecución, como SQL truncado.
//
// Coste medido: SEIS veces en una sola tanda de trabajo (2026-08-23), en cuatro ficheros
// distintos, siempre al documentar una columna que se estaba retirando.
//
// Es hermano de `check_missing_imports.mjs` y del mismo tipo de fallo: algo que ni el linter ni
// los tests ven, y que sale caro cada vez.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(AQUI, "..");
const IGNORAR = new Set(["node_modules", "coverage", ".git", "public", "templates"]);

const listar = (dir) => {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...listar(ruta));
    else if (/\.(js|mjs)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
};

// Una línea de comentario SQL: espacios, `--`, y lo que sea. Sólo interesa si además lleva un
// backtick. No hace falta saber si está dentro de una plantilla: en JavaScript, una línea que
// EMPIEZA por `--` sólo puede estar dentro de una cadena — fuera sería un decremento.
const COMENTARIO_SQL_CON_BACKTICK = /^\s*--.*`/;

const hallazgos = [];
const ficheros = listar(BACKEND_ROOT);

for (const fichero of ficheros) {
  const lineas = fs.readFileSync(fichero, "utf8").split("\n");
  lineas.forEach((linea, i) => {
    if (COMENTARIO_SQL_CON_BACKTICK.test(linea)) {
      hallazgos.push({
        file: path.relative(BACKEND_ROOT, fichero),
        line: i + 1,
        text: linea.trim().slice(0, 100),
      });
    }
  });
}

if (!hallazgos.length) {
  console.log(
    `check:sql-comments OK — ${ficheros.length} ficheros, ningún backtick dentro de un comentario SQL.`
  );
  process.exit(0);
}

console.error(
  `check:sql-comments FALLA — ${hallazgos.length} backtick(s) dentro de comentarios SQL.\n` +
    `Un backtick ahí cierra la plantilla de JavaScript. Cita la columna SIN comillas.\n`
);
for (const h of hallazgos.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.error(`  ${h.file}:${h.line}`);
  console.error(`      ${h.text}\n`);
}
process.exit(1);
