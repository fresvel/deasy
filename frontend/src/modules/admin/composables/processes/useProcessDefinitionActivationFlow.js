import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";
import { processDefinitionAdminService } from "@/modules/admin/services/ProcessDefinitionAdminService";

export function useProcessDefinitionActivationFlow({
  props,
  formData,
  // `fkDisplay` SALIO DE LA FIRMA con `P22` (frente 25): su unico uso era rellenar la etiqueta del
  // selector de proceso al versionar, y la configuracion ya no tiene `process_id` — lo dice su
  // linea, cuya etiqueta la pone `linea_id`. Un parametro que nadie usa es una dependencia falsa.
  editorMode,
  selectedRow,
  modalError,
  getEditorInstance,
  processDefinitionVersioningSource,
  processDefinitionCloneSourceId,
  processDefinitionChecklistLoading,
  processDefinitionChecklist,
  processDefinitionActivationConfirmed,
  processDefinitionActivationFromEditor,
  processDefinitionActivationChecking,
  processDefinitionActivationHasActiveTriggers,
  processDefinitionActivationHasActiveArtifacts,
  processDefinitionActivationView,
  processDefinitionActivationTriggers,
  processDefinitionActivationArtifacts,
  clearModalOrigins,
  ensureProcessDefinitionActivationInstance,
  getProcessDefinitionActivationInstance,
  buildFormFromRow,
  refreshFormFkDisplayLabels,
  prefetchFkLabelsForRows,
  normalizeComparableFormValue,
  getNextSemanticVersion,
  openEdit,
  openDefinitionTriggersFromActivation,
  openDefinitionArtifactsFromActivation,
  submitForm
}) {
  let suppressNextActivationCancel = false;
  const resolveEditorInstance = () => (
    typeof getEditorInstance === "function" ? getEditorInstance() : getEditorInstance
  );
  const blurActiveElement = () => {
    if (typeof document === "undefined") {
      return;
    }
    document.activeElement?.blur?.();
  };

  const loadProcessDefinitionActivationDetail = async (definitionId) => {
    processDefinitionActivationTriggers.value = [];
    processDefinitionActivationArtifacts.value = [];
    if (!definitionId) {
      return;
    }
    // DOS LISTAS, Y ERAN TRES (frente 25, P26): la de reglas pedia una tabla retirada --y la pedia
    // ordenada por `priority`, una columna que se habia ido en `P10`--.
    const [triggersResponse, artifactsResponse] = await Promise.all([
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_period_types"), {
        params: {
          filter_process_definition_id: definitionId,
          orderBy: "created_at",
          order: "desc",
          limit: 100
        }
      }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("vinculos"), {
        params: {
          filter_process_definition_id: definitionId,
          orderBy: "sort_order",
          order: "asc",
          limit: 100
        }
      })
    ]);
    processDefinitionActivationTriggers.value = triggersResponse.data || [];
    processDefinitionActivationArtifacts.value = artifactsResponse.data || [];
    await prefetchFkLabelsForRows(processDefinitionActivationTriggers.value, ["term_type_id"]);
    await prefetchFkLabelsForRows(processDefinitionActivationArtifacts.value, ["edicion_id"]);
  };

  const openProcessDefinitionActivationModal = async () => {
    processDefinitionActivationChecking.value = true;
    processDefinitionActivationHasActiveTriggers.value = true;
    processDefinitionActivationHasActiveArtifacts.value = true;
    processDefinitionActivationView.value = "definition";
    ensureProcessDefinitionActivationInstance();
    getProcessDefinitionActivationInstance()?.show();
    try {
      const definitionId = selectedRow.value?.id;
      const checklist = await processDefinitionAdminService.evaluateChecklist(definitionId);
      await loadProcessDefinitionActivationDetail(definitionId);
      processDefinitionActivationHasActiveTriggers.value = checklist.triggers;
      processDefinitionActivationHasActiveArtifacts.value = checklist.artifacts;
    } catch {
      processDefinitionActivationHasActiveTriggers.value = true;
      processDefinitionActivationHasActiveArtifacts.value = true;
      processDefinitionActivationTriggers.value = [];
      processDefinitionActivationArtifacts.value = [];
    } finally {
      processDefinitionActivationChecking.value = false;
    }
  };

  const closeProcessDefinitionActivationModal = () => {
    blurActiveElement();
    getProcessDefinitionActivationInstance()?.hide();
  };

  const openProcessDefinitionActivationForRow = async (row) => {
    if (!row) {
      return;
    }
    clearModalOrigins();
    editorMode.value = "edit";
    selectedRow.value = row;
    buildFormFromRow(row);
    await refreshFormFkDisplayLabels();
    processDefinitionActivationConfirmed.value = false;
    processDefinitionActivationFromEditor.value = false;
    await openProcessDefinitionActivationModal();
  };

  const cancelProcessDefinitionActivation = () => {
    if (suppressNextActivationCancel) {
      suppressNextActivationCancel = false;
      return;
    }
    processDefinitionActivationConfirmed.value = false;
    processDefinitionActivationFromEditor.value = false;
    closeProcessDefinitionActivationModal();
  };

  const openDefinitionEditorFromActivation = () => {
    const context = selectedRow.value;
    if (!context) {
      return;
    }
    blurActiveElement();
    closeProcessDefinitionActivationModal();
    processDefinitionActivationConfirmed.value = false;
    setTimeout(() => {
      openEdit(context);
    }, 120);
  };

  const handleProcessDefinitionActivationPrimaryAction = async (processDefinitionActivationPrimaryAction) => {
    const actionType = processDefinitionActivationPrimaryAction.value?.type;
    if (!actionType) {
      return;
    }
    if (actionType === "edit_definition") {
      openDefinitionEditorFromActivation();
      return;
    }
    if (actionType === "triggers") {
      await openDefinitionTriggersFromActivation();
      return;
    }
    if (actionType === "artifacts") {
      await openDefinitionArtifactsFromActivation();
      return;
    }
    await confirmProcessDefinitionActivation();
  };

  const confirmProcessDefinitionActivation = async () => {
    if (props.table?.table === "process_definition_versions" && selectedRow.value) {
      if (!processDefinitionActivationFromEditor.value) {
        editorMode.value = "edit";
        buildFormFromRow(selectedRow.value);
        await refreshFormFkDisplayLabels();
      }
      formData.value = {
        ...formData.value,
        status: "active"
      };
    }
    processDefinitionActivationConfirmed.value = true;
    suppressNextActivationCancel = true;
    closeProcessDefinitionActivationModal();
    try {
      await submitForm();
    } finally {
      suppressNextActivationCancel = false;
    }
  };

  const cancelProcessDefinitionEdit = (closeProcessDefinitionVersioningModal) => {
    processDefinitionCloneSourceId.value = "";
    closeProcessDefinitionVersioningModal();
    resolveEditorInstance()?.hide();
  };

  const promoteProcessDefinitionToNewVersion = async (closeProcessDefinitionVersioningModal) => {
    const sourceRow = processDefinitionVersioningSource.value || selectedRow.value || {};
    const nextVersion = (
      normalizeComparableFormValue("definition_version", formData.value.definition_version)
      && normalizeComparableFormValue("definition_version", formData.value.definition_version)
        !== normalizeComparableFormValue("definition_version", sourceRow.definition_version)
    )
      ? String(formData.value.definition_version).trim()
      : getNextSemanticVersion(sourceRow.definition_version);

    // SIN `process_id` (frente 25, P22): la configuración ya no lo lleva — lo dice su línea. Al
    // versionar, lo único que hay que arrastrar es `linea_id`, que es su identidad.
    formData.value = {
      ...formData.value,
      linea_id: sourceRow.linea_id ?? formData.value.linea_id ?? "",
      definition_version: nextVersion,
      status: "draft"
    };
    processDefinitionCloneSourceId.value = sourceRow.id ? String(sourceRow.id) : "";
    editorMode.value = "create";
    selectedRow.value = null;
    processDefinitionChecklistLoading.value = false;
    processDefinitionChecklist.value = {
      rules: false,
      triggers: false,
      artifacts: false
    };
    modalError.value = "";
    closeProcessDefinitionVersioningModal();
    await refreshFormFkDisplayLabels();
  };

  return {
    loadProcessDefinitionActivationDetail,
    openProcessDefinitionActivationModal,
    closeProcessDefinitionActivationModal,
    openProcessDefinitionActivationForRow,
    cancelProcessDefinitionActivation,
    openDefinitionEditorFromActivation,
    handleProcessDefinitionActivationPrimaryAction,
    confirmProcessDefinitionActivation,
    cancelProcessDefinitionEdit,
    promoteProcessDefinitionToNewVersion
  };
}
