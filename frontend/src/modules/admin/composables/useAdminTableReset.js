import { watch } from "vue";

export function useAdminTableReset({
  props,
  isModalShown,
  personAssignmentsModal,
  unitPositionSearchModal,
  getPersonAssignmentsInstance,
  getUnitPositionSearchInstance,
  resetInlineFkState,
  resetForm,
  resetPersonAssignments,
  positionMetaById,
  vacantSearchTerm,
  vacantPositionRows,
  vacantPositionError,
  vacantPositionLoading,
  processFilters,
  processFilterLabels,
  templateFilters,
  templateFilterLabels,
  documentFilters,
  documentFilterLabels,
  unitPositionFilters,
  vacantPositionFilters,
  unitPositionUnitTypeOptions,
  unitPositionUnitOptions,
  unitPositionCargoOptions,
  vacantPositionUnitTypeOptions,
  vacantPositionUnitOptions,
  vacantPositionCargoOptions,
  unassignedTemplateArtifactSearch,
  unassignedTemplateArtifactFilters,
  unassignedTemplateArtifactRows,
  unassignedTemplateArtifactError,
  unassignedTemplateArtifactLoading,
  processDefinitionInlineFilters,
  processTargetRuleInlineFilters,
  templateArtifactInlineFilters,
  processDefinitionProcessOptions,
  processDefinitionSeriesOptions,
  isPositionFilterTable,
  isPositionAssignmentsTable,
  isProcessDefinitionFilterTable,
  loadUnitPositionUnitTypeOptions,
  loadUnitPositionCargoOptions,
  loadVacantPositionUnitTypeOptions,
  loadVacantPositionCargoOptions,
  loadProcessDefinitionProcessOptions,
  loadProcessDefinitionSeriesOptions,
  fetchRows
}) {
  watch(
    () => props.table?.table,
    async () => {
      resetInlineFkState();
      const personAssignmentsInstance = getPersonAssignmentsInstance();
      const unitPositionSearchInstance = getUnitPositionSearchInstance();
      if (personAssignmentsInstance && isModalShown(personAssignmentsModal.value)) {
        personAssignmentsInstance.hide();
      }
      if (unitPositionSearchInstance && isModalShown(unitPositionSearchModal.value)) {
        unitPositionSearchInstance.hide();
      }
      resetForm();
      resetPersonAssignments();
      positionMetaById.value = {};
      vacantSearchTerm.value = "";
      vacantPositionRows.value = [];
      vacantPositionError.value = "";
      vacantPositionLoading.value = false;
      processFilters.value = {
        parent_id: "",
        is_active: ""
      };
      processFilterLabels.value = {
        parent_id: ""
      };
      templateFilters.value = {
        name: "",
        slug: "",
        description: "",
        process_id: ""
      };
      templateFilterLabels.value = {
        process_id: ""
      };
      documentFilters.value = {
        task_id: "",
        status: ""
      };
      documentFilterLabels.value = {
        task_id: ""
      };
      unitPositionFilters.value = {
        unit_type_id: "",
        unit_id: "",
        cargo_id: ""
      };
      vacantPositionFilters.value = {
        unit_type_id: "",
        unit_id: "",
        cargo_id: "",
        position_type: ""
      };
      unitPositionUnitTypeOptions.value = [];
      unitPositionUnitOptions.value = [];
      unitPositionCargoOptions.value = [];
      vacantPositionUnitTypeOptions.value = [];
      vacantPositionUnitOptions.value = [];
      vacantPositionCargoOptions.value = [];
      unassignedTemplateArtifactSearch.value = "";
      unassignedTemplateArtifactFilters.value = {
        is_active: ""
      };
      unassignedTemplateArtifactRows.value = [];
      unassignedTemplateArtifactError.value = "";
      unassignedTemplateArtifactLoading.value = false;
      processDefinitionInlineFilters.value = {
        process_id: "",
        variation_key: "",
        status: ""
      };
      processTargetRuleInlineFilters.value = {
        definition_status: ""
      };
      templateArtifactInlineFilters.value = {
        artifact_origin: "",
        artifact_stage: ""
      };
      processDefinitionProcessOptions.value = [];
      processDefinitionSeriesOptions.value = [];
      if (isPositionFilterTable.value) {
        await loadUnitPositionUnitTypeOptions();
        await loadUnitPositionCargoOptions();
      }
      if (isPositionAssignmentsTable.value) {
        await loadVacantPositionUnitTypeOptions();
        await loadVacantPositionCargoOptions();
      }
      if (isProcessDefinitionFilterTable.value) {
        await loadProcessDefinitionProcessOptions();
        await loadProcessDefinitionSeriesOptions();
      }
      await fetchRows();
    },
    { immediate: true }
  );
}
