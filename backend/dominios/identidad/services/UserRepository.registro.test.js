// El alta del registro deja rastro del documento que crea, DENTRO de su transaccion.
//
// POR QUE EXISTE. El registro ya metia persona, satelites, documento y consentimiento en una sola
// transaccion, pero el documento -- un dato sensible-- no quedaba en `accesos_sensibles`. La suite de
// caracterizacion lo ejercita, pero no mira la bitacora: si alguien quitara el apunte, nada se pondria
// en rojo. Esta prueba si.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import UserRepository from "./UserRepository.js";

const poolDeRegistro = ({ fallaSi = null } = {}) => {
  const consultas = [];
  const ejecutar = async (sql, params) => {
    consultas.push({ sql, params });
    if (fallaSi && fallaSi.test(sql)) throw new Error("bitacora caida");
    if (/INSERT INTO persons/.test(sql)) return [{ insertId: 11 }];
    return [[]];
  };
  return {
    consultas,
    pool: {
      query: ejecutar,
      getConnection: async () => ({
        query: ejecutar,
        beginTransaction: async () => { consultas.push({ sql: "BEGIN" }); },
        commit: async () => { consultas.push({ sql: "COMMIT" }); },
        rollback: async () => { consultas.push({ sql: "ROLLBACK" }); },
        release: () => {}
      })
    }
  };
};

const ALTA = {
  password_hash: "$2b$10$hash",
  first_name: "Ana",
  last_name: "Paz",
  token: "tok1234567",
  documento: { tipo: "documento_nacional", numero: "1710034065" },
  ip: "10.0.0.3"
};

const repoCon = (pool) => {
  const repo = new UserRepository(pool);
  // El documento en si no es lo que se prueba: lo guarda su servicio, con la conexion de la transaccion.
  repo.documentos = {
    guardarPrincipal: async (_personId, _documento, conexion) => {
      await conexion.query("GUARDAR DOCUMENTO");
      return 55;
    }
  };
  return repo;
};

describe("el registro y la bitacora", () => {
  it("el documento del alta y su entrada van en LA MISMA transaccion, con la persona como actor", async () => {
    const { pool, consultas } = poolDeRegistro();
    await repoCon(pool).create(ALTA);

    const orden = consultas
      .map((c) => c.sql.match(/^(BEGIN|COMMIT|ROLLBACK|GUARDAR DOCUMENTO)$|INSERT INTO (persons|accesos_sensibles)/))
      .filter(Boolean)
      .map((m) => m[1] ?? m[2]);
    assert.deepEqual(orden, ["BEGIN", "persons", "GUARDAR DOCUMENTO", "accesos_sensibles", "COMMIT"]);

    const entrada = consultas.find((c) => /INSERT INTO accesos_sensibles/.test(c.sql));
    assert.deepEqual(
      entrada.params,
      [11, 11, "datos_sensibles", "documentos_identidad", 55, "create", JSON.stringify({ campos: ["numero", "tipo"] }), "10.0.0.3"]
    );
  });

  it("si la bitacora falla, el alta entera se deshace", async () => {
    const { pool, consultas } = poolDeRegistro({ fallaSi: /INSERT INTO accesos_sensibles/ });
    await assert.rejects(() => repoCon(pool).create(ALTA), /bitacora caida/);
    const marcas = consultas.map((c) => c.sql).filter((sql) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(sql));
    assert.deepEqual(marcas, ["BEGIN", "ROLLBACK"]);
  });

  it("un alta sin documento no escribe en la bitacora", async () => {
    const { pool, consultas } = poolDeRegistro();
    const { documento, ...sinDocumento } = ALTA;
    await repoCon(pool).create(sinDocumento);
    assert.ok(!consultas.some((c) => /accesos_sensibles/.test(c.sql)));
  });
});
