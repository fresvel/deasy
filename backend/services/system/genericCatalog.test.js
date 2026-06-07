import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERIC_CATALOG,
  getGenericCatalogOptions,
  seedGenericCatalog
} from "./genericCatalog.js";

class FakeConnection {
  constructor() {
    this.calls = [];
  }

  async query(sql, params = []) {
    this.calls.push({ sql, params });
    if (sql.startsWith("SELECT id FROM cargos")) {
      return [[{ id: 101 }]];
    }
    return [[], []];
  }
}

const callsContaining = (connection, fragment) =>
  connection.calls.filter(({ sql }) => sql.includes(fragment));

test("expone identificadores estables para los registros seleccionables", () => {
  const options = getGenericCatalogOptions();

  assert.deepEqual(
    options.unit_types.map(({ id }) => id),
    GENERIC_CATALOG.unit_types
  );
  assert.deepEqual(
    options.cargos.map(({ id }) => id),
    GENERIC_CATALOG.cargos.map(({ code }) => code)
  );
  assert.deepEqual(
    options.term_types.map(({ id }) => id),
    GENERIC_CATALOG.term_types.map(({ code }) => code)
  );
});

test("siembra solo los registros seleccionados y descarta identificadores desconocidos", async () => {
  const connection = new FakeConnection();
  const result = await seedGenericCatalog(
    connection,
    {
      unit_types: ["Dirección", "Sede", "No permitido"],
      relation_unit_types: false,
      cargos: ["COORDINADOR", "NO_EXISTE"],
      term_types: ["SEM"]
    },
    new Map([["GestorProcesos", 7]])
  );

  assert.deepEqual(result, {
    unit_types: 2,
    cargos: 1,
    term_types: 1
  });
  assert.deepEqual(
    callsContaining(connection, "INSERT INTO unit_types").map(({ params }) => params[0]),
    ["Dirección", "Sede"]
  );
  assert.deepEqual(
    callsContaining(connection, "INSERT IGNORE INTO cargos").map(({ params }) => params[0]),
    ["COORDINADOR"]
  );
  assert.deepEqual(
    callsContaining(connection, "INSERT IGNORE INTO term_types").map(({ params }) => params[0]),
    ["SEM"]
  );
  assert.equal(callsContaining(connection, "INSERT IGNORE INTO cargo_role_map").length, 1);
});

test("mantiene compatibilidad con true para seleccionar el catálogo completo", async () => {
  const connection = new FakeConnection();
  const result = await seedGenericCatalog(connection, {
    unit_types: true,
    relation_unit_types: true,
    cargos: true,
    term_types: true
  });

  assert.deepEqual(result, {
    unit_types: GENERIC_CATALOG.unit_types.length,
    relation_unit_types: GENERIC_CATALOG.relation_unit_types.length,
    cargos: GENERIC_CATALOG.cargos.length,
    term_types: GENERIC_CATALOG.term_types.length
  });
});
