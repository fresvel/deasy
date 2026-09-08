// Que las columnas de datos personales de `persons` esten TODAS en `allowedFields`.
//
// POR QUE EXISTE. `updateMe` filtra el cuerpo contra una lista blanca, y un campo que no este en
// ella se descarta EN SILENCIO: la respuesta sale 200 y no se guarda nada. Eso paso CINCO veces
// -- con `nacionalidad`, con el correo y con el documento--, y la quinta ocurrio con un comentario
// de aviso delante. Un aviso no es una puerta.
//
// La prueba LEE EL ESQUEMA, que es la misma tecnica que usa DocumentStateService.test.js para los
// estados relevables: si alguien añade una columna a `persons` y se olvida de la lista, esto se
// pone rojo. Comparar contra una lista escrita a mano aqui no serviria de nada -- seria una TERCERA
// copia del mismo dato.
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import test from "node:test";

import UserRepository from "./UserRepository.js";

const ESQUEMA = new URL("../../database/postgres_schema.sql", import.meta.url);

// Las columnas de `persons` que describen a la persona y las edita ella. Se excluye la fontaneria
// -- clave, token, estado, foto, marcas de tiempo-- que NO entra por el perfil.
const NO_EDITABLES = new Set([
  "id", "password_hash", "status", "photo_url", "is_active", "token", "created_at", "updated_at"
]);

const columnasDePersons = () => {
  const sql = readFileSync(ESQUEMA, "utf8");
  const inicio = sql.indexOf("CREATE TABLE IF NOT EXISTS persons (");
  assert.notEqual(inicio, -1, "no se encontro la tabla persons en el esquema");
  const cuerpo = sql.slice(inicio, sql.indexOf("\n);", inicio));
  return cuerpo
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea && !linea.startsWith("--"))
    .map((linea) => linea.match(/^([a-z_]+)\s+(TEXT|VARCHAR|INT|BIGINT|SMALLINT|DATE|TIMESTAMP)/))
    .filter(Boolean)
    .map((coincidencia) => coincidencia[1])
    .filter((columna) => !NO_EDITABLES.has(columna));
};

// `allowedFields` es local a `updateMe`, asi que se sonsaca observando que deja pasar: se le da un
// objeto con TODAS las columnas y se mira cual llega a `update`.
const camposQuePasan = async (columnas) => {
  const repo = new UserRepository({ query: async () => [[]] });
  let recibido = null;
  repo.update = async (_id, data) => { recibido = data; return null; };
  const cuerpo = Object.fromEntries(columnas.map((c) => [c, "x"]));
  await repo.updateMe(1, cuerpo);
  return Object.keys(recibido ?? {});
};

test("toda columna editable de `persons` esta en la lista blanca de updateMe", async () => {
  const columnas = columnasDePersons();
  assert.ok(columnas.length >= 10, `se esperaban al menos 10 columnas, hubo ${columnas.length}`);
  const pasan = new Set(await camposQuePasan(columnas));
  const olvidadas = columnas.filter((c) => !pasan.has(c));
  assert.deepEqual(
    olvidadas, [],
    `estas columnas de persons NO estan en allowedFields y se descartarian en silencio: ${olvidadas.join(", ")}`
  );
});

test("un campo que no es columna de `persons` NO pasa la lista blanca", async () => {
  const pasan = new Set(await camposQuePasan(["first_name", "columna_inventada", "is_active"]));
  assert.ok(pasan.has("first_name"), "first_name deberia pasar");
  assert.ok(!pasan.has("columna_inventada"), "un campo inventado no deberia pasar");
  assert.ok(!pasan.has("is_active"), "is_active no lo edita la persona");
});
