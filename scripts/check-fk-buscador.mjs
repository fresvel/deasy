#!/usr/bin/env node
// QUE NINGUNA REFERENCIA DEL EDITOR DE /admin PIDA UN NÚMERO A PELO.
//
// El catálogo del editor genérico (`backend/config/sqlTables.js`) declara las columnas, y un mapa del
// frontend (`FK_TABLE_MAP`, en `AdminTableManagerConfig.js`) dice cuáles son una referencia y a qué
// tabla: con entrada, el formulario ofrece un buscador; sin ella, pide el id. Son dos ficheros en
// dos lados, y una columna nueva que se añade al primero y no al segundo NO FALLA EN NINGUNA PARTE:
// compila, pasa los tests y el formulario simplemente pide un número.
//
// Pasó con el frente 27: 32 de las 37 columnas `*_id` sin buscador eran suyas —para registrar un acto
// había que saberse el id del tipo, el de la unidad emisora y el de la persona—. Lo vio el dueño el
// 2026-11-24, mirando la pantalla.
//
// Esta puerta cruza los dos ficheros. Una columna `*_id` de tipo `number` sin entrada en el mapa
// falla, salvo que esté en la lista de excepciones de abajo, que lleva su motivo; y una excepción
// que ya no hace falta, también falla, para que la lista no sea un cementerio.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const catalogo = readFileSync(`${raiz}backend/config/sqlTables.js`, "utf8");
const config = readFileSync(`${raiz}frontend/src/modules/admin/services/AdminTableManagerConfig.js`, "utf8");

// Lo que NO puede ser un buscador por nombre de columna, y por qué.
const EXCEPCIONES = {
  antecesor_vigencia_id: "apunta a tres tablas distintas según la tabla que la lleve (la vida de una unidad, de un puesto o de un proceso), y el mapa resuelve por nombre de columna",
  registro_id: "es polimórfica: la fila a la que apunta depende de la columna «tabla» de su misma fila"
};

const inicio = config.indexOf("export const FK_TABLE_MAP");
if (inicio < 0) {
  console.error("✖ No se encuentra FK_TABLE_MAP en AdminTableManagerConfig.js.");
  process.exit(1);
}
const mapa = config.slice(inicio, config.indexOf("};", inicio));
const conBuscador = new Set([...mapa.matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]));

// El catálogo, tabla a tabla. Se lee como texto: es un módulo del backend y esta puerta corre sin él.
const partes = catalogo.split(/\btable:\s*"([a-z_]+)"/);
const faltan = new Map();
const vistas = new Set();
let total = 0;
for (let i = 1; i < partes.length; i += 2) {
  const tabla = partes[i];
  for (const campo of partes[i + 1].matchAll(/\{\s*name:\s*"([a-z_]+_id)"[^}]*?type:\s*"number"/g)) {
    const nombre = campo[1];
    total += 1;
    vistas.add(nombre);
    if (conBuscador.has(nombre) || nombre in EXCEPCIONES) continue;
    if (!faltan.has(nombre)) faltan.set(nombre, []);
    faltan.get(nombre).push(tabla);
  }
}
const sobran = Object.keys(EXCEPCIONES).filter((nombre) => !vistas.has(nombre) || conBuscador.has(nombre));

if (faltan.size || sobran.length) {
  if (faltan.size) {
    console.error(`✖ ${faltan.size} columna(s) de referencia piden un número en el formulario de /admin:`);
    for (const [nombre, tablas] of faltan) console.error(`   · ${nombre}  ←  ${tablas.join(", ")}`);
    console.error("  Añádelas a FK_TABLE_MAP (frontend/src/modules/admin/services/AdminTableManagerConfig.js)");
    console.error("  con la tabla a la que apuntan, o a EXCEPCIONES de este fichero con su motivo.");
  }
  if (sobran.length) {
    console.error(`✖ ${sobran.length} excepción(es) que ya no hacen falta: ${sobran.join(", ")}. Quítalas.`);
  }
  process.exit(1);
}
console.log(`✓ referencias de /admin: ${total} columnas *_id, todas con buscador (${Object.keys(EXCEPCIONES).length} excepciones declaradas).`);
