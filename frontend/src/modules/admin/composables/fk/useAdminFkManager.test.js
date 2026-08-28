import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const get = vi.fn();
vi.mock("@/core/services/httpClient", () => ({ default: { get: (...args) => get(...args) } }));
vi.mock("@/core/config/apiConfig", () => ({
  API_ROUTES: { ADMIN_SQL_TABLE: (tabla) => `/admin/sql/${tabla}` }
}));

const { useAdminFkManager } = await import("./useAdminFkManager.js");

const montar = () => {
  const formData = ref({ nacionalidad_pais_id: "", first_name: "Ada" });
  const fkDisplay = ref({ nacionalidad_pais_id: "" });
  const api = useAdminFkManager({
    formData,
    fkDisplay,
    resolveFkTable: (columna) => (columna === "nacionalidad_pais_id" ? "paises" : ""),
    formatFkOptionLabel: (tabla, fila) => `${tabla}:${fila.name}`
  });
  return { formData, fkDisplay, ...api };
};

beforeEach(() => get.mockReset());

describe("useAdminFkManager", () => {
  it("pide a la tabla que resuelve la columna, y devuelve opciones con id y etiqueta", async () => {
    get.mockResolvedValue({ data: [{ id: 60, name: "Ecuador" }, { id: 68, name: "España" }] });
    const { buildFkSuggestProvider } = montar();

    const opciones = await buildFkSuggestProvider({ name: "nacionalidad_pais_id" })("ec");

    expect(get).toHaveBeenCalledWith("/admin/sql/paises", { params: { q: "ec", limit: 8 } });
    expect(opciones).toEqual([
      { id: 60, label: "paises:Ecuador", row: { id: 60, name: "Ecuador" } },
      { id: 68, label: "paises:España", row: { id: 68, name: "España" } }
    ]);
  });

  it("una columna que no apunta a ninguna tabla no llama a la API", async () => {
    const { buildFkSuggestProvider } = montar();
    expect(await buildFkSuggestProvider({ name: "first_name" })("a")).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  // El proveedor viaja como `prop` a `AdminLookupField`. Si se construyera uno nuevo en cada
  // render, la prop cambiaría de identidad en cada pulsación de tecla.
  it("devuelve SIEMPRE la misma función para la misma columna", () => {
    const { buildFkSuggestProvider } = montar();
    const a = buildFkSuggestProvider({ name: "nacionalidad_pais_id" });
    const b = buildFkSuggestProvider({ name: "nacionalidad_pais_id" });
    expect(a).toBe(b);
  });

  it("elegir una opción escribe el id en el formulario y la etiqueta en la pantalla", () => {
    const { formData, fkDisplay, selectFkOption } = montar();
    selectFkOption({ name: "nacionalidad_pais_id" }, { id: 60, label: "Ecuador" });
    expect(formData.value.nacionalidad_pais_id).toBe(60);
    expect(fkDisplay.value.nacionalidad_pais_id).toBe("Ecuador");
    // No pisa el resto del formulario.
    expect(formData.value.first_name).toBe("Ada");
  });

  it("limpiar borra LAS DOS cosas: sin esto la pantalla enseñaría un país que ya no se envía", () => {
    const { formData, fkDisplay, selectFkOption, clearFkSelection } = montar();
    selectFkOption({ name: "nacionalidad_pais_id" }, { id: 60, label: "Ecuador" });
    clearFkSelection("nacionalidad_pais_id");
    expect(formData.value.nacionalidad_pais_id).toBe("");
    expect(fkDisplay.value.nacionalidad_pais_id).toBe("");
  });
});
