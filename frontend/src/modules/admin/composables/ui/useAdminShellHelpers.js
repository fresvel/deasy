import { adminFkService } from "@/modules/admin/services/AdminFkService";

export function useAdminShellHelpers({
  props,
  emit,
  formFields,
  formData,
  fkDisplay,
  fkFilters,
  fkCreateFields,
  fkCreateForm,
  resolveFkTable,
  isForeignKeyField,
  fetchFkLabel,
  getFkCachedLabel,
  fetchRows,
  selectedRow,
  ensureDeleteInstance,
  getDeleteInstance,
  processDefinitionVersioningSource,
  ensureProcessDefinitionVersioningInstance,
  getProcessDefinitionVersioningInstance,
  fkTable,
  recordViewerTable,
  formatValueForTable
}) {
  const refreshFormFkDisplayLabels = async () => {
    const fkFields = formFields.value.filter((field) => isForeignKeyField(field));
    if (!fkFields.length) {
      return;
    }
    const lookups = fkFields
      .map((field) => ({
        fieldName: field.name,
        tableName: resolveFkTable(field.name),
        value: formData.value[field.name]
      }))
      .filter(({ tableName, value }) => tableName && value !== null && value !== undefined && value !== "");

    await Promise.all(
      lookups.map(({ tableName, value }) => fetchFkLabel(tableName, value))
    );

    const nextDisplay = { ...fkDisplay.value };
    fkFields.forEach((field) => {
      const value = formData.value[field.name];
      if (value === null || value === undefined || value === "") {
        nextDisplay[field.name] = "";
        return;
      }
      const tableName = resolveFkTable(field.name);
      const label = getFkCachedLabel(tableName, value);
      nextDisplay[field.name] = label !== null && label !== undefined
        ? String(label)
        : String(value);
    });
    fkDisplay.value = nextDisplay;
  };

  const buildFkFilterParams = () => adminFkService.buildFilterParams(fkFilters.value);

  const buildFkCreatePayload = () => (
    adminFkService.buildCreatePayload(fkCreateFields.value, fkCreateForm.value)
  );

  const buildKeys = (row) => {
    const keys = {};
    props.table?.primaryKeys?.forEach((key) => {
      keys[key] = row?.[key];
    });
    return keys;
  };

  const handleGoBack = () => {
    emit("go-back");
  };

  const formatFkViewerValue = (field, row) => {
    if (!row || !field) {
      return "—";
    }
    return formatValueForTable(fkTable.value, row[field.name], field, row);
  };

  const formatRecordViewerValue = (field, row) => {
    if (!row || !field) {
      return "—";
    }
    return formatValueForTable(recordViewerTable.value, row[field.name], field, row);
  };

  const openDelete = (row) => {
    selectedRow.value = row;
    ensureDeleteInstance();
    getDeleteInstance()?.show();
  };

  const openProcessDefinitionVersioningModal = () => {
    processDefinitionVersioningSource.value = selectedRow.value ? { ...selectedRow.value } : null;
    ensureProcessDefinitionVersioningInstance();
    getProcessDefinitionVersioningInstance()?.show();
  };

  const closeProcessDefinitionVersioningModal = () => {
    getProcessDefinitionVersioningInstance()?.hide();
    processDefinitionVersioningSource.value = null;
  };

  const clearFkUnitPositionFilters = async (fkPositionFilters, fkUnitOptions, fkCargoOptions, fkUnitTypeOptions, fetchFkRows) => {
    fkPositionFilters.value = {
      unit_type_id: "",
      unit_id: "",
      cargo_id: ""
    };
    fkUnitTypeOptions.value = [];
    fkUnitOptions.value = [];
    fkCargoOptions.value = [];
    await fetchFkRows();
  };

  const clearFkProcessDefinitionFilters = async (fkFiltersRef, fetchFkRowsRef) => {
    fkFiltersRef.value = {
      ...fkFiltersRef.value,
      process_id: "",
      variation_key: "",
      status: "active"
    };
    await fetchFkRowsRef();
  };

  const clearFkTemplateArtifactFilters = async (fkFiltersRef, fetchFkRowsRef) => {
    fkFiltersRef.value = {
      ...fkFiltersRef.value,
      template_code: "",
      storage_version: "",
      is_active: ""
    };
    await fetchFkRowsRef();
  };

  return {
    refreshFormFkDisplayLabels,
    buildFkFilterParams,
    buildFkCreatePayload,
    buildKeys,
    handleGoBack,
    formatFkViewerValue,
    formatRecordViewerValue,
    openDelete,
    openProcessDefinitionVersioningModal,
    closeProcessDefinitionVersioningModal,
    clearFkUnitPositionFilters,
    clearFkProcessDefinitionFilters,
    clearFkTemplateArtifactFilters
  };
}
