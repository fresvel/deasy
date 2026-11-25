import { ref } from 'vue';

// Carga de PANELES OPERATIVOS de proceso (singular, multi-proceso consolidado y refresco).
// Extraído de HomeView.vue en la Fase B del refactor del God Object.
//
// El composable POSEE su estado (Fase E-1 del plan de calidad). Antes recibía los siete refs de
// HomeView y les escribía encima: 28 asignaciones a refs ajenos, el patrón "Middle Man" invertido
// que impide razonar sobre el estado y testearlo por separado. Ahora los declara aquí y los
// devuelve, como useDeliverableFilePreview / useDocumentCenter / useDossierSection.
//
// Lo que SIGUE inyectándose es solo lo que NO es suyo:
//  - contexto de alcance (unidad/cargo/proceso activo) que vive en el aside y el panel consolidado,
//  - `processPanelService` (la dependencia de red),
//  - `resetTaskListFilters` (los filtros de la lista de tareas son de HomeView).
// Todas esas entradas son de SOLO LECTURA aquí: este módulo no escribe ni una.
export function useProcessPanels({
  activeConsolidatedUnitTab,
  consolidatedCargoProcesses,
  currentUserId,
  processPanelService,
  resetTaskListFilters,
  selectedConsolidatedProcessIds,
  selectedGroupId,
  selectedProcessContext,
  showCargosPanel,
  showProcessesPanel,
}) {
  // --- Estado propio -------------------------------------------------------
  const selectedProcessKey = ref(null);
  const selectedProcessPanel = ref(null);
  // En el panel consolidado pueden cargarse varios procesos a la vez (multi-selección).
  const selectedProcessPanels = ref([]);
  const processPanelLoading = ref(false);
  const processPanelError = ref('');
  const processActionMessage = ref(null);
  const activeProcessUnitTab = ref('all');

  const setProcessActionInfo = (text, type = 'success') => {
    processActionMessage.value = { text, type };
  };

  // Deja el panel como recién abierto. Lo llama HomeView desde clearSelectedProcess(), que además
  // limpia lo que sí es suyo (contexto, modal de lanzamiento, filtros).
  const resetProcessPanelState = () => {
    selectedProcessKey.value = null;
    selectedProcessPanel.value = null;
    selectedProcessPanels.value = [];
    processPanelError.value = '';
    processActionMessage.value = null;
    activeProcessUnitTab.value = 'all';
  };

  // --- Carga ---------------------------------------------------------------
  // Carga (en paralelo) los paneles de todos los procesos seleccionados del cargo activo.
  const loadSelectedProcessPanels = async () => {
    const processes = consolidatedCargoProcesses.value.filter((p) =>
      selectedConsolidatedProcessIds.value.includes(String(p.process_definition_id || p.id))
    );
    activeProcessUnitTab.value = 'all';
    if (!processes.length) {
      selectedProcessPanels.value = [];
      selectedProcessPanel.value = null;
      selectedProcessKey.value = null;
      return;
    }
    await loadProcessPanelsForProcesses(processes);
  };

  const loadSelectedProcessPanel = async (process) => {
    const userId = currentUserId.value;
    const definitionId = Number(process?.process_definition_id);
    if (!userId || !definitionId) {
      processPanelError.value = 'No se pudo identificar la configuración del proceso seleccionada.';
      return;
    }
    processPanelLoading.value = true;
    processPanelError.value = '';
    processActionMessage.value = null;
    try {
      // Filtrar por unidad solo cuando hay contexto explícito de unidad:
      // - Desde panel "Mis cargos": unit_id viene del card de la unidad específica
      // - Desde sidebar con unidad seleccionada: selectedGroupId apunta a esa unidad
      // - Desde sidebar "Todas las unidades" (selectedGroupId=null): sin filtro
      const scopeUnitId = showCargosPanel.value
        ? (process?.unit_id ? Number(process.unit_id) : null)
        : showProcessesPanel.value
          ? (activeConsolidatedUnitTab.value ? Number(activeConsolidatedUnitTab.value) : null)
          : (selectedGroupId.value ? Number(selectedGroupId.value) : null);
      const panel = await processPanelService.getPanel(userId, definitionId, scopeUnitId);
      if (panel?.definition && process?.access_source) {
        panel.definition.access_source = process.access_source;
      }
      selectedProcessPanel.value = panel;
      selectedProcessPanels.value = panel ? [{ definitionId, process, panel }] : [];
      selectedProcessKey.value = `${definitionId}`;
      activeProcessUnitTab.value = 'all';
      resetTaskListFilters();
    } catch (error) {
      console.error('Error al cargar el panel operativo de la configuración:', error);
      selectedProcessPanel.value = null;
      selectedProcessPanels.value = [];
      processPanelError.value = error?.response?.data?.message || 'No se pudo cargar la configuración seleccionada.';
    } finally {
      processPanelLoading.value = false;
    }
  };

  // Carga en paralelo los paneles de varios procesos (multi-selección del panel consolidado).
  const loadProcessPanelsForProcesses = async (processes, { resetFilters = true } = {}) => {
    const userId = currentUserId.value;
    if (!userId) {
      processPanelError.value = 'No se pudo identificar al usuario.';
      return;
    }
    processPanelLoading.value = true;
    processPanelError.value = '';
    processActionMessage.value = null;
    const scopeUnitId = activeConsolidatedUnitTab.value ? Number(activeConsolidatedUnitTab.value) : null;
    try {
      const results = await Promise.all(
        processes.map(async (process) => {
          const definitionId = Number(process?.process_definition_id || process?.id);
          if (!definitionId) return null;
          const panel = await processPanelService.getPanel(userId, definitionId, scopeUnitId);
          if (panel?.definition && process?.access_source) {
            panel.definition.access_source = process.access_source;
          }
          return panel ? { definitionId, process, panel } : null;
        })
      );
      selectedProcessPanels.value = results.filter(Boolean);
      // selectedProcessPanel apunta al primero, para compatibilidad con código existente.
      selectedProcessPanel.value = selectedProcessPanels.value[0]?.panel || null;
      selectedProcessKey.value = selectedProcessPanels.value[0]?.definitionId
        ? String(selectedProcessPanels.value[0].definitionId)
        : null;
      if (resetFilters) {
        activeProcessUnitTab.value = 'all';
        resetTaskListFilters();
      }
    } catch (error) {
      console.error('Error al cargar los paneles operativos:', error);
      selectedProcessPanels.value = [];
      selectedProcessPanel.value = null;
      processPanelError.value = error?.response?.data?.message || 'No se pudieron cargar los procesos seleccionados.';
    } finally {
      processPanelLoading.value = false;
    }
  };

  // Refresca el/los panel(es) activos tras una acción, preservando filtros y selección.
  // En modo consolidado recarga todos los procesos seleccionados; si no, el panel singular.
  const refreshActiveProcessPanel = async () => {
    if (showProcessesPanel.value && selectedProcessPanels.value.length) {
      const processes = consolidatedCargoProcesses.value.filter((p) =>
        selectedConsolidatedProcessIds.value.includes(String(p.process_definition_id || p.id))
      );
      if (processes.length) {
        await loadProcessPanelsForProcesses(processes, { resetFilters: false });
        return;
      }
    }
    if (selectedProcessContext.value) {
      await loadSelectedProcessPanel(selectedProcessContext.value);
    }
  };

  return {
    // estado propio
    activeProcessUnitTab,
    processActionMessage,
    processPanelError,
    processPanelLoading,
    selectedProcessKey,
    selectedProcessPanel,
    selectedProcessPanels,
    // acciones
    loadProcessPanelsForProcesses,
    loadSelectedProcessPanel,
    loadSelectedProcessPanels,
    refreshActiveProcessPanel,
    resetProcessPanelState,
    setProcessActionInfo,
  };
}
