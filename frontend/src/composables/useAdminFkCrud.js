import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";

export function useAdminFkCrud({
  fkTable,
  fkFilters,
  fkCreateFields,
  fkCreateForm,
  fkCreateError,
  fkCreateLoading,
  fkCreateExitTarget,
  fkNestedExitTarget,
  skipFkReturnRestore,
  canCreateFkReference,
  resetFkFilters,
  resetFkCreateForm,
  buildFkCreatePayload,
  applyFkSelection,
  fetchFkRows,
  ensureFkInstance,
  getFkInstance,
  ensureFkViewerInstance,
  getFkViewerInstance,
  ensureFkFilterInstance,
  getFkFilterInstance,
  ensureFkCreateInstance,
  getFkCreateInstance
}) {
  const openFkViewer = (row) => {
    if (!row) {
      return;
    }
    fkNestedExitTarget.value = "search";
    skipFkReturnRestore.value = true;
    getFkInstance()?.hide();
    ensureFkViewerInstance();
    getFkViewerInstance()?.show();
  };

  const closeFkViewer = () => {
    getFkViewerInstance()?.hide();
  };

  const openFkFilterModal = () => {
    if (!fkTable.value) {
      return;
    }
    fkNestedExitTarget.value = "search";
    skipFkReturnRestore.value = true;
    getFkInstance()?.hide();
    ensureFkFilterInstance();
    getFkFilterInstance()?.show();
  };

  const cancelFkFilter = () => {
    getFkFilterInstance()?.hide();
  };

  const clearFkFilters = async () => {
    resetFkFilters();
    await fetchFkRows();
    getFkFilterInstance()?.hide();
  };

  const applyFkFilters = async () => {
    await fetchFkRows();
    getFkFilterInstance()?.hide();
  };

  const openFkCreate = () => {
    if (!canCreateFkReference.value) {
      return;
    }
    fkCreateError.value = "";
    fkCreateLoading.value = false;
    resetFkCreateForm();
    fkCreateExitTarget.value = "search";
    skipFkReturnRestore.value = true;
    getFkInstance()?.hide();
    ensureFkCreateInstance();
    getFkCreateInstance()?.show();
  };

  const cancelFkCreate = () => {
    fkCreateError.value = "";
    fkCreateExitTarget.value = "search";
    getFkCreateInstance()?.hide();
  };

  const submitFkCreate = async () => {
    if (!fkTable.value || !canCreateFkReference.value) {
      return;
    }
    const missingRequired = fkCreateFields.value.filter((field) => {
      if (!field.required) {
        return false;
      }
      const value = fkCreateForm.value[field.name];
      return value === "" || value === null || value === undefined;
    });
    if (missingRequired.length) {
      fkCreateError.value = `Completa los campos requeridos: ${missingRequired
        .map((field) => field.label || field.name)
        .join(", ")}.`;
      return;
    }

    fkCreateLoading.value = true;
    fkCreateError.value = "";
    try {
      const payload = buildFkCreatePayload();
      const { data } = await axios.post(API_ROUTES.ADMIN_SQL_TABLE(fkTable.value.table), payload);
      const createdRow = data && typeof data === "object" ? { ...payload, ...data } : { ...payload };
      if (createdRow.id === undefined || createdRow.id === null || createdRow.id === "") {
        const fallbackKey = fkTable.value?.primaryKeys?.[0];
        if (fallbackKey && createdRow[fallbackKey] !== undefined) {
          createdRow.id = createdRow[fallbackKey];
        }
      }
      applyFkSelection(createdRow);
      await fetchFkRows();
      fkCreateExitTarget.value = "parent";
      getFkCreateInstance()?.hide();
    } catch (err) {
      fkCreateError.value = err?.response?.data?.message || "No se pudo crear la referencia.";
    } finally {
      fkCreateLoading.value = false;
    }
  };

  return {
    openFkViewer,
    closeFkViewer,
    openFkFilterModal,
    cancelFkFilter,
    clearFkFilters,
    applyFkFilters,
    openFkCreate,
    cancelFkCreate,
    submitFkCreate
  };
}
