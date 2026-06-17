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

test("resuelve una variacion por tipo de unidad y descarta el cargo", async () => {
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

test("resuelve una variacion por cargo y descarta el tipo de unidad", async () => {
  const identity = await resolveProcessDefinitionSeriesIdentity(
    {
      source_type: "cargo",
      unit_type_id: "7",
      cargo_id: "11"
    },
    lookups
  );

  assert.deepEqual(identity, {
    source_type: "cargo",
    unit_type_id: null,
    cargo_id: 11,
    code: "coordinador"
  });
});

test("rechaza la variacion combinada (ya no es un origen valido)", async () => {
  await assert.rejects(
    resolveProcessDefinitionSeriesIdentity(
      {
        source_type: "unit_type_cargo",
        unit_type_id: "7",
        cargo_id: "11"
      },
      lookups
    ),
    /origen de serie valido/
  );
});

test("exige el cargo en una variacion por cargo", async () => {
  await assert.rejects(
    resolveProcessDefinitionSeriesIdentity(
      {
        source_type: "cargo",
        unit_type_id: "",
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

test("genera el nombre de configuracion para una variacion por cargo", () => {
  assert.equal(
    buildProcessDefinitionVersionName({
      processName: "Informe Anual",
      series: {
        source_type: "cargo",
        code: "docente",
        cargo_name: "docente"
      }
    }),
    "Informe Anual por Docente"
  );
});
