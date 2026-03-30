import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";
import { processDefinitionAdminService } from "@/services/admin/ProcessDefinitionAdminService";

export function useProcessDefinitionManager({
  props,
  editorMode,
  selectedRow,
  editorInstance,
  definitionRulesContext,
  definitionRulesRows,
  definitionRulesLoading,
  definitionRulesError,
  definitionRulesEditId,
  definitionRulesForm,
  definitionRulesLabels,
  definitionTriggersContext,
  definitionTriggersRows,
  definitionTriggersLoading,
  definitionTriggersError,
  definitionTriggersEditId,
  definitionTriggersForm,
  definitionTriggersLabels,
  definitionArtifactsContext,
  definitionArtifactsRows,
  definitionArtifactsLoading,
  definitionArtifactsError,
  definitionArtifactsEditId,
  definitionArtifactsForm,
  definitionArtifactsLabels,
  definitionArtifactsPromptContext,
  processDefinitionChecklistLoading,
  processDefinitionChecklist,
  definitionTriggerRequiresTermType,
  canManageDefinitionRules,
  canManageDefinitionTriggers,
  canManageDefinitionArtifacts,
  canSubmitDefinitionRule,
  canSubmitDefinitionTrigger,
  clearModalOrigins,
  pushModalOrigin,
  closeProcessDefinitionActivationModal,
  closeDefinitionArtifactsPrompt,
  openFkSearch,
  resolveFkTable,
  formatFkOptionLabel,
  fetchFkLabel,
  getFkCachedLabel,
  formatCell,
  formatDateOnly,
  prefetchFkLabelsForRows,
  ensureDefinitionRulesInstance,
  ensureDefinitionTriggersInstance,
  ensureDefinitionArtifactsInstance,
  ensureDefinitionArtifactsPromptInstance,
  getDefinitionRulesInstance,
  getDefinitionTriggersInstance,
  getDefinitionArtifactsInstance,
  getDefinitionArtifactsPromptInstance
}) {
  const resetDefinitionArtifactsForm = () => {
    definitionArtifactsEditId.value = "";
    definitionArtifactsForm.value = processDefinitionAdminService.createArtifactForm();
    definitionArtifactsLabels.value = processDefinitionAdminService.createArtifactLabels();
  };

  const resetDefinitionRulesForm = () => {
    definitionRulesEditId.value = "";
    definitionRulesForm.value = processDefinitionAdminService.createRuleForm();
    definitionRulesLabels.value = processDefinitionAdminService.createRuleLabels();
  };

  const resetDefinitionTriggersForm = () => {
    definitionTriggersEditId.value = "";
    definitionTriggersForm.value = processDefinitionAdminService.createTriggerForm();
    definitionTriggersLabels.value = processDefinitionAdminService.createTriggerLabels();
  };

  const formatDefinitionRuleSummary = (row) => {
    if (!row) {
      return "—";
    }
    const scopeType = String(row.unit_scope_type || "");
    if (scopeType === "all_units") {
      return "Todas las unidades";
    }
    if (scopeType === "unit_type") {
      return formatCell(row.unit_type_id, { name: "unit_type_id" }, row);
    }
    const primaryLabel = row.position_id
      ? formatCell(row.position_id, { name: "position_id" }, row)
      : formatCell(row.unit_id, { name: "unit_id" }, row);
    const cargoLabel = row.cargo_id ? formatCell(row.cargo_id, { name: "cargo_id" }, row) : "";
    return cargoLabel ? `${primaryLabel} | ${cargoLabel}` : primaryLabel;
  };

  const handleDefinitionRuleScopeChange = () => {
    const nextState = processDefinitionAdminService.applyRuleScopeChange(
      definitionRulesForm.value,
      definitionRulesLabels.value
    );
    definitionRulesForm.value = nextState.form;
    definitionRulesLabels.value = nextState.labels;
  };

  const refreshProcessDefinitionChecklist = async (definitionRow = selectedRow.value) => {
    const definitionId = definitionRow?.id;
    processDefinitionChecklistLoading.value = true;
    processDefinitionChecklist.value = {
      rules: false,
      triggers: false,
      artifacts: false
    };
    if (!definitionId) {
      processDefinitionChecklistLoading.value = false;
      return;
    }
    try {
      processDefinitionChecklist.value = await processDefinitionAdminService.evaluateChecklist(definitionId);
    } catch {
      processDefinitionChecklist.value = {
        rules: false,
        triggers: false,
        artifacts: false
      };
    } finally {
      processDefinitionChecklistLoading.value = false;
    }
  };

  const loadDefinitionRules = async () => {
    const definitionId = definitionRulesContext.value?.id;
    if (!definitionId) {
      definitionRulesRows.value = [];
      definitionRulesError.value = "";
      definitionRulesLoading.value = false;
      return;
    }
    definitionRulesLoading.value = true;
    definitionRulesError.value = "";
    try {
      const response = await processDefinitionAdminService.listRules(definitionId);
      definitionRulesRows.value = response.data || [];
      await prefetchFkLabelsForRows(definitionRulesRows.value, ["unit_id", "unit_type_id", "cargo_id", "position_id"]);
    } catch {
      definitionRulesRows.value = [];
      definitionRulesError.value = "No se pudieron cargar las reglas vinculadas.";
    } finally {
      definitionRulesLoading.value = false;
    }
    await refreshProcessDefinitionChecklist(definitionRulesContext.value);
  };

  const openDefinitionRulesManager = async (definitionRow) => {
    if (!definitionRow?.id) {
      return;
    }
    definitionRulesContext.value = { ...definitionRow };
    definitionRulesError.value = "";
    resetDefinitionRulesForm();
    ensureDefinitionRulesInstance();
    getDefinitionRulesInstance()?.show();
    await loadDefinitionRules();
  };

  const closeDefinitionRulesManager = () => {
    clearModalOrigins();
    getDefinitionRulesInstance()?.hide();
  };

  const acceptDefinitionRulesManager = () => {
    getDefinitionRulesInstance()?.hide();
  };

  const confirmDefinitionRulesPrompt = async () => {
    const context = definitionArtifactsPromptContext.value;
    closeDefinitionArtifactsPrompt();
    if (context?.id) {
      await openDefinitionRulesManager(context);
    }
  };

  const openDefinitionRulesFromEditor = async () => {
    if (props.table?.table !== "process_definition_versions" || editorMode.value !== "edit" || !selectedRow.value?.id) {
      return;
    }
    clearModalOrigins();
    pushModalOrigin("editor");
    editorInstance?.hide();
    await openDefinitionRulesManager(selectedRow.value);
  };

  const openDefinitionRulesFromActivation = async () => {
    const context = selectedRow.value;
    clearModalOrigins();
    pushModalOrigin("definitionActivation");
    closeProcessDefinitionActivationModal();
    if (context?.id) {
      await openDefinitionRulesManager(context);
    }
  };

  const openDefinitionArtifactsFromActivation = async () => {
    const context = selectedRow.value;
    clearModalOrigins();
    pushModalOrigin("definitionActivation");
    closeProcessDefinitionActivationModal();
    if (context?.id) {
      await openDefinitionArtifactsManager(context);
    }
  };

  const openDefinitionRuleFkSearch = (fieldName) => {
    if (!fieldName) {
      return;
    }
    openFkSearch({ name: fieldName }, async (row) => {
      const idValue = row.id ?? "";
      definitionRulesForm.value = {
        ...definitionRulesForm.value,
        [fieldName]: idValue ? String(idValue) : ""
      };
      definitionRulesLabels.value = {
        ...definitionRulesLabels.value,
        [fieldName]: formatFkOptionLabel(resolveFkTable(fieldName), row)
      };
      if (fieldName === "position_id" && idValue) {
        try {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
            params: { filter_id: idValue, limit: 1 }
          });
          const positionRow = response.data?.[0];
          if (positionRow?.unit_id) {
            await fetchFkLabel("units", positionRow.unit_id);
            definitionRulesForm.value = {
              ...definitionRulesForm.value,
              unit_id: String(positionRow.unit_id)
            };
            definitionRulesLabels.value = {
              ...definitionRulesLabels.value,
              unit_id: String(getFkCachedLabel("units", positionRow.unit_id) || positionRow.unit_id)
            };
          }
          if (positionRow?.cargo_id) {
            await fetchFkLabel("cargos", positionRow.cargo_id);
            definitionRulesForm.value = {
              ...definitionRulesForm.value,
              cargo_id: String(positionRow.cargo_id)
            };
            definitionRulesLabels.value = {
              ...definitionRulesLabels.value,
              cargo_id: String(getFkCachedLabel("cargos", positionRow.cargo_id) || positionRow.cargo_id)
            };
          }
        } catch {
          // Best-effort autofill.
        }
      }
    });
  };

  const clearDefinitionRuleField = (fieldName) => {
    if (!fieldName) {
      return;
    }
    definitionRulesForm.value = {
      ...definitionRulesForm.value,
      [fieldName]: ""
    };
    if (Object.prototype.hasOwnProperty.call(definitionRulesLabels.value, fieldName)) {
      definitionRulesLabels.value = {
        ...definitionRulesLabels.value,
        [fieldName]: ""
      };
    }
  };

  const startDefinitionRuleEdit = (row) => {
    if (!row) {
      return;
    }
    if (!canManageDefinitionRules.value) {
      definitionRulesError.value = "Solo puedes modificar reglas mientras la definicion este en draft.";
      return;
    }
    definitionRulesEditId.value = row.id ? String(row.id) : "";
    definitionRulesForm.value = {
      unit_scope_type: row.unit_scope_type || "unit_exact",
      unit_id: row.unit_id ? String(row.unit_id) : "",
      unit_type_id: row.unit_type_id ? String(row.unit_type_id) : "",
      include_descendants: Number(row.include_descendants) === 1 ? "1" : "0",
      cargo_id: row.cargo_id ? String(row.cargo_id) : "",
      position_id: row.position_id ? String(row.position_id) : "",
      recipient_policy: row.recipient_policy || "all_matches",
      priority: row.priority !== null && row.priority !== undefined ? String(row.priority) : "1",
      is_active: Number(row.is_active) === 1 ? "1" : "0",
      effective_from: row.effective_from ? formatDateOnly(row.effective_from) : "",
      effective_to: row.effective_to ? formatDateOnly(row.effective_to) : ""
    };
    definitionRulesLabels.value = {
      unit_id: row.unit_id ? String(getFkCachedLabel("units", row.unit_id) || row.unit_id) : "",
      unit_type_id: row.unit_type_id ? String(getFkCachedLabel("unit_types", row.unit_type_id) || row.unit_type_id) : "",
      cargo_id: row.cargo_id ? String(getFkCachedLabel("cargos", row.cargo_id) || row.cargo_id) : "",
      position_id: row.position_id ? String(getFkCachedLabel("unit_positions", row.position_id) || row.position_id) : ""
    };
  };

  const submitDefinitionRule = async () => {
    const definitionId = definitionRulesContext.value?.id;
    if (!definitionId) {
      definitionRulesError.value = "No hay una definicion seleccionada.";
      return;
    }
    if (!canManageDefinitionRules.value) {
      definitionRulesError.value = "Solo puedes modificar reglas mientras la definicion este en draft.";
      return;
    }
    if (!canSubmitDefinitionRule.value) {
      definitionRulesError.value = "Completa el alcance requerido para guardar la regla.";
      return;
    }
    const payload = processDefinitionAdminService.buildRulePayload(definitionId, definitionRulesForm.value);
    definitionRulesError.value = "";
    try {
      await processDefinitionAdminService.saveRule(definitionRulesEditId.value, payload);
      resetDefinitionRulesForm();
      await loadDefinitionRules();
    } catch (error) {
      definitionRulesError.value = error?.response?.data?.message || "No se pudo guardar la regla.";
    }
  };

  const deleteDefinitionRule = async (row) => {
    if (!row?.id) {
      return;
    }
    if (!canManageDefinitionRules.value) {
      definitionRulesError.value = "Solo puedes modificar reglas mientras la definicion este en draft.";
      return;
    }
    if (!window.confirm("¿Deseas eliminar esta regla de la definicion?")) {
      return;
    }
    definitionRulesError.value = "";
    try {
      await processDefinitionAdminService.deleteRule(row.id);
      if (String(definitionRulesEditId.value) === String(row.id)) {
        resetDefinitionRulesForm();
      }
      await loadDefinitionRules();
    } catch (error) {
      definitionRulesError.value = error?.response?.data?.message || "No se pudo eliminar la regla.";
    }
  };

  const loadDefinitionTriggers = async () => {
    const definitionId = definitionTriggersContext.value?.id;
    if (!definitionId) {
      definitionTriggersRows.value = [];
      definitionTriggersError.value = "";
      definitionTriggersLoading.value = false;
      return;
    }
    definitionTriggersLoading.value = true;
    definitionTriggersError.value = "";
    try {
      const response = await processDefinitionAdminService.listTriggers(definitionId);
      definitionTriggersRows.value = response.data || [];
      await prefetchFkLabelsForRows(definitionTriggersRows.value, ["term_type_id"]);
    } catch {
      definitionTriggersRows.value = [];
      definitionTriggersError.value = "No se pudieron cargar los disparadores vinculados.";
    } finally {
      definitionTriggersLoading.value = false;
    }
  };

  const openDefinitionTriggersManager = async (definitionRow) => {
    if (!definitionRow?.id) {
      return;
    }
    definitionTriggersContext.value = { ...definitionRow };
    definitionTriggersError.value = "";
    resetDefinitionTriggersForm();
    ensureDefinitionTriggersInstance();
    getDefinitionTriggersInstance()?.show();
    await loadDefinitionTriggers();
  };

  const closeDefinitionTriggersManager = () => {
    clearModalOrigins();
    getDefinitionTriggersInstance()?.hide();
  };

  const acceptDefinitionTriggersManager = () => {
    getDefinitionTriggersInstance()?.hide();
  };

  const confirmDefinitionTriggersPrompt = async () => {
    const context = definitionArtifactsPromptContext.value;
    closeDefinitionArtifactsPrompt();
    if (context?.id) {
      await openDefinitionTriggersManager(context);
    }
  };

  const openDefinitionTriggersFromEditor = async () => {
    if (props.table?.table !== "process_definition_versions" || editorMode.value !== "edit" || !selectedRow.value?.id) {
      return;
    }
    clearModalOrigins();
    pushModalOrigin("editor");
    editorInstance?.hide();
    await openDefinitionTriggersManager(selectedRow.value);
  };

  const openDefinitionTriggersFromActivation = async () => {
    const context = selectedRow.value;
    clearModalOrigins();
    pushModalOrigin("definitionActivation");
    closeProcessDefinitionActivationModal();
    if (context?.id) {
      await openDefinitionTriggersManager(context);
    }
  };

  const handleDefinitionTriggerModeChange = () => {
    if (!definitionTriggerRequiresTermType.value) {
      definitionTriggersForm.value = {
        ...processDefinitionAdminService.createTriggerForm(),
        trigger_mode: definitionTriggersForm.value.trigger_mode,
        is_active: definitionTriggersForm.value.is_active
      };
      definitionTriggersLabels.value = processDefinitionAdminService.createTriggerLabels();
    }
  };

  const openDefinitionTriggerFkSearch = () => {
    openFkSearch({ name: "term_type_id" }, (row) => {
      const idValue = row.id ?? "";
      definitionTriggersForm.value = {
        ...definitionTriggersForm.value,
        term_type_id: idValue ? String(idValue) : ""
      };
      definitionTriggersLabels.value = {
        ...definitionTriggersLabels.value,
        term_type_id: formatFkOptionLabel("term_types", row)
      };
    });
  };

  const clearDefinitionTriggerTermType = () => {
    definitionTriggersForm.value = {
      ...definitionTriggersForm.value,
      term_type_id: ""
    };
    definitionTriggersLabels.value = {
      ...definitionTriggersLabels.value,
      term_type_id: ""
    };
  };

  const startDefinitionTriggerEdit = (row) => {
    if (!row) {
      return;
    }
    if (!canManageDefinitionTriggers.value) {
      definitionTriggersError.value = "Solo puedes modificar disparadores mientras la definicion este en draft.";
      return;
    }
    definitionTriggersEditId.value = row.id ? String(row.id) : "";
    definitionTriggersForm.value = {
      trigger_mode: row.trigger_mode || "automatic_by_term_type",
      term_type_id: row.term_type_id ? String(row.term_type_id) : "",
      is_active: Number(row.is_active) === 1 ? "1" : "0"
    };
    definitionTriggersLabels.value = {
      term_type_id: row.term_type_id
        ? String(getFkCachedLabel("term_types", row.term_type_id) || row.term_type_id)
        : ""
    };
  };

  const submitDefinitionTrigger = async () => {
    const definitionId = definitionTriggersContext.value?.id;
    if (!definitionId) {
      definitionTriggersError.value = "No hay una definicion seleccionada.";
      return;
    }
    if (!canManageDefinitionTriggers.value) {
      definitionTriggersError.value = "Solo puedes modificar disparadores mientras la definicion este en draft.";
      return;
    }
    if (!canSubmitDefinitionTrigger.value) {
      definitionTriggersError.value = "Selecciona el tipo de periodo requerido para este disparador.";
      return;
    }
    const payload = processDefinitionAdminService.buildTriggerPayload(
      definitionId,
      definitionTriggersForm.value,
      definitionTriggerRequiresTermType.value
    );
    definitionTriggersError.value = "";
    try {
      await processDefinitionAdminService.saveTrigger(definitionTriggersEditId.value, payload);
      resetDefinitionTriggersForm();
      await loadDefinitionTriggers();
      await refreshProcessDefinitionChecklist(definitionTriggersContext.value);
    } catch (error) {
      definitionTriggersError.value = error?.response?.data?.message || "No se pudo guardar el disparador.";
    }
  };

  const deleteDefinitionTrigger = async (row) => {
    if (!row?.id) {
      return;
    }
    if (!canManageDefinitionTriggers.value) {
      definitionTriggersError.value = "Solo puedes modificar disparadores mientras la definicion este en draft.";
      return;
    }
    if (!window.confirm("¿Deseas eliminar este disparador de la definicion?")) {
      return;
    }
    definitionTriggersError.value = "";
    try {
      await processDefinitionAdminService.deleteTrigger(row.id);
      if (String(definitionTriggersEditId.value) === String(row.id)) {
        resetDefinitionTriggersForm();
      }
      await loadDefinitionTriggers();
      await refreshProcessDefinitionChecklist(definitionTriggersContext.value);
    } catch (error) {
      definitionTriggersError.value = error?.response?.data?.message || "No se pudo eliminar el disparador.";
    }
  };

  const loadDefinitionArtifacts = async () => {
    const definitionId = definitionArtifactsContext.value?.id;
    if (!definitionId) {
      definitionArtifactsRows.value = [];
      definitionArtifactsError.value = "";
      definitionArtifactsLoading.value = false;
      return;
    }
    definitionArtifactsLoading.value = true;
    definitionArtifactsError.value = "";
    try {
      const response = await processDefinitionAdminService.listArtifacts(definitionId);
      definitionArtifactsRows.value = response.data || [];
      await prefetchFkLabelsForRows(definitionArtifactsRows.value, ["template_artifact_id"]);
    } catch {
      definitionArtifactsRows.value = [];
      definitionArtifactsError.value = "No se pudieron cargar los artifacts vinculados.";
    } finally {
      definitionArtifactsLoading.value = false;
    }
    await refreshProcessDefinitionChecklist(definitionArtifactsContext.value);
  };

  const openDefinitionArtifactsManager = async (definitionRow) => {
    if (!definitionRow?.id) {
      return;
    }
    definitionArtifactsContext.value = { ...definitionRow };
    definitionArtifactsError.value = "";
    resetDefinitionArtifactsForm();
    ensureDefinitionArtifactsInstance();
    getDefinitionArtifactsInstance()?.show();
    await loadDefinitionArtifacts();
  };

  const closeDefinitionArtifactsManager = () => {
    clearModalOrigins();
    getDefinitionArtifactsInstance()?.hide();
  };

  const acceptDefinitionArtifactsManager = () => {
    getDefinitionArtifactsInstance()?.hide();
  };

  const openDefinitionArtifactsPrompt = (definitionRow) => {
    if (!definitionRow?.id) {
      return;
    }
    definitionArtifactsPromptContext.value = { ...definitionRow };
    ensureDefinitionArtifactsPromptInstance();
    getDefinitionArtifactsPromptInstance()?.show();
  };

  const closeDefinitionArtifactsPrompt = () => {
    getDefinitionArtifactsPromptInstance()?.hide();
    definitionArtifactsPromptContext.value = null;
  };

  const confirmDefinitionArtifactsPrompt = async () => {
    const context = definitionArtifactsPromptContext.value;
    closeDefinitionArtifactsPrompt();
    if (context?.id) {
      await openDefinitionArtifactsManager(context);
    }
  };

  const openDefinitionArtifactsFromEditor = async () => {
    if (props.table?.table !== "process_definition_versions" || editorMode.value !== "edit" || !selectedRow.value?.id) {
      return;
    }
    clearModalOrigins();
    pushModalOrigin("editor");
    editorInstance?.hide();
    await openDefinitionArtifactsManager(selectedRow.value);
  };

  const openDefinitionArtifactFkSearch = () => {
    openFkSearch({ name: "template_artifact_id" }, (row) => {
      const idValue = row.id ?? "";
      definitionArtifactsForm.value = {
        ...definitionArtifactsForm.value,
        template_artifact_id: idValue ? String(idValue) : ""
      };
      const labelValue = formatFkOptionLabel("template_artifacts", row);
      definitionArtifactsLabels.value = {
        ...definitionArtifactsLabels.value,
        template_artifact_id: labelValue ? String(labelValue) : ""
      };
    });
  };

  const clearDefinitionArtifactSelection = () => {
    definitionArtifactsForm.value = {
      ...definitionArtifactsForm.value,
      template_artifact_id: ""
    };
    definitionArtifactsLabels.value = {
      ...definitionArtifactsLabels.value,
      template_artifact_id: ""
    };
  };

  const startDefinitionArtifactEdit = (row) => {
    if (!row) {
      return;
    }
    if (!canManageDefinitionArtifacts.value) {
      definitionArtifactsError.value = "Solo puedes modificar artifacts mientras la definicion este en draft.";
      return;
    }
    definitionArtifactsEditId.value = row.id ? String(row.id) : "";
    definitionArtifactsForm.value = {
      template_artifact_id: row.template_artifact_id ? String(row.template_artifact_id) : "",
      usage_role: row.usage_role || "manual_fill",
      creates_task: Number(row.creates_task) === 1 ? "1" : "0",
      is_required: Number(row.is_required) === 1 ? "1" : "0",
      sort_order: row.sort_order !== null && row.sort_order !== undefined ? String(row.sort_order) : "1"
    };
    definitionArtifactsLabels.value = {
      template_artifact_id: row.template_artifact_id
        ? String(getFkCachedLabel("template_artifacts", row.template_artifact_id) || row.template_artifact_id)
        : ""
    };
  };

  const submitDefinitionArtifact = async () => {
    const definitionId = definitionArtifactsContext.value?.id;
    if (!definitionId) {
      definitionArtifactsError.value = "No hay una definicion seleccionada.";
      return;
    }
    if (!canManageDefinitionArtifacts.value) {
      definitionArtifactsError.value = "Solo puedes modificar artifacts mientras la definicion este en draft.";
      return;
    }
    if (!definitionArtifactsForm.value.template_artifact_id) {
      definitionArtifactsError.value = "Selecciona un artifact.";
      return;
    }
    const payload = processDefinitionAdminService.buildArtifactPayload(definitionId, definitionArtifactsForm.value);
    definitionArtifactsError.value = "";
    try {
      await processDefinitionAdminService.saveArtifact(definitionArtifactsEditId.value, payload);
      resetDefinitionArtifactsForm();
      await loadDefinitionArtifacts();
    } catch (error) {
      definitionArtifactsError.value = error?.response?.data?.message || "No se pudo guardar el artifact.";
    }
  };

  const deleteDefinitionArtifact = async (row) => {
    if (!row?.id) {
      return;
    }
    if (!canManageDefinitionArtifacts.value) {
      definitionArtifactsError.value = "Solo puedes modificar artifacts mientras la definicion este en draft.";
      return;
    }
    if (!window.confirm("¿Deseas eliminar este artifact de la definicion?")) {
      return;
    }
    definitionArtifactsError.value = "";
    try {
      await processDefinitionAdminService.deleteArtifact(row.id);
      if (String(definitionArtifactsEditId.value) === String(row.id)) {
        resetDefinitionArtifactsForm();
      }
      await loadDefinitionArtifacts();
    } catch (error) {
      definitionArtifactsError.value = error?.response?.data?.message || "No se pudo eliminar el artifact.";
    }
  };

  return {
    resetDefinitionArtifactsForm,
    resetDefinitionRulesForm,
    resetDefinitionTriggersForm,
    formatDefinitionRuleSummary,
    handleDefinitionRuleScopeChange,
    refreshProcessDefinitionChecklist,
    loadDefinitionRules,
    openDefinitionRulesManager,
    closeDefinitionRulesManager,
    acceptDefinitionRulesManager,
    confirmDefinitionRulesPrompt,
    openDefinitionRulesFromEditor,
    openDefinitionRulesFromActivation,
    openDefinitionArtifactsFromActivation,
    openDefinitionRuleFkSearch,
    clearDefinitionRuleField,
    startDefinitionRuleEdit,
    submitDefinitionRule,
    deleteDefinitionRule,
    loadDefinitionTriggers,
    openDefinitionTriggersManager,
    closeDefinitionTriggersManager,
    acceptDefinitionTriggersManager,
    confirmDefinitionTriggersPrompt,
    openDefinitionTriggersFromEditor,
    openDefinitionTriggersFromActivation,
    handleDefinitionTriggerModeChange,
    openDefinitionTriggerFkSearch,
    clearDefinitionTriggerTermType,
    startDefinitionTriggerEdit,
    submitDefinitionTrigger,
    deleteDefinitionTrigger,
    loadDefinitionArtifacts,
    openDefinitionArtifactsManager,
    closeDefinitionArtifactsManager,
    acceptDefinitionArtifactsManager,
    openDefinitionArtifactsPrompt,
    closeDefinitionArtifactsPrompt,
    confirmDefinitionArtifactsPrompt,
    openDefinitionArtifactsFromEditor,
    openDefinitionArtifactFkSearch,
    clearDefinitionArtifactSelection,
    startDefinitionArtifactEdit,
    submitDefinitionArtifact,
    deleteDefinitionArtifact
  };
}
