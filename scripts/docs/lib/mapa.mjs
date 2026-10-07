// El mapa de las tablas, leído UNA vez y en un solo sitio.
//
// `dominios.json` contesta «¿de qué trata esta tabla, y de qué depende?». Cada tabla aparece una
// vez, dentro de su TEMA, y su valor es su NIVEL. Tres consumidores: el troceo del DBML, el
// generador de los mapas con campos y la puerta `check-mapa-tablas.mjs`.
//
// ⚠️ Esto existe para que no haya dos parsers. Si hace falta un dato nuevo del mapa, se añade aquí
// y lo ven los tres.
//
// ⚠️ TRES PALABRAS, TRES SIGNIFICADOS, Y NO SE MEZCLAN (fijado el 2026-10-07 por el dueño):
//
//     DOMINIO  de qué trata una tabla. Son 8, y de ahí salen los 8 diagramas y los 8 esquemas.
//     NIVEL    de qué depende, 0..7. De aquí sale el orden de lectura y la regla de las claves ajenas.
//     CAPA     routes / controllers / services / datos, DENTRO del código de un dominio. Nada más.
//
// Esto no es estilo: «dominio» y «capa» fueron los nombres de los DOS EJES en la primera versión del
// mapa (`tabla -> módulo -> {dominio, capa}`), así que un texto viejo que diga «capa 3» habla de un
// NIVEL, y uno nuevo que diga «capa» habla de `services/`. Se renombró todo a `nivel` el 2026-10-07
// justamente para que «capa» signifique una sola cosa.
//
// Y lo que NO queda es el «módulo»: fue un tercer eje que se retiró el 2026-10-04 porque cuatro de
// sus quince grupos no eran dueños de ni un fichero de código.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RUTA_MAPA = join(AQUI, "..", "dominios.json");

/**
 * Lee el mapa y lo devuelve indexado por tabla.
 *
 *   dominios     clave -> { titulo, descripcion, color?, tablas: [...] }
 *   dominioDe    tabla -> clave del dominio
 *   nivelDe   tabla -> 0..7
 */
export function leerMapa(ruta = RUTA_MAPA) {
  const crudo = JSON.parse(readFileSync(ruta, "utf8"));
  const fallos = [];

  const dominios = {};
  const dominioDe = new Map();
  const nivelDe = new Map();

  for (const [clave, dominio] of Object.entries(crudo)) {
    if (clave.startsWith("_")) continue;
    if (!dominio.tablas || typeof dominio.tablas !== "object" || Array.isArray(dominio.tablas)) {
      fallos.push(`el dominio '${clave}' no declara 'tablas' como {tabla: nivel}`);
      continue;
    }
    const lista = [];
    for (const [tabla, nivel] of Object.entries(dominio.tablas)) {
      if (!Number.isInteger(nivel)) fallos.push(`'${tabla}' (dominio '${clave}') no declara un nivel entero`);
      if (dominioDe.has(tabla)) fallos.push(`la tabla '${tabla}' está en dos dominios: '${dominioDe.get(tabla)}' y '${clave}'`);
      dominioDe.set(tabla, clave);
      nivelDe.set(tabla, nivel);
      lista.push(tabla);
    }
    dominios[clave] = { ...dominio, tablas: lista };
  }

  return {
    dominios,
    dominioDe,
    nivelDe,
    niveles: crudo._niveles ?? {},
    transversales: Object.keys(crudo._escritores_transversales ?? {}).filter((k) => !k.startsWith("_")),
    fallos,
  };
}

/**
 * Las tablas del esquema, en el orden en que el esquema las declara.
 *
 * ⚠️ SE SALTAN LAS LÍNEAS DE COMENTARIO, y no es una precaución teórica: la cabecera del esquema
 * explica la trampa del 'IF NOT EXISTS' citando un 'CREATE TABLE IF NOT EXISTS firmas.x', y sin
 * este filtro aparecía una tabla fantasma llamada 'x' --94 en vez de 93-- que la puerta reclamaba
 * como tabla sin dominio. Citar una sentencia dentro de un comentario es lo natural al explicar SQL,
 * así que esto muerde de nuevo en cuanto alguien documente algo bien.
 */
export function tablasDelEsquema(rutaEsquema) {
  const sql = sinComentarios(readFileSync(rutaEsquema, "utf8"));
  return [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:\w+\.)?(\w+)/gi)].map((m) => m[1]);
}

/** Quita las líneas que son sólo comentario `--`. No toca un `--` al final de una línea de SQL. */
export function sinComentarios(sql) {
  return sql
    .split("\n")
    .filter((linea) => !/^\s*--/.test(linea))
    .join("\n");
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
  const sql = sinComentarios(readFileSync(rutaEsquema, "utf8"));
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
