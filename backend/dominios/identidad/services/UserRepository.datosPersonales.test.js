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

import UserRepository, { CAMPOS_AUTOIDENTIFICACION, CAMPOS_DATOS_PERSONALES } from "./UserRepository.js";
import AuthService from "./AuthService.js";

const ESQUEMA = new URL("../../../database/postgres_schema.sql", import.meta.url);

// Las columnas de `persons` que describen a la persona y las edita ella. Se excluye la fontaneria
// -- clave, token, estado, foto, marcas de tiempo-- que NO entra por el perfil.
const NO_EDITABLES = new Set([
  "id", "person_id", "password_hash", "status", "photo_url", "is_active", "token", "created_at", "updated_at"
]);

const columnasDePersons = () => columnasDe("persons");

function columnasDe(tabla) {
  
// ⚠️ SE QUITA EL ESQUEMA DEL NOMBRE AL LEER. Desde el 2026-10-04 cada tabla vive en el esquema de su
// tema, asi que el fichero dice 'CREATE TABLE IF NOT EXISTS plantillas.ediciones'. Estas
// pruebas van sobre LA FORMA de la tabla --sus columnas, sus CHECK, sus claves-- y no sobre donde
// vive; normalizar aqui, una vez, evita tocar los once sitios que la buscan por su nombre. Que cada
// tabla este en el esquema de su tema lo comprueba 'scripts/docs/check-mapa-tablas.mjs'.
const sinEsquema = (texto) => texto.replace(/CREATE TABLE IF NOT EXISTS \w+\./g, "CREATE TABLE IF NOT EXISTS ");
const sql = sinEsquema(readFileSync(ESQUEMA, "utf8"));
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

// Un pool falso CON transacciones: `getConnection` devuelve una conexion que apunta en la misma lista
// que el pool y marca el principio, la confirmacion y la vuelta atras. Lo sensible del perfil se
// escribe en transaccion desde que va con su entrada en la bitacora.
const poolConTransacciones = ({ fallaSi = null } = {}) => {
  const consultas = [];
  const ejecutar = async (sql, params) => {
    consultas.push({ sql, params });
    if (fallaSi && fallaSi.test(sql)) throw new Error("bitacora caida");
    return [[]];
  };
  const pool = {
    query: ejecutar,
    getConnection: async () => ({
      query: ejecutar,
      beginTransaction: async () => { consultas.push({ sql: "BEGIN" }); },
      commit: async () => { consultas.push({ sql: "COMMIT" }); },
      rollback: async () => { consultas.push({ sql: "ROLLBACK" }); },
      release: () => {}
    })
  };
  return { pool, consultas };
};

test("el genero y la etnia se guardan en su tabla, nunca en `persons`", async () => {
  const { pool, consultas } = poolConTransacciones();
  const repo = new UserRepository(pool);
  await repo.updateMe(7, { first_name: "Ana", genero_id: 2, autoidentificacion_etnica_id: "" });

  const updatePersons = consultas.find((c) => /UPDATE persons/.test(c.sql));
  assert.ok(updatePersons, "first_name tenia que actualizar persons");
  assert.doesNotMatch(updatePersons.sql, /genero_id|autoidentificacion_etnica_id/);

  const upsert = consultas.find((c) => /INSERT INTO persona_autoidentificacion/.test(c.sql));
  assert.ok(upsert, "tenia que guardar la autoidentificacion en su tabla");
  assert.deepEqual(upsert.params, [7, 2, null], "la cadena vacia se guarda como NULL");
});

// ── LA LECTURA: el titular ve sus datos personales, y SOLO el ────────────────────────────────────
//
// El titular los escribia por PATCH /users/me y no los podia leer. Se leen por una consulta propia
// que solo llaman los dos manejadores de /users/me, y NO por `findById` ni por `toPublicUser`: esa
// pareja la comparten el login, el listado de personas, el chat, el tiempo real y la firma, y el genero
// y la etnia (LOPDP, Art. 4) no deben viajar por ninguno de esos caminos.

const CLAVES_QUE_NO_SALEN = [...CAMPOS_DATOS_PERSONALES, "nacimiento_provincia_id", "datos_personales"];

// Lo que devolveria la consulta de `datosPersonalesDe`.
const DATOS_EN_BASE = {
  fecha_nacimiento: "1990-05-14",
  nacimiento_pais_id: 1,
  nacimiento_canton_id: 80,
  nacimiento_provincia_id: 8,
  sexo: "mujer",
  estado_civil_id: 2,
  genero_id: 2,
  autoidentificacion_etnica_id: 5
};

// Una fila de `persons` en el PEOR caso: como si alguien hubiera colgado de ella los siete campos.
// `toPublicUser` tiene que ignorarlos igual.
const FILA_PERSONA = {
  id: 7, first_name: "Ana", last_name: "Paz", token: "abc1234567", status: "Activo",
  ...DATOS_EN_BASE
};

const repoDePrueba = () => {
  const consultas = [];
  const repo = new UserRepository({
    query: async (sql, params) => {
      consultas.push({ sql, params });
      if (/persona_autoidentificacion/.test(sql)) return [[{ ...DATOS_EN_BASE }]];
      if (/FROM persons p/.test(sql)) return [[{ ...FILA_PERSONA }]];
      return [[]];
    }
  });
  // Los satelites (direcciones, telefonos...) no son lo que se prueba aqui.
  const vacio = { listarPorPersona: async () => [] };
  repo.direcciones = vacio;
  repo.telefonos = vacio;
  repo.emails = vacio;
  repo.documentos = vacio;
  return { repo, consultas };
};

const assertSinDatosPersonales = (usuario, donde) => {
  for (const clave of CLAVES_QUE_NO_SALEN) {
    assert.ok(!Object.hasOwn(usuario, clave), `${donde} NO puede llevar ${clave}`);
  }
};

test("las claves que lee el titular son las que acepta el PATCH, sensibles incluidas", async () => {
  for (const sensible of CAMPOS_AUTOIDENTIFICACION) {
    assert.ok(CAMPOS_DATOS_PERSONALES.includes(sensible), `falta ${sensible} en la lectura`);
  }
  const pasan = new Set(await camposQuePasan(CAMPOS_DATOS_PERSONALES));
  assert.deepEqual(CAMPOS_DATOS_PERSONALES.filter((c) => !pasan.has(c)), []);
});

test("toPublicUser NO saca ningun dato personal, aunque la fila los traiga", () => {
  const { repo } = repoDePrueba();
  const publico = repo.toPublicUser({ ...FILA_PERSONA }, { roleNames: [], permissions: [] });
  assert.equal(publico.first_name, "Ana");
  assertSinDatosPersonales(publico, "toPublicUser");
});

test("findById y findByEmail NO leen persona_autoidentificacion", async () => {
  const { repo, consultas } = repoDePrueba();
  const porId = await repo.findById(7);
  const porCorreo = await repo.findByEmail("ana@example.org");
  assert.ok(porId && porCorreo, "las dos lecturas tenian que encontrar a la persona");
  for (const { sql } of consultas) {
    assert.doesNotMatch(sql, /persona_autoidentificacion/, "la lectura compartida no toca lo sensible");
  }
  assert.ok(!Object.hasOwn(porId, "datos_personales"));
  assertSinDatosPersonales(repo.toPublicUser(porId), "toPublicUser(findById)");
});

test("el login no devuelve datos personales", async () => {
  const { repo } = repoDePrueba();
  const auth = new AuthService({
    userRepository: repo,
    passwordService: { verifyPassword: async () => true },
    tokenService: { attachRefreshToken: () => {}, createAccessToken: () => ({ token: "t", expiresIn: 60 }) },
    rbacService: { getUserAccess: async () => ({ roleNames: [], permissions: [] }) }
  });
  const { user } = await auth.login({ email: "ana@example.org", password: "x" }, {});
  assert.equal(user.first_name, "Ana");
  assertSinDatosPersonales(user, "la respuesta del login");
});

test("perfilDelTitular SI devuelve datos_personales, con las claves del PATCH y sin apuntarse en la bitacora", async () => {
  const { repo, consultas } = repoDePrueba();
  const perfil = await repo.perfilDelTitular(7, { roleNames: ["Usuario"], permissions: [] });

  assert.equal(perfil.first_name, "Ana");
  assert.deepEqual(perfil.roles, ["Usuario"], "el acceso se sigue componiendo como siempre");
  assert.deepEqual(
    Object.keys(perfil.datos_personales).sort(),
    [...CAMPOS_DATOS_PERSONALES, "nacimiento_provincia_id"].sort()
  );
  assert.deepEqual(perfil.datos_personales, DATOS_EN_BASE);
  // Los datos van SOLO en su objeto: fuera de el, el usuario es el publico de siempre.
  for (const clave of CAMPOS_DATOS_PERSONALES) {
    assert.ok(!Object.hasOwn(perfil, clave), `${clave} no puede ir suelto en el usuario`);
  }

  const sensible = consultas.find((c) => /persona_autoidentificacion/.test(c.sql));
  assert.deepEqual(sensible.params, [7], "se leen los del titular, y de nadie mas");
  assert.ok(!consultas.some((c) => /accesos_sensibles/.test(c.sql)), "el titular no es un tercero");
});

test("perfilDelTitular de una persona que no existe devuelve null", async () => {
  const repo = new UserRepository({ query: async () => [[]] });
  assert.equal(await repo.perfilDelTitular(999), null);
});

test("updateMe le devuelve al titular sus datos personales tras guardar", async () => {
  const { repo } = repoDePrueba();
  repo.update = async () => ({ id: 7, first_name: "Ana" });
  const actualizado = await repo.updateMe(7, { genero_id: 2 });
  assert.equal(actualizado.first_name, "Ana");
  assert.deepEqual(actualizado.datos_personales, DATOS_EN_BASE);
});

// ── LA ESCRITURA DEL TITULAR DEJA RASTRO ─────────────────────────────────────────────────────────
//
// El perfil era el unico camino que escribia lo sensible sin apuntarlo: solo lo hacia el editor de
// /admin, aunque el esquema prometia «toda escritura». Lo que el titular LEE de si mismo no se apunta;
// lo que CAMBIA, si -- es un hecho que hay que poder reconstruir.

test("lo sensible del perfil y su entrada en la bitacora van en UNA transaccion", async () => {
  const { pool, consultas } = poolConTransacciones();
  const repo = new UserRepository(pool);
  await repo.updateMe(7, { genero_id: 2 }, { ip: "10.0.0.9" });

  const orden = consultas
    .map((c) => c.sql.match(/^(BEGIN|COMMIT|ROLLBACK)$|INSERT INTO (persona_autoidentificacion|accesos_sensibles)/))
    .filter(Boolean)
    .map((m) => m[1] ?? m[2]);
  assert.deepEqual(orden, ["BEGIN", "persona_autoidentificacion", "accesos_sensibles", "COMMIT"]);

  const entrada = consultas.find((c) => /INSERT INTO accesos_sensibles/.test(c.sql));
  assert.deepEqual(
    entrada.params,
    [7, 7, "datos_sensibles", "persona_autoidentificacion", 7, "create", JSON.stringify({ campos: ["genero_id"] }), "10.0.0.9"],
    "titular y actor son la misma persona, y de los campos va el NOMBRE, no el valor"
  );
});

test("si la bitacora falla, el cambio sensible del perfil NO se confirma", async () => {
  const { pool, consultas } = poolConTransacciones({ fallaSi: /INSERT INTO accesos_sensibles/ });
  const repo = new UserRepository(pool);
  await assert.rejects(() => repo.updateMe(7, { genero_id: 2 }), /bitacora caida/);
  const marcas = consultas.map((c) => c.sql).filter((sql) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(sql));
  assert.deepEqual(marcas, ["BEGIN", "ROLLBACK"]);
});
