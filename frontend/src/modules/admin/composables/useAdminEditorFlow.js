export function useAdminEditorFlow({
  props,
  formData,
  fkDisplay,
  editorMode,
  selectedRow,
  modalError,
  processDefinitionCloneSourceId,
  processDefinitionChecklistLoading,
  processDefinitionChecklist,
  isTemplateArtifactsTable,
  isProcessDefinitionTemplatesTable,
  resetInlineFkState,
  closeProcessDefinitionVersioningModal,
  resetForm,
  applyUnitRelationDefaults,
  ensureEditorInstance,
  getEditorInstance,
  openDraftArtifactModal,
  showFeedbackToast,
  buildFormFromRow,
  refreshFormFkDisplayLabels,
  refreshProcessDefinitionChecklist,
  setFkLabel,
  formatFkOptionLabel,
  getNextSemanticVersion
}) {
  const openCreate = async () => {
    if (!props.table) {
      return;
    }
    resetInlineFkState();
    closeProcessDefinitionVersioningModal();
    processDefinitionCloneSourceId.value = "";
    editorMode.value = "create";
    selectedRow.value = null;
    processDefinitionChecklistLoading.value = false;
    processDefinitionChecklist.value = {
      rules: false,
      triggers: false,
      artifacts: false
    };
    modalError.value = "";
    resetForm();
    fkDisplay.value = {};
    await applyUnitRelationDefaults();
    ensureEditorInstance();
    getEditorInstance()?.show();
  };

  const handlePrimaryCreateAction = async () => {
    if (isTemplateArtifactsTable.value) {
      await openDraftArtifactModal();
      return;
    }
    await openCreate();
  };

  const openEdit = async (row) => {
    if (
      props.table?.table === "template_artifacts"
      && String(row?.artifact_origin || "") === "process"
    ) {
      showFeedbackToast({
        kind: "error",
        title: "Edicion bloqueada",
        message: "Los artifacts de proceso se sincronizan desde MinIO y no se editan manualmente."
      });
      return { blocked: true };
    }
    if (props.table?.table === "template_artifacts") {
      await openDraftArtifactModal(row);
      return { redirected: true };
    }
    resetInlineFkState();
    closeProcessDefinitionVersioningModal();
    processDefinitionCloneSourceId.value = "";
    editorMode.value = "edit";
    selectedRow.value = row;
    modalError.value = "";
    buildFormFromRow(row);
    await refreshFormFkDisplayLabels();
    if (props.table?.table === "process_definition_versions") {
      await refreshProcessDefinitionChecklist(row);
    }
    ensureEditorInstance();
    getEditorInstance()?.show();
    return { redirected: false, blocked: false };
  };

  const startProcessDefinitionTemplateFromArtifact = async (row) => {
    if (!row || !isProcessDefinitionTemplatesTable.value) {
      return;
    }
    resetInlineFkState();
    closeProcessDefinitionVersioningModal();
    processDefinitionCloneSourceId.value = "";
    editorMode.value = "create";
    selectedRow.value = null;
    processDefinitionChecklistLoading.value = false;
    processDefinitionChecklist.value = {
      rules: false,
      triggers: false,
      artifacts: false
    };
    modalError.value = "";
    resetForm();
    fkDisplay.value = {};
    formData.value = {
      ...formData.value,
      template_artifact_id: row.id ? String(row.id) : ""
    };
    if (row.id !== null && row.id !== undefined && row.id !== "") {
      setFkLabel("template_artifacts", row.id, formatFkOptionLabel("template_artifacts", row));
    }
    await refreshFormFkDisplayLabels();
    ensureEditorInstance();
    getEditorInstance()?.show();
  };

  const startProcessDefinitionVersioning = async (row) => {
    if (!row) {
      return;
    }
    resetInlineFkState();
    closeProcessDefinitionVersioningModal();
    processDefinitionCloneSourceId.value = row.id ? String(row.id) : "";
    editorMode.value = "create";
    selectedRow.value = null;
    modalError.value = "";
    buildFormFromRow(row);
    formData.value = {
      ...formData.value,
      process_id: row.process_id ?? formData.value.process_id ?? "",
      series_id: row.series_id ?? formData.value.series_id ?? "",
      definition_version: getNextSemanticVersion(row.definition_version),
      status: "draft"
    };
    await refreshFormFkDisplayLabels();
    ensureEditorInstance();
    getEditorInstance()?.show();
  };

  return {
    openCreate,
    handlePrimaryCreateAction,
    openEdit,
    startProcessDefinitionTemplateFromArtifact,
    startProcessDefinitionVersioning
  };
}
