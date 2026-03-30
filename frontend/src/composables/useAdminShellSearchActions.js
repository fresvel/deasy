import { onBeforeUnmount } from "vue";

export function useAdminShellSearchActions({
  props,
  searchInput,
  processDefinitionInlineFilters,
  processTargetRuleInlineFilters,
  templateArtifactInlineFilters,
  fetchRows,
  loadVacantPositions,
  loadUnassignedTemplateArtifacts,
  fetchFkRows,
  openProcessSearch,
  openDocumentSearch,
  openUnitPositionSearch,
  isPositionFilterTable
}) {
  let searchTimeout = null;
  let vacantSearchTimeout = null;
  let unassignedTemplateArtifactSearchTimeout = null;
  let fkSearchTimeout = null;

  const clearProcessDefinitionInlineFilters = async () => {
    processDefinitionInlineFilters.value = {
      process_id: "",
      variation_key: "",
      status: ""
    };
    await fetchRows();
  };

  const clearProcessTargetRuleInlineFilters = async () => {
    processTargetRuleInlineFilters.value = {
      definition_execution_mode: "",
      definition_status: ""
    };
    await fetchRows();
  };

  const clearTemplateArtifactInlineFilters = async () => {
    templateArtifactInlineFilters.value = {
      artifact_origin: "",
      artifact_stage: ""
    };
    await fetchRows();
  };

  const debouncedFkSearch = () => {
    if (fkSearchTimeout) {
      clearTimeout(fkSearchTimeout);
    }
    fkSearchTimeout = setTimeout(() => {
      fetchFkRows();
    }, 350);
  };

  const debouncedSearch = () => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      fetchRows();
    }, 400);
  };

  const debouncedVacantSearch = () => {
    if (vacantSearchTimeout) {
      clearTimeout(vacantSearchTimeout);
    }
    vacantSearchTimeout = setTimeout(() => {
      loadVacantPositions();
    }, 400);
  };

  const debouncedUnassignedTemplateArtifactSearch = () => {
    if (unassignedTemplateArtifactSearchTimeout) {
      clearTimeout(unassignedTemplateArtifactSearchTimeout);
    }
    unassignedTemplateArtifactSearchTimeout = setTimeout(() => {
      loadUnassignedTemplateArtifacts();
    }, 400);
  };

  const focusSearch = () => {
    searchInput.value?.focus();
  };

  const handleSearchAction = () => {
    if (props.table?.table === "processes") {
      openProcessSearch();
      return;
    }
    if (props.table?.table === "documents") {
      openDocumentSearch();
      return;
    }
    if (isPositionFilterTable.value) {
      openUnitPositionSearch();
      return;
    }
    focusSearch();
  };

  onBeforeUnmount(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    if (vacantSearchTimeout) {
      clearTimeout(vacantSearchTimeout);
    }
    if (unassignedTemplateArtifactSearchTimeout) {
      clearTimeout(unassignedTemplateArtifactSearchTimeout);
    }
    if (fkSearchTimeout) {
      clearTimeout(fkSearchTimeout);
    }
  });

  return {
    clearProcessDefinitionInlineFilters,
    clearProcessTargetRuleInlineFilters,
    clearTemplateArtifactInlineFilters,
    debouncedFkSearch,
    debouncedSearch,
    debouncedVacantSearch,
    debouncedUnassignedTemplateArtifactSearch,
    focusSearch,
    handleSearchAction
  };
}
