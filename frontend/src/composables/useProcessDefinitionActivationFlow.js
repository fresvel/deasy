import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";
import { processDefinitionAdminService } from "@/services/admin/ProcessDefinitionAdminService";

export function useProcessDefinitionActivationFlow({
  props,
  formData,
  fkDisplay,
  editorMode,
  selectedRow,
  modalError,
  editorModal,
  getEditorInstance,
  processDefinitionVersioningSource,
  processDefinitionCloneSourceId,
  processDefinitionChecklistLoading,
  processDefinitionChecklist,
  processDefinitionActivationConfirmed,
  processDefinitionActivationFromEditor,
  processDefinitionActivationChecking,
  processDefinitionActivationHasActiveRules,
  processDefinitionActivationHasActiveTriggers,
  processDefinitionActivationHasRequiredArtifacts,
  processDefinitionActivationRequiresArtifacts,
  processDefinitionActivationView,
  processDefinitionActivationPrimaryAction,
  processDefinitionActivationRules,
  processDefinitionActivationTriggers,
  processDefinitionActivationArtifacts,
  clearModalOrigins,
  isModalShown,
  ensureProcessDefinitionActivationInstance,
  getProcessDefinitionActivationInstance,
  buildFormFromRow,
  refreshFormFkDisplayLabels,
  prefetchFkLabelsForRows,
  normalizeComparableFormValue,
  getNextSemanticVersion,
  setFkLabel,
  formatFkOptionLabel,
  openEdit,
  openDefinitionRulesFromActivation,
  openDefinitionTriggersFromActivation,
  openDefinitionArtifactsFromActivation,
  submitForm
}) {
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
    processDefinitionActivationRules.value = [];
    processDefinitionActivationTriggers.value = [];
    processDefinitionActivationArtifacts.value = [];
    if (!definitionId) {
      return;
    }
    const [rulesResponse, triggersResponse, artifactsResponse] = await Promise.all([
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_target_rules"), {
        params: {
          filter_process_definition_id: definitionId,
          orderBy: "priority",
          order: "asc",
          limit: 100
        }
      }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_triggers"), {
        params: {
          filter_process_definition_id: definitionId,
          orderBy: "created_at",
          order: "desc",
          limit: 100
        }
      }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
        params: {
          filter_process_definition_id: definitionId,
          orderBy: "sort_order",
          order: "asc",
          limit: 100
        }
      })
    ]);
    processDefinitionActivationRules.value = rulesResponse.data || [];
    processDefinitionActivationTriggers.value = triggersResponse.data || [];
    processDefinitionActivationArtifacts.value = artifactsResponse.data || [];
    await prefetchFkLabelsForRows(processDefinitionActivationRules.value, ["unit_id", "unit_type_id", "cargo_id", "position_id"]);
    await prefetchFkLabelsForRows(processDefinitionActivationTriggers.value, ["term_type_id"]);
    await prefetchFkLabelsForRows(processDefinitionActivationArtifacts.value, ["template_artifact_id"]);
  };

  const openProcessDefinitionActivationModal = async () => {
    processDefinitionActivationChecking.value = true;
    processDefinitionActivationHasActiveRules.value = true;
    processDefinitionActivationHasActiveTriggers.value = true;
    processDefinitionActivationHasRequiredArtifacts.value = true;
    processDefinitionActivationView.value = "definition";
    processDefinitionActivationRequiresArtifacts.value = Boolean(
      resolveEditorInstance()
      && isModalShown(editorModal.value)
      && props.table?.table === "process_definition_versions"
        ? Number(formData.value?.has_document) === 1
        : Number(selectedRow.value?.has_document) === 1
    );
    ensureProcessDefinitionActivationInstance();
    getProcessDefinitionActivationInstance()?.show();
    try {
      const definitionId = selectedRow.value?.id;
      const requiresArtifacts = processDefinitionActivationRequiresArtifacts.value;
      const checklist = await processDefinitionAdminService.evaluateChecklist(definitionId);
      await loadProcessDefinitionActivationDetail(definitionId);
      processDefinitionActivationHasActiveRules.value = checklist.rules;
      processDefinitionActivationHasActiveTriggers.value = checklist.triggers;
      processDefinitionActivationHasRequiredArtifacts.value = requiresArtifacts ? checklist.artifacts : true;
    } catch {
      processDefinitionActivationHasActiveRules.value = false;
      processDefinitionActivationHasActiveTriggers.value = true;
      processDefinitionActivationHasRequiredArtifacts.value = true;
      processDefinitionActivationRules.value = [];
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
    if (actionType === "rules") {
      await openDefinitionRulesFromActivation();
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
    closeProcessDefinitionActivationModal();
    await submitForm();
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

    formData.value = {
      ...formData.value,
      process_id: sourceRow.process_id ?? formData.value.process_id ?? "",
      series_id: sourceRow.series_id ?? formData.value.series_id ?? "",
      definition_version: nextVersion,
      status: "draft"
    };
    fkDisplay.value = {
      ...fkDisplay.value,
      process_id: fkDisplay.value.process_id || (sourceRow.process_id ? String(sourceRow.process_id) : "")
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
