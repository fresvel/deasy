// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useDocumentCenter } from "./useDocumentCenter.js";

const fila = (over = {}) => ({
  document_id: 1,
  template_artifact_name: "Informe general",
  process_name: "Gestión Docente",
  unit_label: "Carrera de Sistemas",
  term_name: "2024-1",
  term_type_name: "Semestre",
  term_year: 2024,
  document_version_status: "Pendiente de llenado",
  pending_fill_count: 1,
  ...over
});

const montar = (documents = [], { userId = 3 } = {}) => {
  const fetchDocuments = vi.fn().mockResolvedValue({ documents });
  const centro = useDocumentCenter({ fetchDocuments, userId: ref(userId) });
  return { centro, fetchDocuments };
};

describe("useDocumentCenter", () => {
  describe("carga", () => {
    it("guarda los documentos que llegan", async () => {
      const { centro, fetchDocuments } = montar([fila(), fila({ document_id: 2 })]);
      await centro.load();
      expect(fetchDocuments).toHaveBeenCalledWith(3);
      expect(centro.items.value).toHaveLength(2);
      expect(centro.error.value).toBe("");
    });

    it("sin usuario no llama al backend", async () => {
      const { centro, fetchDocuments } = montar([], { userId: null });
      await centro.load();
      expect(fetchDocuments).not.toHaveBeenCalled();
    });

    it("una respuesta sin array no rompe: lista vacia", async () => {
      const fetchDocuments = vi.fn().mockResolvedValue({});
      const centro = useDocumentCenter({ fetchDocuments, userId: ref(3) });
      await centro.load();
      expect(centro.items.value).toEqual([]);
    });

    it("si falla, mensaje del backend y lista vacia", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const fetchDocuments = vi.fn().mockRejectedValue({ response: { data: { message: "Sin permiso" } } });
      const centro = useDocumentCenter({ fetchDocuments, userId: ref(3) });
      centro.items.value = [fila()];
      await centro.load();
      expect(centro.items.value).toEqual([]);
      expect(centro.error.value).toBe("Sin permiso");
      expect(centro.loading.value).toBe(false);
    });

    it("loading vuelve a false aunque reviente", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const fetchDocuments = vi.fn().mockRejectedValue(new Error("boom"));
      const centro = useDocumentCenter({ fetchDocuments, userId: ref(3) });
      await centro.load();
      expect(centro.loading.value).toBe(false);
    });
  });

  describe("filtros", () => {
    let centro;
    beforeEach(async () => {
      ({ centro } = montar([
        fila({ document_id: 1, process_name: "Gestión Docente", unit_label: "Sistemas", term_year: 2024 }),
        fila({ document_id: 2, process_name: "Titulación", unit_label: "Sistemas", term_year: 2025 }),
        fila({ document_id: 3, process_name: "Gestión Docente", unit_label: "Enfermería", term_year: 2024,
               template_artifact_name: "Acta de reunión" })
      ]));
      await centro.load();
    });

    it("sin filtros se ven todos", () => {
      expect(centro.filteredItems.value).toHaveLength(3);
    });

    it("la busqueda mira nombre, proceso, unidad y periodo", () => {
      centro.filters.value.query = "acta";
      expect(centro.filteredItems.value.map((i) => i.document_id)).toEqual([3]);
      centro.filters.value.query = "enfermer";
      expect(centro.filteredItems.value.map((i) => i.document_id)).toEqual([3]);
      centro.filters.value.query = "titulación";
      expect(centro.filteredItems.value.map((i) => i.document_id)).toEqual([2]);
    });

    it("la busqueda ignora mayusculas y espacios sobrantes", () => {
      centro.filters.value.query = "  ACTA  ";
      expect(centro.filteredItems.value).toHaveLength(1);
    });

    it("los filtros se acumulan", () => {
      centro.filters.value.process = "Gestión Docente";
      expect(centro.filteredItems.value).toHaveLength(2);
      centro.filters.value.unit = "Sistemas";
      expect(centro.filteredItems.value.map((i) => i.document_id)).toEqual([1]);
    });

    it("filtra por año", () => {
      centro.filters.value.year = 2025;
      expect(centro.filteredItems.value.map((i) => i.document_id)).toEqual([2]);
    });

    it("reset devuelve todo", () => {
      centro.filters.value.query = "acta";
      centro.filters.value.process = "Titulación";
      centro.resetFilters();
      expect(centro.filteredItems.value).toHaveLength(3);
    });
  });

  describe("opciones de los desplegables", () => {
    it("salen de los datos, sin repetir y ordenadas", async () => {
      const { centro } = montar([
        fila({ process_name: "Titulación", unit_label: "Sistemas" }),
        fila({ process_name: "Gestión Docente", unit_label: "Sistemas" }),
        fila({ process_name: "Gestión Docente", unit_label: "Enfermería" })
      ]);
      await centro.load();
      expect(centro.filterProcesses.value).toEqual(["Gestión Docente", "Titulación"]);
      expect(centro.filterUnits.value).toEqual(["Enfermería", "Sistemas"]);
    });

    it("los años van del mas reciente al mas antiguo", async () => {
      const { centro } = montar([fila({ term_year: 2023 }), fila({ term_year: 2025 }), fila({ term_year: 2024 })]);
      await centro.load();
      expect(centro.filterYears.value).toEqual(["2025", "2024", "2023"]);
    });

    it("los valores vacios no llegan al desplegable", async () => {
      const { centro } = montar([fila({ unit_label: "" }), fila({ unit_label: null }), fila({ unit_label: "Sistemas" })]);
      await centro.load();
      expect(centro.filterUnits.value).toEqual(["Sistemas"]);
    });
  });

  it("cada pantalla tiene su propio estado", () => {
    const a = montar([]).centro;
    const b = montar([]).centro;
    a.filters.value.query = "x";
    expect(b.filters.value.query).toBe("");
  });
});
