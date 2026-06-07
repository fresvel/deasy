import assert from "node:assert/strict";
import test from "node:test";
import { resolveProcessDefinitionSeriesIdentity } from "./processDefinitionSeries.js";

const lookups = {
  findUnitType: async (id) => {
    if (Number(id) === 7) {
      return { id: 7, name: "Facultad" };
    }
    return null;
  },
  findCargo: async (id) => {
    if (Number(id) === 11) {
      return { id: 11, name: "Coordinador" };
    }
    return null;
  }
};

test("resuelve una variacion combinada por tipo de unidad y cargo", async () => {
  const identity = await resolveProcessDefinitionSeriesIdentity(
    {
      source_type: "unit_type_cargo",
      unit_type_id: "7",
      cargo_id: "11"
    },
    lookups
  );

  assert.deepEqual(identity, {
    source_type: "unit_type_cargo",
    unit_type_id: 7,
    cargo_id: 11,
    code: "unit-type-7-facultad-cargo-11-coordinador"
  });
});

test("normaliza las variaciones simples y descarta el campo que no aplica", async () => {
  const identity = await resolveProcessDefinitionSeriesIdentity(
    {
      source_type: "unit_type",
      unit_type_id: "7",
      cargo_id: "11"
    },
    lookups
  );

  assert.deepEqual(identity, {
    source_type: "unit_type",
    unit_type_id: 7,
    cargo_id: null,
    code: "facultad"
  });
});

test("exige ambos campos en una variacion combinada", async () => {
  await assert.rejects(
    resolveProcessDefinitionSeriesIdentity(
      {
        source_type: "unit_type_cargo",
        unit_type_id: "7",
        cargo_id: ""
      },
      lookups
    ),
    /seleccionar un cargo/
  );
});
