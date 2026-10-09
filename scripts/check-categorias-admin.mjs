#!/usr/bin/env node
// Detector de «categoria de tabla que /admin no enseña, y grupo que nombra una que no existe».
//
// POR QUE EXISTE. El editor generico de `/admin` agrupa sus tablas en SIETE grupos
// (`AdminView.GROUP_DEFS`), y cada grupo nombra las CATEGORIAS que muestra. Las categorias las
// declara el backend, una por tabla, en `config/sqlTables.js`. Son dos listas en dos lenguajes, en
// dos lados del sistema, y **nadie las cruzaba**.
//
// EL FALLO ES SILENCIOSO POR LOS DOS LADOS, y los dos ocurrieron de verdad el 2026-10-09:
//   · una CATEGORIA QUE NINGUN GRUPO LISTA deja sus tablas INVISIBLES. El backend las sirve, el RBAC
//     las permite, estan en `sqlTables.js` — y en la pantalla no hay nada. Paso con «Recorrido»: las
//     cuatro tablas nuevas del recorrido unificado no se podian abrir desde `/admin`.
//   · un GRUPO QUE NOMBRA UNA CATEGORIA QUE NO EXISTE deja un cajon vacio con titulo. Paso con
//     «Entrega», cuyas cuatro tablas se habian retirado.
//
// Ni el build, ni eslint, ni los 495 vitest ven ninguna de las dos: son dos literales de texto que
// casan o no casan. Se vio ABRIENDO LA PANTALLA, que es exactamente el tipo de fallo que este
// repositorio convierte en puerta.
//
// ⚠️ VIVE EN LA RAIZ Y NO EN `frontend/scripts/`, y no es estetica: el contenedor del frontend monta
// `../frontend:/app/frontend` y NADA MAS, asi que desde ahi `backend/config/sqlTables.js` no existe.
// Una puerta que cruza los dos lados no puede correr dentro de uno. Corre en el host y en CI, junto a
// `check-mapa-tablas.mjs`, que cruza igual.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const TABLAS = path.join(RAIZ, "backend", "config", "sqlTables.js");
const VISTA = path.join(RAIZ, "frontend", "src", "modules", "admin", "views", "AdminView.vue");

// Las categorias que el backend declara. Se leen del `category:` de cada tabla, no de una lista
// aparte: una lista aparte es justo lo que se desincroniza.
const categoriasDeclaradas = () => {
  const fuente = fs.readFileSync(TABLAS, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  return new Set([...fuente.matchAll(/^\s*category: "([^"]+)"/gm)].map((m) => m[1]));
};

// Las que `/admin` enseña: todo lo que aparece en un `main:` o un `support:` de `GROUP_DEFS`.
const categoriasEnseñadas = () => {
  const fuente = fs.readFileSync(VISTA, "utf8");
  const ini = fuente.indexOf("const GROUP_DEFS");
  if (ini < 0) {
    console.error("check:categorias-admin FALLA — no encuentro `GROUP_DEFS` en AdminView.vue.");
    process.exit(1);
  }
  // Hasta el cierre del array, y SIN los comentarios: una categoria nombrada en una lapida
  // («support decia [\"Entrega\"]») no es una categoria que se enseñe.
  const bloque = fuente.slice(ini, fuente.indexOf("\n];", ini)).replace(/\/\/[^\n]*/g, " ");
  const salida = new Set();
  for (const lista of bloque.matchAll(/(?:main|support):\s*\[([^\]]*)\]/g)) {
    for (const nombre of lista[1].matchAll(/"([^"]+)"/g)) salida.add(nombre[1]);
  }
  return salida;
};

const declaradas = categoriasDeclaradas();
const enseñadas = categoriasEnseñadas();
const invisibles = [...declaradas].filter((c) => !enseñadas.has(c)).sort();
const fantasmas = [...enseñadas].filter((c) => !declaradas.has(c)).sort();

if (!invisibles.length && !fantasmas.length) {
  console.log(
    `check:categorias-admin OK — ${declaradas.size} categorias, todas con grupo y ningun grupo vacio.`
  );
  process.exit(0);
}

console.error("check:categorias-admin FALLA — las dos listas no cuadran.\n");
for (const c of invisibles) {
  console.error(
    `  · la categoria "${c}" no la lista NINGUN grupo de AdminView: sus tablas son invisibles en /admin`
  );
}
for (const c of fantasmas) {
  console.error(
    `  · un grupo de AdminView nombra la categoria "${c}", que ninguna tabla declara: cajon vacio`
  );
}
console.error("\nLas dos listas: `backend/config/sqlTables.js` (category:) y `AdminView.GROUP_DEFS`.\n");
process.exit(1);
