// La nacionalidad, que es el punto CIEGO de la caracterizacion.
//
// Por que existe este fichero. Al cambiar `persons.pais` (texto libre) por
// `nacionalidad_pais_id` (clave ajena a `paises`), `test:char:run` daba 301/301 en verde y el
// endpoint estaba ROTO: PATCH /users/me respondia 500 con "column nacionalidad of relation persons
// does not exist". Char no puede verlo por construccion -- ningun flujo caracterizado manda
// nacionalidad, asi que el resolver nunca se ejecuta. Se descubrio llamando a la API a mano.
//
// Esta es la red que faltaba: prueba el resolver directamente, con el pool simulado.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import UserRepository from "./UserRepository.js";

const repoCon = (filas) => {
  const consultas = [];
  const repo = new UserRepository({
    query: async (sql, params) => {
      consultas.push({ sql, params });
      return [filas];
    }
  });
  return { repo, consultas };
};

describe("UserRepository · resolveNacionalidadPaisId", () => {
  it("traduce el codigo ISO al id del pais", async () => {
    const { repo, consultas } = repoCon([{ id: 60 }]);
    assert.equal(await repo.resolveNacionalidadPaisId({ nacionalidad: "EC" }), 60);
    assert.deepEqual(consultas[0].params, ["EC"]);
  });

  it("normaliza minusculas y espacios", async () => {
    const { repo, consultas } = repoCon([{ id: 60 }]);
    await repo.resolveNacionalidadPaisId({ nacionalidad: "  ec  " });
    assert.deepEqual(consultas[0].params, ["EC"]);
  });

  it("da null cuando no viene nacionalidad, y tambien con cadena vacia", async () => {
    const { repo, consultas } = repoCon([]);
    assert.equal(await repo.resolveNacionalidadPaisId({}), null);
    assert.equal(await repo.resolveNacionalidadPaisId({ nacionalidad: "" }), null);
    assert.equal(consultas.length, 0, "no deberia consultar la base para vaciar el campo");
  });

  it("acepta el id ya resuelto, que es lo que manda el editor generico de /admin", async () => {
    const { repo, consultas } = repoCon([]);
    assert.equal(await repo.resolveNacionalidadPaisId({ nacionalidad_pais_id: "60" }), 60);
    assert.equal(consultas.length, 0);
  });

  it("RECHAZA un ISO que no esta en el catalogo, y lo marca como 400", async () => {
    const { repo } = repoCon([]);
    await assert.rejects(
      () => repo.resolveNacionalidadPaisId({ nacionalidad: "ZZ" }),
      (error) => {
        assert.match(error.message, /ZZ/);
        assert.equal(error.status, 400, "sin esta marca el transporte responde 500 a un dato mal enviado");
        return true;
      }
    );
  });
});

describe("UserRepository · update", () => {
  // El fallo concreto que se escapo: `updateMyProfile` llama a `update()` DIRECTAMENTE, sin pasar
  // por `updateMe`. Si la traduccion viviera en el llamador, este camino seguiria roto.
  it("traduce `nacionalidad` a la columna real antes de escribir", async () => {
    const consultas = [];
    const repo = new UserRepository({
      query: async (sql, params) => {
        consultas.push({ sql, params });
        if (/FROM paises/.test(sql)) return [[{ id: 60 }]];
        return [[{ id: 1, nacionalidad: "EC", nacionalidad_nombre: "Ecuador" }]];
      }
    });
    await repo.update(1, { nacionalidad: "EC", first_name: "Ana" });
    const update = consultas.find((c) => /UPDATE persons/.test(c.sql));
    assert.ok(update, "no se llego a actualizar");
    assert.match(update.sql, /nacionalidad_pais_id = \?/);
    assert.doesNotMatch(update.sql, /(^|[^_])nacionalidad = \?/, "no puede escribir una columna que no existe");
    assert.ok(update.params.includes(60), "deberia guardar el id, no el codigo");
  });

  it("no intenta escribir `nacionalidad_nombre`, que es de solo lectura del JOIN", async () => {
    const consultas = [];
    const repo = new UserRepository({
      query: async (sql, params) => {
        consultas.push({ sql, params });
        return [[{ id: 1 }]];
      }
    });
    await repo.update(1, { nacionalidad_nombre: "Ecuador", first_name: "Ana" });
    const update = consultas.find((c) => /UPDATE persons/.test(c.sql));
    assert.doesNotMatch(update.sql, /nacionalidad_nombre/);
  });
});
