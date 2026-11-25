import { describe, it, expect } from "vitest";
import { isFieldVisible, buildFilterParams, dependentFieldNames, isPairedAway } from "./adminFieldRules.js";

const CAMPOS = [
  { name: "pais_id" },
  { name: "provincia_id", filterBy: { pais_id: "pais_id" }, showWhen: { field: "pais_id", isSet: true } },
  { name: "canton_id", filterBy: { provincia_id: "provincia_id" }, showWhen: { field: "provincia_id", isSet: true } }
];

describe("isFieldVisible", () => {
  it("sin showWhen se ve siempre", () => {
    expect(isFieldVisible({ name: "x" }, {})).toBe(true);
  });

  it("isSet: la provincia no aparece hasta que hay país", () => {
    const provincia = CAMPOS[1];
    expect(isFieldVisible(provincia, {})).toBe(false);
    expect(isFieldVisible(provincia, { pais_id: "" })).toBe(false);
    expect(isFieldVisible(provincia, { pais_id: "   " })).toBe(false);
    expect(isFieldVisible(provincia, { pais_id: 60 })).toBe(true);
  });

  // El 0 es un id válido en ninguna tabla, pero SÍ es un valor puesto: la regla mira si hay algo
  // escrito, no si el valor es verdadero. Con `!valor` esto habría fallado.
  it("el cero cuenta como valor puesto", () => {
    expect(isFieldVisible({ showWhen: { field: "n", isSet: true } }, { n: 0 })).toBe(true);
  });

  it("equals compara como texto: un id numérico y su string son el mismo valor", () => {
    const campo = { showWhen: { field: "source_type", equals: "cargo" } };
    expect(isFieldVisible(campo, { source_type: "cargo" })).toBe(true);
    expect(isFieldVisible(campo, { source_type: "unit_type" })).toBe(false);
    expect(isFieldVisible({ showWhen: { field: "id", equals: 7 } }, { id: "7" })).toBe(true);
  });

  it("anyOf y not", () => {
    expect(isFieldVisible({ showWhen: { field: "t", anyOf: ["a", "b"] } }, { t: "b" })).toBe(true);
    expect(isFieldVisible({ showWhen: { field: "t", anyOf: ["a", "b"] } }, { t: "c" })).toBe(false);
    expect(isFieldVisible({ showWhen: { field: "t", not: "a" } }, { t: "a" })).toBe(false);
    expect(isFieldVisible({ showWhen: { field: "t", not: "a" } }, { t: "b" })).toBe(true);
  });

  // Un metadato mal escrito no puede dejar el formulario en blanco.
  it("un showWhen sin field se ignora en vez de esconder el campo", () => {
    expect(isFieldVisible({ showWhen: { isSet: true } }, {})).toBe(true);
  });
});

describe("buildFilterParams", () => {
  it("traduce filterBy a los filter_* que el CRUD entiende", () => {
    expect(buildFilterParams(CAMPOS[2], { provincia_id: 13 })).toEqual({ filter_provincia_id: 13 });
  });

  // Mandar `filter_provincia_id=` pediría «los cantones de la provincia ''», que son TODAS: el
  // desplegable parecería filtrado y no lo estaría.
  it("un padre sin valor no manda el parámetro", () => {
    expect(buildFilterParams(CAMPOS[2], {})).toEqual({});
    expect(buildFilterParams(CAMPOS[2], { provincia_id: "" })).toEqual({});
  });

  it("un campo sin filterBy no manda nada", () => {
    expect(buildFilterParams({ name: "x" }, { a: 1 })).toEqual({});
  });
});

describe("dependentFieldNames", () => {
  // Sin la cascada: Ecuador → Manabí → Portoviejo, cambias a España, y Portoviejo se queda.
  it("cambiar el país invalida provincia Y cantón", () => {
    expect(dependentFieldNames("pais_id", CAMPOS)).toEqual(["provincia_id", "canton_id"]);
  });

  it("cambiar la provincia invalida sólo el cantón", () => {
    expect(dependentFieldNames("provincia_id", CAMPOS)).toEqual(["canton_id"]);
  });

  it("una hoja no arrastra nada", () => {
    expect(dependentFieldNames("canton_id", CAMPOS)).toEqual([]);
  });
});

describe("isPairedAway", () => {
  it("la longitud la pinta el mapa de la latitud, no ella misma", () => {
    expect(isPairedAway({ name: "longitud", pairedWith: "latitud" })).toBe(true);
    expect(isPairedAway({ name: "latitud", type: "geopoint" })).toBe(false);
  });
});

// El punto en la LISTA, no en el formulario.
//
// POR QUE EXISTE. `pairedWith` se filtraba solo en `editableFields`, asi que la lista pintaba DOS
// columnas para un unico punto -- y la primera con la etiqueta del control de mapa--: la cabecera
// decia «Ubicacion · Longitud» mientras debajo salian latitud y longitud. Lo vio el dueño.
describe("un geopoint ocupa UNA columna en la lista, no dos", () => {
  const CAMPOS_DIRECCION = [
    { name: "calle_primaria", label: "Calle primaria", type: "text" },
    { name: "latitud", label: "Ubicacion", type: "geopoint", pair: { lat: "latitud", lng: "longitud" } },
    { name: "longitud", label: "Longitud", type: "number", pairedWith: "latitud" }
  ];

  it("la longitud NO se pinta por su cuenta", () => {
    const columnas = CAMPOS_DIRECCION.filter((campo) => !isPairedAway(campo)).map((c) => c.name);
    expect(columnas).toEqual(["calle_primaria", "latitud"]);
  });

  it("y la latitud si, porque es la que lleva el par", () => {
    expect(isPairedAway(CAMPOS_DIRECCION[1])).toBe(false);
  });
});
