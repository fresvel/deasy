// El mapa de las tablas, leído UNA vez y en un solo sitio.
//
// `dominios.json` contesta «¿de qué trata esta tabla, y de qué depende?». Cada tabla aparece una
// vez, dentro de su TEMA, y su valor es su NIVEL. Tres consumidores: el troceo del DBML, el
// generador de los mapas con campos y la puerta `check-mapa-tablas.mjs`.
//
// ⚠️ Esto existe para que no haya dos parsers. Si hace falta un dato nuevo del mapa, se añade aquí
// y lo ven los tres.
//
// ⚠️ El fichero se llama `dominios.json` por historia: nació repartiendo diagramas por dominio.
// «Dominio» y «tema» son la misma cosa; renombrarlo obligaría a tocar los dos workflows de CI y no
// paga. Lo que NO queda es el «módulo»: fue un tercer eje que se retiró el 2026-10-04 porque cuatro
// de sus quince grupos no eran dueños de ni un fichero de código.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUTA_MAPA = join(AQUI, "..", "dominios.json");

/**
 * Lee el mapa y lo devuelve indexado por tabla.
 *
 *   temas     clave -> { titulo, descripcion, color?, tablas: [...] }
 *   temaDe    tabla -> clave del tema
 *   nivelDe   tabla -> 0..7
 */
export function leerMapa(ruta = RUTA_MAPA) {
  const crudo = JSON.parse(readFileSync(ruta, "utf8"));
  const fallos = [];

  const temas = {};
  const temaDe = new Map();
  const nivelDe = new Map();

  for (const [clave, tema] of Object.entries(crudo)) {
    if (clave.startsWith("_")) continue;
    if (!tema.tablas || typeof tema.tablas !== "object" || Array.isArray(tema.tablas)) {
      fallos.push(`el tema '${clave}' no declara 'tablas' como {tabla: nivel}`);
      continue;
    }
    const lista = [];
    for (const [tabla, nivel] of Object.entries(tema.tablas)) {
      if (!Number.isInteger(nivel)) fallos.push(`'${tabla}' (tema '${clave}') no declara un nivel entero`);
      if (temaDe.has(tabla)) fallos.push(`la tabla '${tabla}' está en dos temas: '${temaDe.get(tabla)}' y '${clave}'`);
      temaDe.set(tabla, clave);
      nivelDe.set(tabla, nivel);
      lista.push(tabla);
    }
    temas[clave] = { ...tema, tablas: lista };
  }

  return {
    temas,
    temaDe,
    nivelDe,
    niveles: crudo._niveles ?? {},
    transversales: Object.keys(crudo._escritores_transversales ?? {}).filter((k) => !k.startsWith("_")),
    fallos,
  };
}

/** Las tablas del esquema, en el orden en que el esquema las declara. */
export function tablasDelEsquema(rutaEsquema) {
  const sql = readFileSync(rutaEsquema, "utf8");
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:\w+\.)?(\w+)/gi)].map((m) => m[1]);
}

/**
 * Las claves ajenas del esquema, como {origen, columna, destino}.
 *
 * ⚠️ Se lee por LÍNEAS dentro del bloque de cada tabla, y no con una expresión sobre el fichero
 * entero: `REFERENCES` aparece tanto en una columna (`pais_id INT REFERENCES paises(id)`) como en
 * un `CONSTRAINT ... FOREIGN KEY (col) REFERENCES ...`, y el nombre de la columna está en un sitio
 * distinto en cada forma. El `(?:\w+\.)?` admite que la tabla vaya cualificada con su esquema.
 */
export function clavesAjenas(rutaEsquema) {
  const sql = readFileSync(rutaEsquema, "utf8");
  const existentes = new Set(tablasDelEsquema(rutaEsquema));
  const fks = [];
  for (const bloque of sql.split(/CREATE TABLE IF NOT EXISTS\s+/i).slice(1)) {
    const origen = bloque.match(/^(?:\w+\.)?(\w+)/)?.[1];
    if (!origen) continue;
    for (const linea of bloque.split("\n")) {
      if (/^\s*--/.test(linea)) continue;
      const destino = linea.match(/REFERENCES\s+(?:\w+\.)?(\w+)/i)?.[1];
      if (!destino || !existentes.has(destino)) continue;
      const columna = linea.match(/FOREIGN KEY\s*\(\s*(\w+)/i)?.[1] ?? linea.match(/^\s*(\w+)/)?.[1] ?? "?";
      fks.push({ origen, columna, destino });
    }
  }
  return fks;
}
