import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";
import { processDefinitionAdminService } from "@/modules/admin/services/ProcessDefinitionAdminService";

export function useProcessDefinitionManager({
  props,
  editorMode,
  selectedRow,
  getEditorInstance,
  definitionRulesContext,
  definitionRulesRows,
  definitionRulesLoading,
  definitionRulesError,
  definitionRulesEditId,
  definitionRulesForm,
  definitionRulesLabels,
  definitionRulesLineaScope,
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
  canManageDefinitionRules,
  canManageDefinitionTriggers,
  canManageDefinitionArtifacts,
  canSubmitDefinitionRule,
  canSubmitDefinitionTrigger,
  clearModalOrigins,
  pushModalOrigin,
  closeProcessDefinitionActivationModal,
  openFkSearch,
  resolveFkSuggestions,
  formatFkOptionLabel,
  getFkCachedLabel,
  formatCell,
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
  const blurActiveElement = () => {
    if (typeof document === "undefined") {
      return;
    }
    document.activeElement?.blur?.();
  };

  const resetDefinitionArtifactsForm = () => {
    definitionArtifactsEditId.value = "";
    definitionArtifactsForm.value = processDefinitionAdminService.createArtifactForm();
    definitionArtifactsLabels.value = processDefinitionAdminService.createArtifactLabels();
  };

  const resolveEditorInstance = () => (
    typeof getEditorInstance === "function" ? getEditorInstance() : getEditorInstance
  );

  // La serie del proceso fija un eje (cargo o tipo de unidad). Lo re-sembramos sobre el formulario tras
  // cualquier cambio para que no quede estado obsoleto (p. ej. al alternar la entrega). En "puesto exacto"
  // el puesto define unidad y cargo, así que no se siembra (el guard del backend valida el puesto).
  // AQUI VIVIA `applyRuleSeriesSeed`, que copiaba el cargo y el tipo de unidad de la linea DENTRO
  // del formulario de la regla para que el usuario viera prerrellenado lo que un guardia del backend
  // iba a imponer de todas formas. Se fue con las cuatro columnas (frente 25, P10): no hay nada que
  // sembrar, porque la regla ya no declara el alcance. `definitionRulesLineaScope` sigue cargandose
  // —la pantalla lo ENSENA como contexto—, pero ya no se copia a ningun campo.
  const resetDefinitionRulesForm = () => {
    definitionRulesEditId.value = "";
    definitionRulesForm.value = processDefinitionAdminService.createRuleForm();
    definitionRulesLabels.value = processDefinitionAdminService.createRuleLabels();
  };

  const loadDefinitionRulesSeriesScope = async (definitionId) => {
    if (!definitionRulesLineaScope) {
      return;
    }
    if (!definitionId) {
      definitionRulesLineaScope.value = null;
      return;
    }
    try {
      const { data } = await axios.get(API_ROUTES.ADMIN_SQL_PROCESS_LINEA_SCOPE(definitionId));
      definitionRulesLineaScope.value = data && Object.keys(data).length ? data : null;
    } catch {
      definitionRulesLineaScope.value = null;
    }
  };

  const resetDefinitionTriggersForm = () => {
    definitionTriggersEditId.value = "";
    definitionTriggersForm.value = processDefinitionAdminService.createTriggerForm();
    definitionTriggersLabels.value = processDefinitionAdminService.createTriggerLabels();
  };

  // EL DESTINO ES LA POLITICA, y nada mas. Esto leia `unit_scope_type`, `unit_type_id`, `unit_id`
  // y `cargo_id` de la regla: las cuatro murieron en `P10` y la fila ya no las trae, asi que el
  // panel de activacion ensenaba un guion. Y la rama del puesto exacto se fue con `P25`.
  const formatDefinitionRuleSummary = (row) => {
    if (!row) {
      return "—";
    }
    return formatCell(row.recipient_policy, { name: "recipient_policy" }, row);
  };

  // AQUI VIVIA `handleDefinitionRuleRecipientPolicyChange`, que al cambiar de politica limpiaba el
  // puesto exacto. Sin puesto (frente 25, P25) no queda nada que limpiar.

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
      // SIN `prefetchFkLabelsForRows`: la regla ya no tiene ni una clave ajena que rotular
      // (frente 25, P25). Pedia las etiquetas de cuatro columnas que no existen desde `P10`.
      definitionRulesRows.value = response.data || [];
    } catch {
      definitionRulesRows.value = [];
      definitionRulesError.value = "No se pudieron cargar las reglas vinculadas.";
    } finally {
      definitionRulesLoading.value = false;
    }
    await refreshProcessDefinitionChecklist(definitionRulesContext.value);
  };

  const openDefinitionRulesManager = async (definitionRow, { showModal = true } = {}) => {
    if (!definitionRow?.id) {
      return;
    }
    definitionRulesContext.value = { ...definitionRow };
    definitionRulesError.value = "";
    await loadDefinitionRulesSeriesScope(definitionRow.id);
    resetDefinitionRulesForm();
    if (showModal) {
      ensureDefinitionRulesInstance();
      getDefinitionRulesInstance()?.show();
    }
    await loadDefinitionRules();
  };

  const closeDefinitionRulesManager = () => {
    clearModalOrigins();
    blurActiveElement();
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
    blurActiveElement();
    resolveEditorInstance()?.hide();
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

  // AQUI VIVIERON 140 LINEAS DE MAQUINARIA DE CLAVES AJENAS DE LA REGLA (frente 25, P25):
  // `openDefinitionRuleFkSearch`, `buildDefinitionRuleSuggestProvider`, el mapa
  // `definitionRuleSuggestProviders`, `selectDefinitionRuleOption` y `clearDefinitionRuleField`,
  // mas el autollenado de unidad y cargo al elegir un puesto. Servian a los campos de alcance
  // --muertos en `P10`-- y al puesto exacto, muerto aqui. El formulario de una regla es HOY UN
  // DESPLEGABLE DE DOS VALORES, y un desplegable no busca nada.

  const startDefinitionRuleEdit = (row) => {
    if (!row) {
      return;
    }
    if (!canManageDefinitionRules.value) {
      definitionRulesError.value = "Solo puedes modificar reglas mientras la configuracion este en draft.";
      return;
    }
    definitionRulesEditId.value = row.id ? String(row.id) : "";
    // UNA CLAVE, Y ERAN SIETE. Las cuatro del alcance murieron en `P10`, `priority` con ellas y
    // `position_id` en `P25`: hidratarlas dejaba el formulario lleno de claves que nadie enviaba.
    definitionRulesForm.value = {
      recipient_policy: row.recipient_policy || "all_matches"
    };
    definitionRulesLabels.value = {};
  };

  const submitDefinitionRule = async () => {
    const definitionId = definitionRulesContext.value?.id;
    if (!definitionId) {
      definitionRulesError.value = "No hay una configuracion seleccionada.";
      return;
    }
    if (!canManageDefinitionRules.value) {
      definitionRulesError.value = "Solo puedes modificar reglas mientras la configuracion este en draft.";
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
      definitionRulesError.value = "Solo puedes modificar reglas mientras la configuracion este en draft.";
      return;
    }
    if (!window.confirm("¿Deseas eliminar esta regla de la configuracion?")) {
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

  const openDefinitionTriggersManager = async (definitionRow, { showModal = true } = {}) => {
    if (!definitionRow?.id) {
      return;
    }
    definitionTriggersContext.value = { ...definitionRow };
    definitionTriggersError.value = "";
    resetDefinitionTriggersForm();
    if (showModal) {
      ensureDefinitionTriggersInstance();
      getDefinitionTriggersInstance()?.show();
    }
    await loadDefinitionTriggers();
  };

  const closeDefinitionTriggersManager = () => {
    clearModalOrigins();
    blurActiveElement();
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
    blurActiveElement();
    resolveEditorInstance()?.hide();
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

  // El proceso siempre corre en un tipo de periodo; ya no hay "modo de disparo" que limpiar.
  const handleDefinitionTriggerModeChange = () => {};

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

  // Recomendaciones inline (combobox) para "Tipo de periodo". Reutiliza el fetcher
  // headless y el mismo formateador de etiqueta que el modal.
  const definitionTriggerSuggestProvider = async (searchText) => {
    const { rows } = await resolveFkSuggestions("term_type_id", { q: searchText });
    return (rows || []).map((row) => ({
      id: row?.id ?? "",
      label: formatFkOptionLabel("term_types", row),
      row
    }));
  };

  const selectDefinitionTriggerOption = (option) => {
    const idValue = option?.id ?? "";
    definitionTriggersForm.value = {
      ...definitionTriggersForm.value,
      term_type_id: idValue ? String(idValue) : ""
    };
    definitionTriggersLabels.value = {
      ...definitionTriggersLabels.value,
      term_type_id: option?.label ?? ""
    };
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
      definitionTriggersError.value = "Solo puedes modificar disparadores mientras la configuracion este en draft.";
      return;
    }
    definitionTriggersEditId.value = row.id ? String(row.id) : "";
    definitionTriggersForm.value = {
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
      definitionTriggersError.value = "No hay una configuracion seleccionada.";
      return;
    }
    if (!canManageDefinitionTriggers.value) {
      definitionTriggersError.value = "Solo puedes modificar disparadores mientras la configuracion este en draft.";
      return;
    }
    if (!canSubmitDefinitionTrigger.value) {
      definitionTriggersError.value = "Selecciona el tipo de periodo requerido para este disparador.";
      return;
    }
    const payload = processDefinitionAdminService.buildTriggerPayload(
      definitionId,
      definitionTriggersForm.value
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
      definitionTriggersError.value = "Solo puedes modificar disparadores mientras la configuracion este en draft.";
      return;
    }
    if (!window.confirm("¿Deseas eliminar este disparador de la configuracion?")) {
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
      await prefetchFkLabelsForRows(definitionArtifactsRows.value, ["edicion_id"]);
    } catch {
      definitionArtifactsRows.value = [];
      definitionArtifactsError.value = "No se pudieron cargar las plantillas vinculadas.";
    } finally {
      definitionArtifactsLoading.value = false;
    }
    await refreshProcessDefinitionChecklist(definitionArtifactsContext.value);
  };

  const openDefinitionArtifactsManager = async (definitionRow, { showModal = true } = {}) => {
    if (!definitionRow?.id) {
      return;
    }
    definitionArtifactsContext.value = { ...definitionRow };
    definitionArtifactsError.value = "";
    resetDefinitionArtifactsForm();
    if (showModal) {
      ensureDefinitionArtifactsInstance();
      getDefinitionArtifactsInstance()?.show();
    }
    await loadDefinitionArtifacts();
  };

  const closeDefinitionArtifactsManager = () => {
    clearModalOrigins();
    blurActiveElement();
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
    blurActiveElement();
    resolveEditorInstance()?.hide();
    await openDefinitionArtifactsManager(selectedRow.value);
  };

  const openDefinitionArtifactFkSearch = () => {
    openFkSearch({ name: "edicion_id" }, (row) => {
      const idValue = row.id ?? "";
      definitionArtifactsForm.value = {
        ...definitionArtifactsForm.value,
        edicion_id: idValue ? String(idValue) : ""
      };
      const labelValue = formatFkOptionLabel("ediciones", row);
      definitionArtifactsLabels.value = {
        ...definitionArtifactsLabels.value,
        edicion_id: labelValue ? String(labelValue) : ""
      };
      // El panel ya no tiene tarjeta de selección con botón "Guardar": al elegir la plantilla se vincula
      // inmediatamente (modo creación, editId vacío). Antes esto solo rellenaba el formulario y "no pasaba nada".
      if (idValue) {
        definitionArtifactsEditId.value = "";
        submitDefinitionArtifact();
      }
    });
  };

  const clearDefinitionArtifactSelection = () => {
    definitionArtifactsForm.value = {
      ...definitionArtifactsForm.value,
      edicion_id: ""
    };
    definitionArtifactsLabels.value = {
      ...definitionArtifactsLabels.value,
      edicion_id: ""
    };
  };

  const startDefinitionArtifactEdit = (row) => {
    if (!row) {
      return;
    }
    if (!canManageDefinitionArtifacts.value) {
      definitionArtifactsError.value = "Solo puedes modificar plantillas mientras la configuracion este en draft.";
      return;
    }
    definitionArtifactsEditId.value = row.id ? String(row.id) : "";
    definitionArtifactsForm.value = {
      edicion_id: row.edicion_id ? String(row.edicion_id) : "",
      // creates_task ya no se edita (siempre materializa entregable); sort_order se conserva (interno).
      sort_order: row.sort_order !== null && row.sort_order !== undefined ? String(row.sort_order) : ""
    };
    definitionArtifactsLabels.value = {
      edicion_id: row.edicion_id
        ? String(getFkCachedLabel("ediciones", row.edicion_id) || row.edicion_id)
        : ""
    };
  };

  const submitDefinitionArtifact = async () => {
    const definitionId = definitionArtifactsContext.value?.id;
    if (!definitionId) {
      definitionArtifactsError.value = "No hay una configuracion seleccionada.";
      return;
    }
    if (!canManageDefinitionArtifacts.value) {
      definitionArtifactsError.value = "Solo puedes modificar plantillas mientras la configuracion este en draft.";
      return;
    }
    if (!definitionArtifactsForm.value.edicion_id) {
      definitionArtifactsError.value = "Selecciona una plantilla.";
      return;
    }
    const payload = processDefinitionAdminService.buildArtifactPayload(definitionId, definitionArtifactsForm.value);
    definitionArtifactsError.value = "";
    try {
      await processDefinitionAdminService.saveArtifact(definitionArtifactsEditId.value, payload);
      resetDefinitionArtifactsForm();
      await loadDefinitionArtifacts();
    } catch (error) {
      definitionArtifactsError.value = error?.response?.data?.message || "No se pudo guardar la plantilla.";
    }
  };

  // Cambia el modo de emisión (single/replicated/routed) de una plantilla ligada, en línea desde la tabla.
  const setDefinitionArtifactItemMode = async (row, itemMode) => {
    const definitionId = definitionArtifactsContext.value?.id;
    if (!definitionId || !row?.id) {
      return;
    }
    if (!canManageDefinitionArtifacts.value) {
      definitionArtifactsError.value = "Solo puedes modificar plantillas mientras la configuracion este en draft.";
      return;
    }
    definitionArtifactsError.value = "";
    try {
      const payload = processDefinitionAdminService.buildArtifactPayload(definitionId, {
        edicion_id: row.edicion_id,
        sort_order: row.sort_order,
        item_mode: itemMode
      });
      await processDefinitionAdminService.saveArtifact(String(row.id), payload);
      await loadDefinitionArtifacts();
    } catch (error) {
      definitionArtifactsError.value = error?.response?.data?.message || "No se pudo actualizar el modo de emisión.";
    }
  };

  const deleteDefinitionArtifact = async (row) => {
    if (!row?.id) {
      return;
    }
    if (!canManageDefinitionArtifacts.value) {
      definitionArtifactsError.value = "Solo puedes modificar plantillas mientras la configuracion este en draft.";
      return;
    }
    if (!window.confirm("¿Deseas eliminar esta plantilla de la configuracion?")) {
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
      definitionArtifactsError.value = error?.response?.data?.message || "No se pudo eliminar la plantilla.";
    }
  };

  return {
    resetDefinitionArtifactsForm,
    resetDefinitionRulesForm,
    resetDefinitionTriggersForm,
    formatDefinitionRuleSummary,
    refreshProcessDefinitionChecklist,
    loadDefinitionRules,
    openDefinitionRulesManager,
    closeDefinitionRulesManager,
    acceptDefinitionRulesManager,
    confirmDefinitionRulesPrompt,
    openDefinitionRulesFromEditor,
    openDefinitionRulesFromActivation,
    openDefinitionArtifactsFromActivation,
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
    definitionTriggerSuggestProvider,
    selectDefinitionTriggerOption,
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
    setDefinitionArtifactItemMode,
    deleteDefinitionArtifact
  };
}
