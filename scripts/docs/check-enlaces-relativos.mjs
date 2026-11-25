#!/usr/bin/env node
// LOS ENLACES ENTRE FICHEROS .md DEL REPOSITORIO, COMPROBADOS EN LOCAL.
//
// En CI esto lo hace lychee (`docs-links.yml`, trabajo `enlaces-internos`), y hasta el 2026-11-24
// era la única comprobación de la documentación que NO se podía correr antes de subir. Ese trabajo
// estuvo en rojo desde octubre sin que nadie lo viera, y arreglarlo costó dos subidas: la primera
// destapó once enlaces a ficheros movidos, y debajo había seis más —tres anclas sin tilde, dos a un
// título que cambia con cada cierre y una ruta del sitio—.
//
// Mira lo mismo que lychee con `--offline --include-fragments`, y con sus mismas exclusiones:
//   · que el fichero enlazado exista;
//   · que exista el título al que apunta el ancla (reglas de GitHub: minúsculas, sin puntuación,
//     espacios a guiones, TILDES CONSERVADAS, y `-1`, `-2` para los títulos repetidos);
//   · que no haya enlaces de raíz (`/modelo/`): son rutas del sitio, no ficheros.
// Lo que hay dentro de un bloque de código o entre acentos graves no es un enlace.
//
// No sustituye a lychee: es para ver el fallo antes de subir. Se calibró contra él —encontraba
// exactamente los seis que lychee rechazó, y cero tras arreglarlos—.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../..", import.meta.url));
const EXCLUIDOS = ["docs/docs-md-antiguos/", "docs/src/"];

const ficheros = execFileSync("git", ["-c", "core.quotepath=off", "ls-files", "*.md"], { cwd: raiz, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !EXCLUIDOS.some((e) => f.startsWith(e)) && !f.includes("node_modules"));

const sinCodigo = (texto) => texto.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
const sinBloques = (texto) => texto.replace(/```[\s\S]*?```/g, "");

const ancla = (titulo) =>
  [...titulo.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*]/g, "").trim().toLowerCase()]
    .filter((c) => /[\p{L}\p{N} _-]/u.test(c))
    .join("")
    .replaceAll(" ", "-");

const anclasDe = new Map();
const anclas = (fichero) => {
  if (!anclasDe.has(fichero)) {
    const texto = readFileSync(join(raiz, fichero), "utf8");
    const vistas = new Map();
    const conjunto = new Set();
    for (const m of sinBloques(texto).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
      const base = ancla(m[1]);
      const n = vistas.get(base) ?? 0;
      vistas.set(base, n + 1);
      conjunto.add(n ? `${base}-${n}` : base);
    }
    for (const m of texto.matchAll(/(?:id|name)="([^"]+)"/g)) conjunto.add(m[1]);
    anclasDe.set(fichero, conjunto);
  }
  return anclasDe.get(fichero);
};

const fallos = [];
let enlaces = 0;
for (const fichero of ficheros) {
  const texto = sinCodigo(readFileSync(join(raiz, fichero), "utf8"));
  for (const m of texto.matchAll(/\]\(([^)\s]+)/g)) {
    const destino = m[1];
    if (/^(https?:|mailto:|tel:)/.test(destino)) continue;
    enlaces += 1;
    if (destino.startsWith("/")) {
      fallos.push(`${fichero} → ${destino}   (enlace de raíz: es una ruta del sitio, no un fichero)`);
      continue;
    }
    const [ruta, fragmento = ""] = destino.split("#");
    const apuntado = ruta ? normalize(join(dirname(fichero), decodeURIComponent(ruta))) : fichero;
    if (!existsSync(join(raiz, apuntado))) {
      fallos.push(`${fichero} → ${destino}   (el fichero no existe)`);
      continue;
    }
    if (fragmento && apuntado.endsWith(".md") && !anclas(apuntado).has(decodeURIComponent(fragmento))) {
      fallos.push(`${fichero} → ${destino}   (no hay ningún título con esa ancla)`);
    }
  }
}

if (fallos.length) {
  console.error(`✖ ${fallos.length} enlace(s) relativo(s) roto(s) en ${ficheros.length} ficheros:`);
  for (const f of fallos) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(`✓ enlaces relativos: ${enlaces} comprobados en ${ficheros.length} ficheros, ninguno roto.`);
