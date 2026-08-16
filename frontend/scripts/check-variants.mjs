#!/usr/bin/env node
/**
 * Que ninguna plantilla pida a un componente una VARIANTE (o un TAMAÑO) que no existe.
 *
 * POR QUE EXISTE
 * `AppButton` resuelve su variante por PERTENENCIA al mapa, no por verdad — y eso ya arreglo el
 * fallo de estampar la clave desconocida como clase literal. Pero lo que hace con lo desconocido
 * es devolver cadena vacia y avisar por consola **solo en desarrollo**:
 *
 *     if (import.meta.env.DEV) console.warn(`[AppButton] variant desconocida: …`)
 *
 * O sea que en produccion el boton sale **sin variante**, sin color y sin que falle nada. El
 * inventario del 2026-08-14 encontro dos asi, vivos:
 *
 *   · `AdminProcessWizardModal.vue` pedia `outline-primary` — en kebab; el mapa tiene `outlinePrimary`.
 *   · `HomeView.vue` pedia `warning` — que no existe: la variante se llama `softWarning`.
 *
 * Ninguno lo vio el build, ni `eslint`, ni los 316 tests, ni los otros siete gates. Un aviso que
 * depende de que alguien tenga la consola abierta en desarrollo no es una puerta.
 *
 * COMO LO COMPRUEBA
 * Lee los mapas DEL PROPIO COMPONENTE (no una copia: la copia se desincroniza, que es la averia
 * que tenia `contraste.mjs`) y contrasta contra cada atributo estatico de las plantillas.
 *
 * LO QUE NO PUEDE VER, Y NO SE INTENTA
 * Un `:variant="loQueSea"` con expresion no es texto literal. Se ignora a proposito: adivinar el
 * valor de una expresion es como se inventan los falsos positivos que hacen que un gate se apague.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");

/* Componente -> fichero y alias con los que se le invoca. `AppButton` se importa bajo el alias
   `AdminButton` en 159 sitios por herencia historica; los dos nombres apuntan al mismo fichero. */
const COMPONENTES = [
  {
    fichero: "shared/components/buttons/AppButton.vue",
    etiquetas: ["AppButton", "AdminButton"],
    mapas: { variant: "variantClassMap", size: "sizeClassMap" },
  },
];

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

const sinComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/* Las claves de un mapa `const X = { … }` del componente. */
const clavesDe = (fuente, nombreMapa) => {
  const m = fuente.match(new RegExp(`const\\s+${nombreMapa}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) return null;
  return new Set([...m[1].matchAll(/^\s*"?([a-zA-Z][\w-]*)"?\s*:/gm)].map((x) => x[1]));
};

const fallos = [];
let comprobados = 0;

for (const comp of COMPONENTES) {
  const fuente = readFileSync(join(SRC, comp.fichero), "utf8");
  const validos = {};
  for (const [prop, mapa] of Object.entries(comp.mapas)) {
    const claves = clavesDe(fuente, mapa);
    if (!claves) {
      console.error(`✖ check:variants — no encuentro el mapa \`${mapa}\` en ${comp.fichero}.`);
      console.error("  El gate lee los mapas del componente a proposito, para no llevar una copia que se");
      console.error("  desincronice. Si lo has renombrado, actualiza COMPONENTES en este script.");
      process.exit(1);
    }
    validos[prop] = claves;
  }

  const etiquetas = comp.etiquetas.join("|");
  for (const ruta of ficheros(SRC)) {
    const tpl = sinComentarios(readFileSync(ruta, "utf8")).split(/<script/)[0];
    for (const uso of tpl.matchAll(new RegExp(`<(?:${etiquetas})\\b([\\s\\S]*?)\\/?>`, "g"))) {
      for (const [prop, claves] of Object.entries(validos)) {
        /* Solo el atributo ESTATICO: `variant="x"`, nunca `:variant="expresion"`. */
        const m = uso[1].match(new RegExp(`(?<![:@\\w-])${prop}="([^"]*)"`));
        if (!m) continue;
        comprobados += 1;
        if (claves.has(m[1])) continue;
        const linea = tpl.slice(0, uso.index).split("\n").length;
        fallos.push({
          ruta: ruta.slice(SRC.length + 1),
          linea,
          prop,
          valor: m[1],
          validos: [...claves].join(", "),
        });
      }
    }
  }
}

if (fallos.length) {
  console.error(`✖ check:variants — ${fallos.length} plantilla(s) piden algo que el componente NO tiene:\n`);
  for (const f of fallos) {
    console.error(`  ${f.ruta}:${f.linea}`);
    console.error(`      ${f.prop}="${f.valor}"  ->  no existe`);
    console.error(`      validos: ${f.validos}\n`);
  }
  console.error("Ese elemento se renderiza SIN esa clase, sin color y sin que falle nada mas.");
  console.error("Corrige la plantilla, o añade la variante al mapa del componente si de verdad falta.");
  process.exit(1);
}

console.log(`check:variants OK — ${comprobados} atributos comprobados contra los mapas del componente.`);
