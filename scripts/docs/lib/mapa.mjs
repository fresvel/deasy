// El mapa de módulos, leído UNA vez y en un solo sitio.
//
// `dominios.json` dejó de ser «el reparto en diagramas» el 2026-10-04 y pasó a ser la fuente única
// de «¿a qué parte del sistema pertenece esta tabla?». Tiene tres niveles —tabla → módulo →
// {dominio, capa}— y tres consumidores: el troceo del DBML, el generador de los mapas con campos y
// la puerta `check-mapa-modulos.mjs`.
//
// ⚠️ Esto existe para que no haya dos parsers. Cuando el fichero tenía una sola forma —`tablas` por
// dominio— cada consumidor lo leía a su manera y eso era barato; con tres niveles, dos lecturas
// distintas es exactamente como una se queda atrás. Si hace falta un dato nuevo del mapa, se añade
// aquí y lo ven los tres.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUTA_MAPA = join(AQUI, "..", "dominios.json");

/**
 * Lee el mapa y lo devuelve ya indexado por tabla.
 *
 * Las `tablas` de un dominio son DERIVADAS: la unión de las de sus módulos. No se escriben dos
 * veces, porque dos listas de las mismas tablas es una lista que se queda atrás.
 */
export function leerMapa(ruta = RUTA_MAPA) {
  const crudo = JSON.parse(readFileSync(ruta, "utf8"));
  const fallos = [];

  const dominios = {};
  const modulos = new Map();
  const dominioDe = new Map();
  const moduloDe = new Map();
  const capaDe = new Map();

  for (const [clave, dom] of Object.entries(crudo)) {
    if (clave.startsWith("_")) continue;
    if (!dom.modulos) {
      fallos.push(`el dominio '${clave}' no declara 'modulos'`);
      continue;
    }
    const tablasDelDominio = [];
    for (const [nombre, mod] of Object.entries(dom.modulos)) {
      if (modulos.has(nombre)) fallos.push(`el módulo '${nombre}' está declarado dos veces`);
      if (!Number.isInteger(mod.capa)) fallos.push(`el módulo '${nombre}' no declara una capa entera`);
      modulos.set(nombre, { ...mod, dominio: clave });
      for (const tabla of mod.tablas ?? []) {
        if (moduloDe.has(tabla)) {
          fallos.push(`la tabla '${tabla}' está en dos módulos: '${moduloDe.get(tabla)}' y '${nombre}'`);
        }
        moduloDe.set(tabla, nombre);
        dominioDe.set(tabla, clave);
        capaDe.set(tabla, mod.capa);
        tablasDelDominio.push(tabla);
      }
    }
    dominios[clave] = { ...dom, tablas: tablasDelDominio };
  }

  return {
    dominios,
    modulos,
    dominioDe,
    moduloDe,
    capaDe,
    capas: crudo._capas ?? {},
    transversales: Object.keys(crudo._escritores_transversales ?? {}).filter((k) => !k.startsWith("_")),
    fallos,
  };
}

/** Las tablas del esquema, en el orden en que el esquema las declara. */
export function tablasDelEsquema(rutaEsquema) {
  const sql = readFileSync(rutaEsquema, "utf8");
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)].map((m) => m[1]);
}

/**
 * Las claves ajenas del esquema, como {origen, columna, destino}.
 *
 * ⚠️ Se lee por LÍNEAS dentro del bloque de cada tabla, y no con una expresión sobre el fichero
 * entero: `REFERENCES` aparece tanto en una columna (`pais_id INT REFERENCES paises(id)`) como en
 * un `CONSTRAINT ... FOREIGN KEY (col) REFERENCES ...`, y el nombre de la columna está en un sitio
 * distinto en cada forma.
 */
export function clavesAjenas(rutaEsquema) {
  const sql = readFileSync(rutaEsquema, "utf8");
  const existentes = new Set(tablasDelEsquema(rutaEsquema));
  const fks = [];
  for (const bloque of sql.split(/CREATE TABLE IF NOT EXISTS\s+/i).slice(1)) {
    const origen = bloque.match(/^(\w+)/)?.[1];
    if (!origen) continue;
    for (const linea of bloque.split("\n")) {
      // Un comentario `--` puede nombrar una tabla y no es una clave ajena.
      if (/^\s*--/.test(linea)) continue;
      const destino = linea.match(/REFERENCES\s+(\w+)/i)?.[1];
      if (!destino || !existentes.has(destino)) continue;
      const columna = linea.match(/FOREIGN KEY\s*\(\s*(\w+)/i)?.[1] ?? linea.match(/^\s*(\w+)/)?.[1] ?? "?";
      fks.push({ origen, columna, destino });
    }
  }
  return fks;
}

/**
 * Los subgrupos de los dos mapas escritos a mano, por su IDENTIFICADOR de mermaid.
 *
 * Devuelve, por mapa: `grupos` (id -> {titulo, tablas}) y `sueltas` (las dibujadas FUERA de todo
 * subgrupo, que son correctas: cada una se cuenta en el otro mapa o en su propia página).
 *
 * ⚠️ Solo cuenta un nodo cuya etiqueta ES el nombre de una tabla, con CORCHETES: `P["persons"]` es
 * una declaración, y `P(["persons · de la cadena anterior"])` es una REFERENCIA a otro dibujo. Es la
 * misma regla que aplica `gen-mapa-campos.mjs`, que tiene su propio recorrido porque además compone
 * las secciones y el orden de la página; éste solo contesta «¿en qué subgrupo está esta tabla?».
 * Que los dos sigan de acuerdo lo garantiza que la suma de grupos y sueltas tiene que dar las
 * tablas del esquema, y eso lo comprueba `check-mapa-modulos.mjs`.
 */
export function subgruposDibujados(rutaDocs, tablasValidas) {
  const valida = new Set(tablasValidas);
  const MAPAS = {
    complemento: "complemento/mapa-completo.md",
    modelo: "modelo/mapa-completo.md",
  };
  const salida = {};
  for (const [clave, relativa] of Object.entries(MAPAS)) {
    const texto = readFileSync(join(rutaDocs, relativa), "utf8");
    const grupos = new Map();
    const sueltas = [];
    let actual = null;
    let profundidad = 0;
    for (const linea of texto.split("\n")) {
      const cabecera = linea.match(/^\s*subgraph\s+(\w+)\s*\["([^"]+)"\]/);
      if (cabecera) {
        profundidad += 1;
        actual = cabecera[1];
        if (!grupos.has(actual)) grupos.set(actual, { titulo: cabecera[2], tablas: [] });
        continue;
      }
      if (/^\s*end\s*$/.test(linea)) {
        profundidad = Math.max(0, profundidad - 1);
        if (profundidad === 0) actual = null;
        continue;
      }
      for (const nodo of linea.matchAll(/[A-Za-z][A-Za-z0-9_]*\["([a-z0-9_]+)"\]/g)) {
        if (!valida.has(nodo[1])) continue;
        if (actual) grupos.get(actual).tablas.push(nodo[1]);
        else sueltas.push(nodo[1]);
      }
    }
    salida[clave] = { grupos, sueltas };
  }
  return salida;
}
