import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ESQUEMAS } from "./postgres.js";

// ── POR QUÉ ESTA PRUEBA ─────────────────────────────────────────────────────────────────────────
//
// La lista de esquemas está en DOS sitios y no hay forma de que uno lea al otro: en
// `config/postgres.js` es JavaScript que configura el pool, y en `database/postgres_schema.sql` es
// un `SET search_path` que se aplica solo al crear el esquema.
//
// Si se separan, el fallo NO es un error al arrancar: es que las consultas de un tema entero
// empiezan a responder «relation does not exist» mientras el resto del sistema funciona. O peor,
// con el orden distinto: un `CREATE TABLE` sin cualificar acabaría en el esquema equivocado.
//
// Es el mismo trato que `DOCUMENT_RELAYABLE_STATUSES`, duplicada entre JavaScript y los triggers
// del esquema y vigilada por `DocumentStateService.test.js` leyendo el propio fichero.
const ESQUEMA_SQL = new URL("../database/postgres_schema.sql", import.meta.url);

const delFichero = () => {
  const sql = readFileSync(ESQUEMA_SQL, "utf8");
  const linea = sql.match(/^SET search_path = (.+);$/m);
  assert.ok(linea, "postgres_schema.sql tiene que llevar un `SET search_path = ...;` en una línea");
  return linea[1].split(",").map((s) => s.trim());
};

test("el search_path del pool es el mismo que el del esquema, y en el mismo orden", () => {
  assert.deepEqual(ESQUEMAS, delFichero());
});

// El orden importa, y no solo la pertenencia: un `CREATE TABLE` sin cualificar va al PRIMER
// esquema de la lista. Si `public` dejara de ser el último, una tabla nueva mal escrita acabaría
// en el esquema de otro tema.
test("public va al final", () => {
  assert.equal(ESQUEMAS.at(-1), "public");
  assert.equal(delFichero().at(-1), "public");
});

// ⚠️ Falta una tercera comprobación —que los esquemas sean exactamente los temas de
// `scripts/docs/dominios.json`— y NO va aquí: el contenedor del backend monta `/app/backend` y no
// `scripts/`, así que desde dentro ese fichero no existe. Vive en `scripts/docs/check-mapa-tablas.mjs`,
// que corre desde la raíz del repositorio y ve los dos.
