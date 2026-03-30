import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";

export function useAdminSearchFilters({
  props,
  formData,
  fkDisplay,
  fkTable,
  processFilters,
  processFilterLabels,
  templateFilters,
  templateFilterLabels,
  documentFilters,
  documentFilterLabels,
  unitPositionFilters,
  unitPositionUnitOptions,
  unitPositionUnitTypeOptions,
  unitPositionCargoOptions,
  vacantSearchTerm,
  vacantPositionFilters,
  vacantPositionUnitOptions,
  unassignedTemplateArtifactSearch,
  unassignedTemplateArtifactFilters,
  getTemplateSearchInstance,
  getProcessSearchInstance,
  getDocumentSearchInstance,
  getUnitPositionSearchInstance,
  isUnitPositionsTable,
  isPositionAssignmentsTable,
  isPositionFilterTable,
  fetchRows,
  loadVacantPositions,
  loadUnassignedTemplateArtifacts,
  loadUnitPositionUnitTypeOptions,
  loadUnitPositionCargoOptions,
  loadUnitPositionUnitOptions,
  loadVacantPositionUnitOptions,
  openFkSearch,
  resolveDisplayField,
  fetchFkLabel,
  getFkCachedLabel,
  openCreate,
  ensureProcessSearchInstance,
  ensureDocumentSearchInstance,
  ensureUnitPositionSearchInstance
}) {
  const openProcessSearch = () => {
    ensureProcessSearchInstance();
    getProcessSearchInstance()?.show();
  };

  const openDocumentSearch = () => {
    ensureDocumentSearchInstance();
    getDocumentSearchInstance()?.show();
  };

  const openUnitPositionSearch = async () => {
    ensureUnitPositionSearchInstance();
    if (!unitPositionUnitTypeOptions.value.length) {
      await loadUnitPositionUnitTypeOptions();
    }
    if (!unitPositionCargoOptions.value.length) {
      await loadUnitPositionCargoOptions();
    }
    if (unitPositionFilters.value.unit_type_id) {
      await loadUnitPositionUnitOptions();
    }
    getUnitPositionSearchInstance()?.show();
  };

  const applyProcessFilter = async () => {
    await fetchRows();
    getProcessSearchInstance()?.hide();
  };

  const clearProcessFilter = async () => {
    processFilters.value = {
      parent_id: "",
      is_active: ""
    };
    processFilterLabels.value = {
      parent_id: ""
    };
    await fetchRows();
  };

  const clearProcessParentFilter = () => {
    processFilters.value = {
      ...processFilters.value,
      parent_id: ""
    };
    processFilterLabels.value = {
      ...processFilterLabels.value,
      parent_id: ""
    };
  };

  const applyTemplateFilter = async () => {
    await fetchRows();
    getTemplateSearchInstance()?.hide();
  };

  const clearTemplateFilter = async () => {
    templateFilters.value = {
      name: "",
      slug: "",
      description: "",
      process_id: ""
    };
    templateFilterLabels.value = {
      process_id: ""
    };
    await fetchRows();
  };

  const clearTemplateProcessFilter = () => {
    templateFilters.value = {
      ...templateFilters.value,
      process_id: ""
    };
    templateFilterLabels.value = {
      ...templateFilterLabels.value,
      process_id: ""
    };
  };

  const applyDocumentFilter = async () => {
    await fetchRows();
    getDocumentSearchInstance()?.hide();
  };

  const clearDocumentFilter = async () => {
    documentFilters.value = {
      task_id: "",
      status: ""
    };
    documentFilterLabels.value = {
      task_id: ""
    };
    await fetchRows();
  };

  const clearDocumentTaskFilter = () => {
    documentFilters.value = {
      ...documentFilters.value,
      task_id: ""
    };
    documentFilterLabels.value = {
      ...documentFilterLabels.value,
      task_id: ""
    };
  };

  const refreshUnitPositionScope = async () => {
    if (isUnitPositionsTable.value || isPositionAssignmentsTable.value) {
      await fetchRows();
    }
  };

  const handleUnitPositionTypeChange = async () => {
    unitPositionFilters.value = {
      ...unitPositionFilters.value,
      unit_id: ""
    };
    await loadUnitPositionUnitOptions();
    await refreshUnitPositionScope();
  };

  const handleUnitPositionUnitChange = async () => {
    await refreshUnitPositionScope();
  };

  const handleUnitPositionCargoChange = async () => {
    await refreshUnitPositionScope();
  };

  const applyUnitPositionFilter = async () => {
    await refreshUnitPositionScope();
    getUnitPositionSearchInstance()?.hide();
  };

  const clearUnitPositionFilter = async () => {
    unitPositionFilters.value = {
      unit_type_id: "",
      unit_id: "",
      cargo_id: ""
    };
    unitPositionUnitOptions.value = [];
    await refreshUnitPositionScope();
  };

  const clearUnitPositionInlineFilters = async () => {
    unitPositionFilters.value = {
      unit_type_id: "",
      unit_id: "",
      cargo_id: ""
    };
    unitPositionUnitOptions.value = [];
    await refreshUnitPositionScope();
  };

  const clearVacantPositionFilters = async () => {
    vacantSearchTerm.value = "";
    vacantPositionFilters.value = {
      unit_type_id: "",
      unit_id: "",
      cargo_id: "",
      position_type: ""
    };
    vacantPositionUnitOptions.value = [];
    await loadVacantPositions();
  };

  const clearUnassignedTemplateArtifactFilters = async () => {
    unassignedTemplateArtifactSearch.value = "";
    unassignedTemplateArtifactFilters.value = {
      is_active: ""
    };
    await loadUnassignedTemplateArtifacts();
  };

  const handleVacantPositionTypeChange = async () => {
    vacantPositionFilters.value = {
      ...vacantPositionFilters.value,
      unit_id: ""
    };
    await loadVacantPositionUnitOptions();
    await loadVacantPositions();
  };

  const handleVacantPositionUnitChange = async () => {
    await loadVacantPositions();
  };

  const handleVacantPositionCargoChange = async () => {
    await loadVacantPositions();
  };

  const handleVacantPositionTypeFilterChange = async () => {
    await loadVacantPositions();
  };

  const deactivateVacantPosition = async (row) => {
    const positionId = row?.id;
    if (!positionId) {
      return;
    }
    if (!window.confirm("¿Deseas desactivar este puesto?")) {
      return;
    }
    try {
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
        keys: { id: positionId },
        data: {
          is_active: 0,
          deactivated_at: new Date().toISOString().slice(0, 19).replace("T", " ")
        }
      });
      await loadVacantPositions();
    } catch {}
  };

  const assignVacantPosition = async (row) => {
    const positionId = row?.id;
    if (!positionId || !isPositionAssignmentsTable.value) {
      return;
    }
    await openCreate();
    formData.value = {
      ...formData.value,
      position_id: String(positionId),
      start_date: formData.value.start_date || new Date().toISOString().slice(0, 10),
      is_current: "1"
    };
    await fetchFkLabel("unit_positions", positionId);
    const label = getFkCachedLabel("unit_positions", positionId);
    fkDisplay.value = {
      ...fkDisplay.value,
      position_id: label !== null && label !== undefined ? String(label) : String(positionId)
    };
  };

  const openTemplateFkSearch = () => {
    openFkSearch({ name: "process_id" }, (row) => {
      const idValue = row.id ?? "";
      templateFilters.value = {
        ...templateFilters.value,
        process_id: idValue
      };
      const displayField = resolveDisplayField(fkTable.value);
      const labelValue = row[displayField] ?? row.id;
      templateFilterLabels.value = {
        process_id: labelValue ? String(labelValue) : ""
      };
    });
  };

  const openDocumentFkSearch = (fieldName) => {
    if (!fieldName) {
      return;
    }
    openFkSearch({ name: fieldName }, (row) => {
      const idValue = row.id ?? "";
      documentFilters.value = {
        ...documentFilters.value,
        [fieldName]: idValue
      };
      const displayField = resolveDisplayField(fkTable.value);
      const labelValue = row[displayField] ?? row.id;
      documentFilterLabels.value = {
        ...documentFilterLabels.value,
        [fieldName]: labelValue ? String(labelValue) : ""
      };
    });
  };

  const openProcessFkSearch = (fieldName) => {
    if (!fieldName) {
      return;
    }
    openFkSearch({ name: fieldName }, (row) => {
      const idValue = row.id ?? "";
      processFilters.value = {
        ...processFilters.value,
        [fieldName]: idValue
      };
      const displayField = resolveDisplayField(fkTable.value);
      const labelValue = row[displayField] ?? row.id;
      processFilterLabels.value = {
        ...processFilterLabels.value,
        [fieldName]: labelValue ? String(labelValue) : ""
      };
    });
  };

  return {
    openProcessSearch,
    openDocumentSearch,
    openUnitPositionSearch,
    applyProcessFilter,
    clearProcessFilter,
    clearProcessParentFilter,
    applyTemplateFilter,
    clearTemplateFilter,
    clearTemplateProcessFilter,
    applyDocumentFilter,
    clearDocumentFilter,
    clearDocumentTaskFilter,
    refreshUnitPositionScope,
    handleUnitPositionTypeChange,
    handleUnitPositionUnitChange,
    handleUnitPositionCargoChange,
    applyUnitPositionFilter,
    clearUnitPositionFilter,
    clearUnitPositionInlineFilters,
    clearVacantPositionFilters,
    clearUnassignedTemplateArtifactFilters,
    handleVacantPositionTypeChange,
    handleVacantPositionUnitChange,
    handleVacantPositionCargoChange,
    handleVacantPositionTypeFilterChange,
    deactivateVacantPosition,
    assignVacantPosition,
    openTemplateFkSearch,
    openDocumentFkSearch,
    openProcessFkSearch
  };
}
