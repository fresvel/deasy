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
// Y HAY UNA TERCERA LISTA, que esta puerta NO miraba y que fallo el mismo dia por el mismo motivo:
// `AdminView.CATEGORIA_UI`, que da a cada categoria su etiqueta, su icono y su descripcion. Una
// categoria sin entrada ahi **no desaparece** y no sale en blanco, que seria mas facil de ver: cae al
// icono por omision y a la frase GENERICA que vale para cualquier seccion --«Administra y configura
// los datos de esta seccion.»--. Medido en el navegador el 2026-10-09. Es el peor caso posible: la
// tarjeta parece terminada y no dice nada. Le paso a «Recorrido»: se
// arreglo que ningun grupo la listara y se olvido que tampoco tenia presentacion, asi que la tabla
// aparecio... diciendo lo mismo que diria cualquier otra. Y al reves, `CATEGORIA_UI` conservaba una entrada `Entrega` que
// ningun grupo nombra: codigo muerto que parece configuracion.
//
// Asi que son TRES listas y la puerta cruza las tres. La leccion de las dos primeras valia igual aqui
// y no se aplico hasta que se vio en la pantalla: **arreglar una desincronizacion no sincroniza las
// demas**.
//
// Ni el build, ni eslint, ni los 495 vitest ven ninguna de las tres: son literales de texto que
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

// Las que tienen PRESENTACION: etiqueta, icono y descripcion. Sin entrada aqui, la tarjeta sale con
// el icono genérico y SIN descripcion, que es un fallo que solo se ve mirando.
const categoriasConPresentacion = () => {
  const fuente = fs.readFileSync(VISTA, "utf8");
  const ini = fuente.indexOf("const CATEGORIA_UI");
  if (ini < 0) {
    console.error("check:categorias-admin FALLA — no encuentro `CATEGORIA_UI` en AdminView.vue.");
    process.exit(1);
  }
  const bloque = fuente.slice(ini, fuente.indexOf("\n};", ini)).replace(/\/\/[^\n]*/g, " ");
  const salida = new Map();
  for (const fila of bloque.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*\{([^}]*)\}/gm)) {
    const desc = fila[2].match(/description:\s*"([^"]*)"/);
    salida.set(fila[1], (desc?.[1] || "").trim());
  }
  return salida;
};

const declaradas = categoriasDeclaradas();
const enseñadas = categoriasEnseñadas();
const presentacion = categoriasConPresentacion();
const invisibles = [...declaradas].filter((c) => !enseñadas.has(c)).sort();
const fantasmas = [...enseñadas].filter((c) => !declaradas.has(c)).sort();
// Solo se exige presentacion a lo que de verdad se enseña: una categoria declarada que ningun grupo
// lista ya la denuncia `invisibles`, y pedirle encima un icono seria contarlo dos veces.
const sinPresentacion = [...enseñadas].filter((c) => !presentacion.has(c)).sort();
const sinDescripcion = [...enseñadas].filter((c) => presentacion.get(c) === "").sort();
const presentacionHuerfana = [...presentacion.keys()].filter((c) => !enseñadas.has(c)).sort();

const fallos = invisibles.length + fantasmas.length + sinPresentacion.length
  + sinDescripcion.length + presentacionHuerfana.length;
if (!fallos) {
  console.log(
    `check:categorias-admin OK — ${declaradas.size} categorias: todas con grupo, con presentacion`
    + ` y con descripcion; ningun grupo vacio y ninguna presentacion huerfana.`
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
for (const c of sinPresentacion) {
  console.error(
    `  · la categoria "${c}" se enseña pero no tiene entrada en CATEGORIA_UI: saldra con icono`
    + ` generico y con la frase GENERICA de cualquier seccion, que no dice nada`
  );
}
for (const c of sinDescripcion) {
  console.error(`  · la categoria "${c}" tiene entrada en CATEGORIA_UI con la descripcion VACIA`);
}
for (const c of presentacionHuerfana) {
  console.error(
    `  · CATEGORIA_UI describe "${c}", que ningun grupo enseña: codigo muerto que parece configuracion`
  );
}
console.error(
  "\nLas TRES listas: `backend/config/sqlTables.js` (category:), `AdminView.GROUP_DEFS`"
  + " y `AdminView.CATEGORIA_UI`.\n"
);
process.exit(1);
