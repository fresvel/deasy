import { Modal } from "@/shared/utils/modalController";

export function useAdminModalRegistry({
  resolveModalElement,
  peekModalOrigin,
  popModalOrigin,
  hideAndRemember,
  props,
  selectedRow,
  editorModal,
  processDefinitionVersioningModal,
  processDefinitionActivationModal,
  definitionRulesModal,
  definitionTriggersModal,
  definitionArtifactsModal,
  definitionArtifactsPromptModal,
  deleteModal,
  recordViewerModal,
  personAssignmentsModal,
  fkModal,
  fkViewerModal,
  fkFilterModal,
  fkCreateModal,
  templateSearchModal,
  documentSearchModal,
  processSearchModal,
  unitPositionSearchModal,
  skipFkReturnRestore,
  fkCreateExitTarget,
  fkNestedExitTarget,
  processDefinitionVersioningSource,
  processDefinitionActivationConfirmed,
  processDefinitionActivationFromEditor,
  processDefinitionActivationChecking,
  processDefinitionActivationHasActiveRules,
  processDefinitionActivationHasActiveTriggers,
  processDefinitionActivationHasRequiredArtifacts,
  processDefinitionActivationRequiresArtifacts,
  processDefinitionActivationView,
  processDefinitionActivationRules,
  processDefinitionActivationTriggers,
  processDefinitionActivationArtifacts,
  definitionRulesError,
  definitionRulesContext,
  definitionRulesRows,
  definitionTriggersError,
  definitionTriggersContext,
  definitionTriggersRows,
  definitionArtifactsError,
  definitionArtifactsEditId,
  definitionArtifactsContext,
  definitionArtifactsRows,
  definitionArtifactsPromptContext,
  refreshProcessDefinitionChecklist,
  openProcessDefinitionActivationModal,
  resetDefinitionRulesForm,
  resetDefinitionTriggersForm,
  resetDefinitionArtifactsForm
}) {
  let editorInstance = null;
  let processDefinitionVersioningInstance = null;
  let processDefinitionActivationInstance = null;
  let definitionRulesInstance = null;
  let definitionTriggersInstance = null;
  let definitionArtifactsInstance = null;
  let definitionArtifactsPromptInstance = null;
  let deleteInstance = null;
  let recordViewerInstance = null;
  let personAssignmentsInstance = null;
  let fkInstance = null;
  let fkViewerInstance = null;
  let fkFilterInstance = null;
  let fkCreateInstance = null;
  let templateSearchInstance = null;
  let documentSearchInstance = null;
  let processSearchInstance = null;
  let unitPositionSearchInstance = null;

  const restoreReturnModal = () => {
    const returnModal = popModalOrigin();
    if (returnModal === "editor" && editorInstance) {
      if (props.table?.table === "process_definition_versions" && selectedRow.value?.id) {
        refreshProcessDefinitionChecklist(selectedRow.value);
      }
      editorInstance.show();
    }
    if (returnModal === "processSearch" && processSearchInstance) {
      processSearchInstance.show();
    }
    if (returnModal === "templateSearch" && templateSearchInstance) {
      templateSearchInstance.show();
    }
    if (returnModal === "documentSearch" && documentSearchInstance) {
      documentSearchInstance.show();
    }
    if (returnModal === "personAssignments" && personAssignmentsInstance) {
      personAssignmentsInstance.show();
    }
    if (returnModal === "definitionRules" && definitionRulesInstance) {
      definitionRulesInstance.show();
    }
    if (returnModal === "definitionActivation" && processDefinitionActivationInstance) {
      if (selectedRow.value?.id) {
        openProcessDefinitionActivationModal();
        return;
      }
      processDefinitionActivationInstance.show();
    }
    if (returnModal === "definitionTriggers" && definitionTriggersInstance) {
      definitionTriggersInstance.show();
    }
    if (returnModal === "definitionArtifacts" && definitionArtifactsInstance) {
      definitionArtifactsInstance.show();
    }
  };

  const ensureEditorInstance = () => {
    const modalElement = resolveModalElement(editorModal.value);
    if (!editorInstance && modalElement) {
      editorInstance = new Modal(modalElement);
    }
  };

  const ensureProcessDefinitionVersioningInstance = () => {
    const modalElement = resolveModalElement(processDefinitionVersioningModal.value);
    if (!processDefinitionVersioningInstance && modalElement) {
      processDefinitionVersioningInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        processDefinitionVersioningSource.value = null;
      });
    }
  };

  const ensureProcessDefinitionActivationInstance = () => {
    const modalElement = resolveModalElement(processDefinitionActivationModal.value);
    if (!processDefinitionActivationInstance && modalElement) {
      processDefinitionActivationInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (peekModalOrigin() === "definitionActivation") {
          return;
        }
        if (processDefinitionActivationConfirmed.value) {
          return;
        }
        processDefinitionActivationConfirmed.value = false;
        processDefinitionActivationFromEditor.value = false;
        processDefinitionActivationChecking.value = false;
        processDefinitionActivationHasActiveRules.value = true;
        processDefinitionActivationHasActiveTriggers.value = true;
        processDefinitionActivationHasRequiredArtifacts.value = true;
        processDefinitionActivationRequiresArtifacts.value = false;
        processDefinitionActivationView.value = "definition";
        processDefinitionActivationRules.value = [];
        processDefinitionActivationTriggers.value = [];
        processDefinitionActivationArtifacts.value = [];
      });
    }
  };

  const ensureDefinitionRulesInstance = () => {
    const modalElement = resolveModalElement(definitionRulesModal.value);
    if (!definitionRulesInstance && modalElement) {
      definitionRulesInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (peekModalOrigin() === "definitionRules") {
          return;
        }
        definitionRulesError.value = "";
        definitionRulesContext.value = null;
        definitionRulesRows.value = [];
        resetDefinitionRulesForm();
        restoreReturnModal();
      });
    }
  };

  const ensureDefinitionTriggersInstance = () => {
    const modalElement = resolveModalElement(definitionTriggersModal.value);
    if (!definitionTriggersInstance && modalElement) {
      definitionTriggersInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (peekModalOrigin() === "definitionTriggers") {
          return;
        }
        definitionTriggersError.value = "";
        definitionTriggersContext.value = null;
        definitionTriggersRows.value = [];
        resetDefinitionTriggersForm();
        restoreReturnModal();
      });
    }
  };

  const ensureDeleteInstance = () => {
    const modalElement = resolveModalElement(deleteModal.value);
    if (!deleteInstance && modalElement) {
      deleteInstance = new Modal(modalElement);
    }
  };

  const ensureRecordViewerInstance = () => {
    const modalElement = resolveModalElement(recordViewerModal.value);
    if (!recordViewerInstance && modalElement) {
      recordViewerInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        restoreReturnModal();
      });
    }
  };

  const ensurePersonAssignmentsInstance = () => {
    const modalElement = resolveModalElement(personAssignmentsModal.value);
    if (!personAssignmentsInstance && modalElement) {
      personAssignmentsInstance = new Modal(modalElement);
    }
  };

  const ensureDefinitionArtifactsInstance = () => {
    const modalElement = resolveModalElement(definitionArtifactsModal.value);
    if (!definitionArtifactsInstance && modalElement) {
      definitionArtifactsInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (peekModalOrigin() === "definitionArtifacts") {
          return;
        }
        definitionArtifactsError.value = "";
        definitionArtifactsEditId.value = "";
        definitionArtifactsContext.value = null;
        definitionArtifactsRows.value = [];
        resetDefinitionArtifactsForm();
        restoreReturnModal();
      });
    }
  };

  const ensureDefinitionArtifactsPromptInstance = () => {
    const modalElement = resolveModalElement(definitionArtifactsPromptModal.value);
    if (!definitionArtifactsPromptInstance && modalElement) {
      definitionArtifactsPromptInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        definitionArtifactsPromptContext.value = null;
      });
    }
  };

  const ensureFkInstance = () => {
    const modalElement = resolveModalElement(fkModal.value);
    if (!fkInstance && modalElement) {
      fkInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (skipFkReturnRestore.value) {
          skipFkReturnRestore.value = false;
          return;
        }
        restoreReturnModal();
      });
    }
  };

  const ensureFkCreateInstance = () => {
    const modalElement = resolveModalElement(fkCreateModal.value);
    if (!fkCreateInstance && modalElement) {
      fkCreateInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (fkCreateExitTarget.value === "search") {
          ensureFkInstance();
          fkInstance?.show();
        }
        if (fkCreateExitTarget.value === "parent") {
          restoreReturnModal();
        }
        fkCreateExitTarget.value = "none";
      });
    }
  };

  const ensureFkViewerInstance = () => {
    const modalElement = resolveModalElement(fkViewerModal.value);
    if (!fkViewerInstance && modalElement) {
      fkViewerInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (fkNestedExitTarget.value === "search") {
          ensureFkInstance();
          fkInstance?.show();
        }
        fkNestedExitTarget.value = "none";
      });
    }
  };

  const ensureFkFilterInstance = () => {
    const modalElement = resolveModalElement(fkFilterModal.value);
    if (!fkFilterInstance && modalElement) {
      fkFilterInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        if (fkNestedExitTarget.value === "search") {
          ensureFkInstance();
          fkInstance?.show();
        }
        fkNestedExitTarget.value = "none";
      });
    }
  };

  const ensureProcessSearchInstance = () => {
    const modalElement = resolveModalElement(processSearchModal.value);
    if (!processSearchInstance && modalElement) {
      processSearchInstance = new Modal(modalElement);
    }
  };

  const ensureTemplateSearchInstance = () => {
    const modalElement = resolveModalElement(templateSearchModal.value);
    if (!templateSearchInstance && modalElement) {
      templateSearchInstance = new Modal(modalElement);
    }
  };

  const ensureDocumentSearchInstance = () => {
    const modalElement = resolveModalElement(documentSearchModal.value);
    if (!documentSearchInstance && modalElement) {
      documentSearchInstance = new Modal(modalElement);
    }
  };

  const ensureUnitPositionSearchInstance = () => {
    const modalElement = resolveModalElement(unitPositionSearchModal.value);
    if (!unitPositionSearchInstance && modalElement) {
      unitPositionSearchInstance = new Modal(modalElement);
    }
  };

  const hideParentModalsForFk = () => {
    hideAndRemember("editor", editorInstance, editorModal.value);
    hideAndRemember("processSearch", processSearchInstance, processSearchModal.value);
    hideAndRemember("templateSearch", templateSearchInstance, templateSearchModal.value);
    hideAndRemember("documentSearch", documentSearchInstance, documentSearchModal.value);
    hideAndRemember("personAssignments", personAssignmentsInstance, personAssignmentsModal.value);
    hideAndRemember("definitionRules", definitionRulesInstance, definitionRulesModal.value);
    hideAndRemember("definitionTriggers", definitionTriggersInstance, definitionTriggersModal.value);
    hideAndRemember("definitionArtifacts", definitionArtifactsInstance, definitionArtifactsModal.value);
  };

  const hideParentModalsForRecordViewer = () => {
    hideAndRemember("personAssignments", personAssignmentsInstance, personAssignmentsModal.value);
    hideAndRemember("definitionRules", definitionRulesInstance, definitionRulesModal.value);
    hideAndRemember("definitionTriggers", definitionTriggersInstance, definitionTriggersModal.value);
    hideAndRemember("definitionArtifacts", definitionArtifactsInstance, definitionArtifactsModal.value);
  };

  return {
    ensureEditorInstance,
    ensureProcessDefinitionVersioningInstance,
    ensureProcessDefinitionActivationInstance,
    ensureDefinitionRulesInstance,
    ensureDefinitionTriggersInstance,
    ensureDeleteInstance,
    ensureRecordViewerInstance,
    ensurePersonAssignmentsInstance,
    ensureDefinitionArtifactsInstance,
    ensureDefinitionArtifactsPromptInstance,
    ensureFkInstance,
    ensureFkCreateInstance,
    ensureFkViewerInstance,
    ensureFkFilterInstance,
    ensureProcessSearchInstance,
    ensureTemplateSearchInstance,
    ensureDocumentSearchInstance,
    ensureUnitPositionSearchInstance,
    restoreReturnModal,
    hideParentModalsForFk,
    hideParentModalsForRecordViewer,
    getPersonAssignmentsInstance: () => personAssignmentsInstance,
    getDefinitionRulesInstance: () => definitionRulesInstance,
    getDefinitionTriggersInstance: () => definitionTriggersInstance,
    getDefinitionArtifactsInstance: () => definitionArtifactsInstance,
    getDefinitionArtifactsPromptInstance: () => definitionArtifactsPromptInstance,
    getRecordViewerInstance: () => recordViewerInstance,
    getFkInstance: () => fkInstance,
    getFkViewerInstance: () => fkViewerInstance,
    getFkFilterInstance: () => fkFilterInstance,
    getFkCreateInstance: () => fkCreateInstance,
    getProcessDefinitionActivationInstance: () => processDefinitionActivationInstance,
    getEditorInstance: () => editorInstance,
    getProcessSearchInstance: () => processSearchInstance,
    getTemplateSearchInstance: () => {
      ensureTemplateSearchInstance();
      return templateSearchInstance;
    },
    getDocumentSearchInstance: () => documentSearchInstance,
    getUnitPositionSearchInstance: () => unitPositionSearchInstance,
    getDeleteInstance: () => deleteInstance,
    getProcessDefinitionVersioningInstance: () => processDefinitionVersioningInstance
  };
}
