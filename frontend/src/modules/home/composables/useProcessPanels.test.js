import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { useProcessPanels } from "./useProcessPanels.js";

// El composable dejó de recibir los refs de HomeView para escribirlos (Fase E-1): ahora los POSEE.
// Estos tests fijan justo eso — el estado sale del composable y ninguna de las entradas se toca.

const panelDe = (id, over = {}) => ({
  definition: { id, name: `Proceso ${id}` },
  tasks: [],
  ...over
});

const montar = ({
  processes = [],
  selectedIds = [],
  userId = 7,
  getPanel = vi.fn(async (_u, definitionId) => panelDe(definitionId)),
  showCargosPanel = false,
  showProcessesPanel = false,
  selectedGroupId = null,
  activeConsolidatedUnitTab = null,
  selectedProcessContext = null
} = {}) => {
  const entradas = {
    activeConsolidatedUnitTab: ref(activeConsolidatedUnitTab),
    consolidatedCargoProcesses: computed(() => processes),
    currentUserId: ref(userId),
    selectedConsolidatedProcessIds: ref(selectedIds),
    selectedGroupId: ref(selectedGroupId),
    selectedProcessContext: ref(selectedProcessContext),
    showCargosPanel: ref(showCargosPanel),
    showProcessesPanel: ref(showProcessesPanel)
  };
  const resetTaskListFilters = vi.fn();
  const panels = useProcessPanels({
    ...entradas,
    processPanelService: { getPanel },
    resetTaskListFilters
  });
  return { panels, entradas, getPanel, resetTaskListFilters };
};

describe("useProcessPanels", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("propiedad del estado", () => {
    it("devuelve sus propios refs con los valores iniciales", () => {
      const { panels } = montar();
      expect(panels.selectedProcessKey.value).toBeNull();
      expect(panels.selectedProcessPanel.value).toBeNull();
      expect(panels.selectedProcessPanels.value).toEqual([]);
      expect(panels.processPanelLoading.value).toBe(false);
      expect(panels.processPanelError.value).toBe("");
      expect(panels.processActionMessage.value).toBeNull();
      expect(panels.activeProcessUnitTab.value).toBe("all");
    });

    it("dos instancias no comparten estado", async () => {
      const a = montar();
      const b = montar();
      await a.panels.loadSelectedProcessPanel({ process_definition_id: 3 });
      expect(a.panels.selectedProcessKey.value).toBe("3");
      expect(b.panels.selectedProcessKey.value).toBeNull();
    });

    it("no escribe en ninguna de las dependencias que recibe", async () => {
      const { panels, entradas } = montar({
        processes: [{ process_definition_id: 4 }],
        selectedIds: ["4"],
        showProcessesPanel: true
      });
      const antes = Object.fromEntries(
        Object.entries(entradas).map(([k, r]) => [k, r.value])
      );
      await panels.loadSelectedProcessPanels();
      await panels.refreshActiveProcessPanel();
      panels.resetProcessPanelState();
      for (const [clave, valor] of Object.entries(antes)) {
        expect(entradas[clave].value).toEqual(valor);
      }
    });

    it("resetProcessPanelState deja el panel como recién abierto", async () => {
      const { panels } = montar();
      await panels.loadSelectedProcessPanel({ process_definition_id: 5 });
      panels.setProcessActionInfo("hecho");
      panels.activeProcessUnitTab.value = "12";
      panels.resetProcessPanelState();
      expect(panels.selectedProcessKey.value).toBeNull();
      expect(panels.selectedProcessPanel.value).toBeNull();
      expect(panels.selectedProcessPanels.value).toEqual([]);
      expect(panels.processPanelError.value).toBe("");
      expect(panels.processActionMessage.value).toBeNull();
      expect(panels.activeProcessUnitTab.value).toBe("all");
    });

    it("setProcessActionInfo compone {text, type} y por defecto es success", () => {
      const { panels } = montar();
      panels.setProcessActionInfo("listo");
      expect(panels.processActionMessage.value).toEqual({ text: "listo", type: "success" });
      panels.setProcessActionInfo("falló", "error");
      expect(panels.processActionMessage.value).toEqual({ text: "falló", type: "error" });
    });
  });

  describe("loadSelectedProcessPanel", () => {
    it("carga el panel y fija clave, panel y lista de uno", async () => {
      const { panels, getPanel, resetTaskListFilters } = montar();
      await panels.loadSelectedProcessPanel({ process_definition_id: 9 });
      expect(getPanel).toHaveBeenCalledWith(7, 9, null);
      expect(panels.selectedProcessKey.value).toBe("9");
      expect(panels.selectedProcessPanel.value.definition.id).toBe(9);
      expect(panels.selectedProcessPanels.value).toHaveLength(1);
      expect(panels.activeProcessUnitTab.value).toBe("all");
      expect(resetTaskListFilters).toHaveBeenCalled();
      expect(panels.processPanelLoading.value).toBe(false);
    });

    it("propaga access_source a la definición del panel", async () => {
      const { panels } = montar();
      await panels.loadSelectedProcessPanel({ process_definition_id: 2, access_source: "cargo" });
      expect(panels.selectedProcessPanel.value.definition.access_source).toBe("cargo");
    });

    it("sin usuario o sin definición sale con error y no llama al servicio", async () => {
      const { panels, getPanel } = montar({ userId: null });
      await panels.loadSelectedProcessPanel({ process_definition_id: 3 });
      expect(getPanel).not.toHaveBeenCalled();
      expect(panels.processPanelError.value).toContain("No se pudo identificar la configuración");

      const sinDef = montar();
      await sinDef.panels.loadSelectedProcessPanel({});
      expect(sinDef.getPanel).not.toHaveBeenCalled();
    });

    it("ante un fallo limpia el panel y guarda el mensaje del backend", async () => {
      const getPanel = vi.fn().mockRejectedValue({ response: { data: { message: "boom" } } });
      const { panels } = montar({ getPanel });
      await panels.loadSelectedProcessPanel({ process_definition_id: 3 });
      expect(panels.selectedProcessPanel.value).toBeNull();
      expect(panels.selectedProcessPanels.value).toEqual([]);
      expect(panels.processPanelError.value).toBe("boom");
      expect(panels.processPanelLoading.value).toBe(false);
    });

    describe("alcance de unidad", () => {
      it("desde 'Mis cargos' usa el unit_id de la tarjeta", async () => {
        const { panels, getPanel } = montar({ showCargosPanel: true, selectedGroupId: 55 });
        await panels.loadSelectedProcessPanel({ process_definition_id: 1, unit_id: "8" });
        expect(getPanel).toHaveBeenCalledWith(7, 1, 8);
      });

      it("desde la vista consolidada usa la pestaña de unidad activa", async () => {
        const { panels, getPanel } = montar({ showProcessesPanel: true, activeConsolidatedUnitTab: "4" });
        await panels.loadSelectedProcessPanel({ process_definition_id: 1, unit_id: "8" });
        expect(getPanel).toHaveBeenCalledWith(7, 1, 4);
      });

      it("desde el aside usa la unidad seleccionada, y null si son todas", async () => {
        const conUnidad = montar({ selectedGroupId: "6" });
        await conUnidad.panels.loadSelectedProcessPanel({ process_definition_id: 1 });
        expect(conUnidad.getPanel).toHaveBeenCalledWith(7, 1, 6);

        const todas = montar({ selectedGroupId: null });
        await todas.panels.loadSelectedProcessPanel({ process_definition_id: 1 });
        expect(todas.getPanel).toHaveBeenCalledWith(7, 1, null);
      });
    });
  });

  describe("loadSelectedProcessPanels", () => {
    it("carga solo los procesos marcados del cargo activo", async () => {
      const { panels, getPanel } = montar({
        processes: [{ process_definition_id: 1 }, { process_definition_id: 2 }, { id: 3 }],
        selectedIds: ["1", "3"]
      });
      await panels.loadSelectedProcessPanels();
      expect(getPanel.mock.calls.map((c) => c[1])).toEqual([1, 3]);
      expect(panels.selectedProcessPanels.value).toHaveLength(2);
      // El singular apunta al primero, por compatibilidad con el resto de la vista.
      expect(panels.selectedProcessKey.value).toBe("1");
      expect(panels.selectedProcessPanel.value.definition.id).toBe(1);
    });

    it("sin procesos marcados vacía la selección sin llamar al servicio", async () => {
      const { panels, getPanel } = montar({
        processes: [{ process_definition_id: 1 }],
        selectedIds: []
      });
      panels.activeProcessUnitTab.value = "9";
      await panels.loadSelectedProcessPanels();
      expect(getPanel).not.toHaveBeenCalled();
      expect(panels.selectedProcessPanels.value).toEqual([]);
      expect(panels.selectedProcessPanel.value).toBeNull();
      expect(panels.selectedProcessKey.value).toBeNull();
      expect(panels.activeProcessUnitTab.value).toBe("all");
    });
  });

  describe("loadProcessPanelsForProcesses", () => {
    it("sin usuario no llama al servicio y deja error", async () => {
      const { panels, getPanel } = montar({ userId: null });
      await panels.loadProcessPanelsForProcesses([{ process_definition_id: 1 }]);
      expect(getPanel).not.toHaveBeenCalled();
      expect(panels.processPanelError.value).toBe("No se pudo identificar al usuario.");
    });

    it("descarta los procesos sin id y los paneles vacíos", async () => {
      const getPanel = vi.fn(async (_u, id) => (id === 2 ? null : panelDe(id)));
      const { panels } = montar({ getPanel });
      await panels.loadProcessPanelsForProcesses([
        { process_definition_id: 1 },
        { process_definition_id: 2 },
        { nada: true }
      ]);
      expect(panels.selectedProcessPanels.value.map((p) => p.definitionId)).toEqual([1]);
    });

    it("con resetFilters:false conserva la pestaña de unidad y no toca los filtros", async () => {
      const { panels, resetTaskListFilters } = montar();
      panels.activeProcessUnitTab.value = "11";
      await panels.loadProcessPanelsForProcesses([{ process_definition_id: 1 }], { resetFilters: false });
      expect(panels.activeProcessUnitTab.value).toBe("11");
      expect(resetTaskListFilters).not.toHaveBeenCalled();
    });

    it("ante un fallo limpia la selección y usa el mensaje por defecto", async () => {
      const getPanel = vi.fn().mockRejectedValue(new Error("red caída"));
      const { panels } = montar({ getPanel });
      await panels.loadProcessPanelsForProcesses([{ process_definition_id: 1 }]);
      expect(panels.selectedProcessPanels.value).toEqual([]);
      expect(panels.selectedProcessPanel.value).toBeNull();
      expect(panels.processPanelError.value).toBe("No se pudieron cargar los procesos seleccionados.");
    });
  });

  describe("refreshActiveProcessPanel", () => {
    it("en modo consolidado recarga los marcados sin resetear filtros", async () => {
      const { panels, getPanel, resetTaskListFilters } = montar({
        processes: [{ process_definition_id: 1 }, { process_definition_id: 2 }],
        selectedIds: ["1", "2"],
        showProcessesPanel: true
      });
      await panels.loadSelectedProcessPanels();
      resetTaskListFilters.mockClear();
      panels.activeProcessUnitTab.value = "3";
      await panels.refreshActiveProcessPanel();
      expect(getPanel).toHaveBeenCalledTimes(4);
      expect(panels.activeProcessUnitTab.value).toBe("3");
      expect(resetTaskListFilters).not.toHaveBeenCalled();
    });

    it("fuera del consolidado recarga el panel del contexto activo", async () => {
      const { panels, getPanel } = montar({
        selectedProcessContext: { process_definition_id: 42 }
      });
      await panels.refreshActiveProcessPanel();
      expect(getPanel).toHaveBeenCalledWith(7, 42, null);
      expect(panels.selectedProcessKey.value).toBe("42");
    });

    it("sin contexto ni paneles no hace nada", async () => {
      const { panels, getPanel } = montar();
      await panels.refreshActiveProcessPanel();
      expect(getPanel).not.toHaveBeenCalled();
    });
  });
});
