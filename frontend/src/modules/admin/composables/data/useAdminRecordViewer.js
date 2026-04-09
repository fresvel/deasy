import { adminRecordViewerService } from "@/modules/admin/services/AdminRecordViewerService";

export function useAdminRecordViewer({
  recordViewerTable,
  recordViewerRow,
  recordViewerLoading,
  recordViewerError,
  recordViewerRelatedSections,
  allTablesMap,
  getViewerFieldsForTable,
  isForeignKeyField,
  prefetchFkLabelsForRows,
  prefetchProcessLabelsForDefinitionRows,
  prefetchProcessDefinitionMeta,
  ensureRecordViewerInstance,
  getRecordViewerInstance,
  hideParentModals
}) {
  const loadRecordViewerRelatedSections = async (tableMeta, row) => {
    recordViewerRelatedSections.value = await adminRecordViewerService.loadRelatedSections({
      tableMeta,
      row,
      allTablesMap: allTablesMap.value,
      getViewerFieldsForTable,
      isForeignKeyField,
      prefetchFkLabelsForRows,
      prefetchProcessLabelsForDefinitionRows,
      prefetchProcessDefinitionMeta
    });
  };

  const openRecordViewer = async (row, tableMeta) => {
    if (!row || !tableMeta) {
      return;
    }

    hideParentModals();
    recordViewerTable.value = tableMeta;
    recordViewerRow.value = row;
    recordViewerError.value = "";
    recordViewerLoading.value = true;
    recordViewerRelatedSections.value = [];

    try {
      const fkFields = getViewerFieldsForTable(tableMeta)
        .filter((field) => isForeignKeyField(field))
        .map((field) => field.name);
      await prefetchFkLabelsForRows([row], fkFields);
      await prefetchProcessLabelsForDefinitionRows([row], tableMeta);
      await prefetchProcessDefinitionMeta([row], tableMeta);
      await loadRecordViewerRelatedSections(tableMeta, row);
    } catch (err) {
      recordViewerError.value = err?.response?.data?.message || "No se pudo cargar el registro.";
    } finally {
      recordViewerLoading.value = false;
    }

    ensureRecordViewerInstance();
    getRecordViewerInstance()?.show();
  };

  const closeRecordViewer = () => {
    getRecordViewerInstance()?.hide();
  };

  return {
    loadRecordViewerRelatedSections,
    openRecordViewer,
    closeRecordViewer
  };
}
