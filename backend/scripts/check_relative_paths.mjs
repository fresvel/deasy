// TODA RUTA RELATIVA RESUELVE A UN FICHERO QUE EXISTE. Puerta a techo cero.
//
// Esto es el hueco que `CLAUDE.md` nombraba y nadie tapaba: «`node --check` y `check:imports` no ven
// una ruta relativa rota — eso solo lo ve el backend al arrancar». Y arrancar es un mal detector,
// porque para cuando falla ya has perdido la corrida: el 2026-10-07, moviendo `identidad`, un import
// roto en `routes/dossier_router.js` dejo el backend sin arrancar y solo se supo por el log.
//
// ⚠️ MIRA LAS DOS COMILLAS, y eso es el motivo de que exista. Ese import sobrevivio a CUATRO barridos
// seguidos porque `dossier_router.js` escribe sus imports con comillas SIMPLES y todos los regex
// escritos a mano aquel dia miraban solo `"`. El repositorio usa dobles casi siempre, asi que la
// excepcion es invisible justo cuando mas duele.
//
// ⚠️ Y MIRA LO QUE NO ES UN IMPORT. Un `new URL("../../database/postgres_schema.sql",
// import.meta.url)` es una ruta relativa igual, y al mover un fichero se rompe igual — pero ningun
// reescritor de imports la toca. Costo dos tests en rojo el mismo dia.
//
// ⚠️ Y MIRA LAS RUTAS QUE PERDIERON EL `./`. `from "datos/certificados.js"` no es una ruta relativa
// para ESM: es un PAQUETE, y el error que da es `Cannot find package 'datos'`, que no se parece en
// nada al problema. Lo escribio un `os.path.relpath` que devuelve `datos/x.js` sin prefijo, y esta
// puerta —que solo miraba lo que empieza por `.`— lo dejo pasar: 14 suites en rojo. Se reconoce con
// certeza porque el fichero existe EN DISCO junto al que lo importa; un paquete de verdad no.
import { readdir, readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";

const RAIZ = process.cwd();
const IGNORAR = new Set(["node_modules", "coverage", ".git", "templates", "public"]);

const listar = async (dir) => {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...await listar(ruta));
    else if (/\.(js|mjs|cjs)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
};

// Las dos comillas, siempre. Y `import(...)` dinamico, que tambien resuelve en ejecucion.
const PATRONES = [
  { que: "import",   re: /\bfrom\s+['"](\.[^'"\n]+)['"]/g },
  { que: "import()", re: /\bimport\s*\(\s*['"](\.[^'"\n]+)['"]\s*\)/g },
  { que: "new URL",  re: /new\s+URL\s*\(\s*['"](\.[^'"\n]+)['"]\s*,\s*import\.meta\.url\s*\)/g },
];

const existe = async (p) => { try { await access(p); return true; } catch { return false; } };

// Un especificador SIN `./` que ademas existe como fichero al lado del que lo importa: perdio el
// prefijo. Se exige la extension para no confundirlo con un paquete (`express`, `node:fs`).
const BARE = /\bfrom\s+['"]([A-Za-z_$][^'"\n]*\.(?:js|mjs|cjs|json))['"]/g;

const fallos = [];
let ficheros = 0;
let rutas = 0;
for (const fichero of await listar(RAIZ)) {
  ficheros += 1;
  const src = await readFile(fichero, "utf8");
  for (const m of src.matchAll(BARE)) {
    const destino = path.resolve(path.dirname(fichero), m[1]);
    if (await existe(destino)) {
      const linea = src.slice(0, m.index).split("\n").length;
      fallos.push({ rel: path.relative(RAIZ, fichero), linea, que: "sin ./", ruta: m[1] });
    }
  }
  for (const { que, re } of PATRONES) {
    for (const m of src.matchAll(re)) {
      rutas += 1;
      const destino = path.resolve(path.dirname(fichero), m[1]);
      if (!(await existe(destino))) {
        const linea = src.slice(0, m.index).split("\n").length;
        fallos.push({ rel: path.relative(RAIZ, fichero), linea, que, ruta: m[1] });
      }
    }
  }
}

if (fallos.length) {
  console.error(`check:rutas FALLA — ${fallos.length} ruta(s) relativa(s) que no existen:\n`);
  for (const f of fallos) {
    console.error(`  ${f.rel}:${f.linea}  (${f.que})  ${f.ruta}`);
  }
  console.error("\nSi acabas de mover codigo: recalcula la ruta desde la posicion NUEVA, y acuerdate de");
  console.error("las que no son imports (`new URL(..., import.meta.url)`).");
  console.error("Si dice `sin ./`: la ruta existe pero le falta el prefijo, y ESM la lee como un paquete.");
  process.exit(1);
}
console.log(`check:rutas OK — ${ficheros} ficheros, ${rutas} rutas relativas, todas existen.`);
