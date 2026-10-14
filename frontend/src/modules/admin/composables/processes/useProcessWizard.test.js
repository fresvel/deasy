// EL PROCESO ACOTA, NO ACOMPAÑA (frente 25, P23 — 2026-10-14).
//
// Por qué existe este fichero. Hasta este frente el paso 1 del asistente pedía el proceso COMO
// CAMPO y traía todas las líneas: se podía elegir el proceso A y una línea del proceso B, y el
// contexto quedaba con un `process_id` que su propia línea contradecía. Es la misma enfermedad que
// `P22` quitó del esquema —una copia que puede discrepar—, sobrevivida en el formulario.
//
// Lo que se mide aquí es que la pareja contradictoria YA NO SE PUEDE FORMAR: el proceso viaja como
// `filter_process_id` del buscador, así que lo que no está no se puede elegir. Y que sin acotación
// no se filtra nada, que es el otro lado de la misma regla.
import { describe, it, expect, vi, beforeEach } from "vitest";

const list = vi.fn();
vi.mock("@/modules/admin/services/AdminSqlService", () => ({
  adminSqlService: { list: (...args) => list(...args) }
}));
vi.mock("@/modules/admin/services/ProcessDefinitionAdminService", () => ({
  processDefinitionAdminService: { evaluateChecklist: vi.fn() }
}));

const { useProcessWizard } = await import("./useProcessWizard.js");

const filas = (rows) => ({ data: rows });

describe("useProcessWizard · el buscador de líneas", () => {
  beforeEach(() => {
    list.mockReset();
  });

  it("sin acotación no manda ningún filtro de proceso", async () => {
    list.mockResolvedValue(filas([]));
    const wizard = useProcessWizard();
    await wizard.lineaSuggestProvider("inf");
    const [tabla, params] = list.mock.calls.at(-1);
    expect(tabla).toBe("lineas");
    expect(params.q).toBe("inf");
    expect(params.filter_process_id).toBeUndefined();
  });

  it("con proceso acotado, la búsqueda lo lleva como filtro", async () => {
    list.mockResolvedValue(filas([]));
    const wizard = useProcessWizard();
    wizard.filtroProcessId.value = "8";
    await wizard.lineaSuggestProvider("");
    expect(list.mock.calls.at(-1)[1].filter_process_id).toBe(8);
  });

  // Una línea RETIRADA no admite configuraciones nuevas —lo impone el backend y un disparador—, así
  // que ofrecerla sería ofrecer un error.
  it("no ofrece las líneas retiradas", async () => {
    list.mockResolvedValue(filas([
      { id: 1, nombre: "Viva", process_id: 8 },
      { id: 2, nombre: "Retirada", process_id: 8, effective_to: "2026-01-01" }
    ]));
    const wizard = useProcessWizard();
    const opciones = await wizard.lineaSuggestProvider("");
    expect(opciones.map((o) => o.label)).toEqual(["Viva"]);
  });

  // El sublabel lleva el proceso aunque esté acotado: elegir a ciegas es lo que permitía la pareja
  // contradictoria de antes.
  it("cada sugerencia dice de qué proceso es, quién la produce y dónde", async () => {
    list.mockImplementation(async (tabla) => {
      if (tabla === "processes") return filas([{ id: 8, name: "Evaluación docente" }]);
      if (tabla === "cargos") return filas([{ id: 2, name: "Docente" }]);
      if (tabla === "unit_types") return filas([{ id: 3, name: "Carrera" }]);
      if (tabla === "units") return filas([]);
      return filas([{ id: 5, nombre: "Informe", process_id: 8, cargo_id: 2, unit_scope_type: "unit_type", unit_type_id: 3 }]);
    });
    const wizard = useProcessWizard();
    await wizard.loadProcessOptions();
    const opciones = await wizard.lineaSuggestProvider("");
    expect(opciones[0].sublabel).toBe("Evaluación docente · Docente · Por tipo de unidad: Carrera");
  });
});

describe("useProcessWizard · el nombre que se previsualiza", () => {
  beforeEach(() => {
    list.mockReset();
  });

  // Es la identidad entera, no sólo la línea: dos configuraciones de la misma línea se llamaban
  // igual mientras el nombre fue una copia de `lineas.nombre`.
  it("junta la línea elegida y la versión", async () => {
    list.mockResolvedValue(filas([]));
    const wizard = useProcessWizard();
    wizard.elegirLinea({ row: { id: 5, nombre: "Informe de Gestión Docente", process_id: 8 } });
    wizard.definitionForm.value = { ...wizard.definitionForm.value, definition_version: "1.1.0" };
    expect(wizard.definitionNamePreview.value).toBe("Informe de Gestión Docente · 1.1.0");
  });

  it("sin línea elegida no previsualiza nada", () => {
    const wizard = useProcessWizard();
    expect(wizard.selectedLineaName.value).toBe("");
    expect(wizard.definitionNamePreview.value).toBe("1.0.0");
  });
});
