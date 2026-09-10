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
  "id", "person_id", "password_hash", "status", "photo_url", "is_active", "token", "created_at", "updated_at"
]);

const columnasDePersons = () => columnasDe("persons");

function columnasDe(tabla) {
  const sql = readFileSync(ESQUEMA, "utf8");
  const inicio = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${tabla} (`);
  assert.notEqual(inicio, -1, `no se encontro la tabla ${tabla} en el esquema`);
  const cuerpo = sql.slice(inicio, sql.indexOf("\n);", inicio));
  return cuerpo
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea) => linea && !linea.startsWith("--"))
    .map((linea) => linea.match(/^([a-z_]+)\s+(TEXT|VARCHAR|INT|BIGINT|SMALLINT|DATE|TIMESTAMP)/))
    .filter(Boolean)
    .map((coincidencia) => coincidencia[1])
    .filter((columna) => !NO_EDITABLES.has(columna));
}

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
  // Comprueba que el analizador del esquema ENCUENTRA columnas, y no con un numero: aqui ponia «al
  // menos 10», y se rompio en P8 al salir el genero y la etnia de `persons`, sin que el analizador
  // tuviera nada que ver. Se pregunta por columnas que tienen que estar.
  for (const conocida of ["first_name", "last_name", "fecha_nacimiento", "estado_civil_id"]) {
    assert.ok(columnas.includes(conocida), `el analizador no encontro ${conocida} en persons`);
  }
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

// P8 saco el genero y la etnia de `persons` a `persona_autoidentificacion`: son datos sensibles
// (LOPDP, Art. 4) y `persons` la leen nueve roles. La persona los sigue declarando desde su perfil,
// asi que tienen que pasar la lista blanca -- y NO acabar en el UPDATE de `persons`, donde ya no
// existen y PostgreSQL responderia 42703 en tiempo de llamada--.
test("las columnas de `persona_autoidentificacion` pasan la lista blanca", async () => {
  const columnas = columnasDe("persona_autoidentificacion");
  assert.deepEqual([...columnas].sort(), ["autoidentificacion_etnica_id", "genero_id"]);
  const pasan = new Set(await camposQuePasan(columnas));
  assert.deepEqual(columnas.filter((c) => !pasan.has(c)), []);
});

test("el genero y la etnia se guardan en su tabla, nunca en `persons`", async () => {
  const consultas = [];
  const repo = new UserRepository({
    query: async (sql, params) => {
      consultas.push({ sql, params });
      return [[]];
    }
  });
  await repo.updateMe(7, { first_name: "Ana", genero_id: 2, autoidentificacion_etnica_id: "" });

  const updatePersons = consultas.find((c) => /UPDATE persons/.test(c.sql));
  assert.ok(updatePersons, "first_name tenia que actualizar persons");
  assert.doesNotMatch(updatePersons.sql, /genero_id|autoidentificacion_etnica_id/);

  const upsert = consultas.find((c) => /INSERT INTO persona_autoidentificacion/.test(c.sql));
  assert.ok(upsert, "tenia que guardar la autoidentificacion en su tabla");
  assert.deepEqual(upsert.params, [7, 2, null], "la cadena vacia se guarda como NULL");
});
