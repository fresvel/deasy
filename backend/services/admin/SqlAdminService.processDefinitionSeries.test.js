import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProcessDefinitionVersionName,
  resolveProcessDefinitionSeriesIdentity
} from "./processDefinitionSeries.js";

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

test("genera el nombre de configuracion desde proceso y serie usando por", () => {
  assert.equal(
    buildProcessDefinitionVersionName({
      processName: "Investigación Productiva",
      series: {
        source_type: "unit_type",
        code: "carrera",
        unit_type_name: "carrera"
      }
    }),
    "Investigación Productiva por Carrera"
  );
});

test("genera el nombre de configuracion combinando tipo de unidad y cargo", () => {
  assert.equal(
    buildProcessDefinitionVersionName({
      processName: "Investigación Productiva",
      series: {
        source_type: "unit_type_cargo",
        code: "unit-type-7-carrera-cargo-11-docente",
        unit_type_name: "carrera",
        cargo_name: "docente"
      }
    }),
    "Investigación Productiva por Carrera y Docente"
  );
});
