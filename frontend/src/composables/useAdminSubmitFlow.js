export function useAdminSubmitFlow({
  props,
  rows,
  error,
  modalError,
  formData,
  editorMode,
  selectedRow,
  processDefinitionCloneSourceId,
  processDefinitionActivationConfirmed,
  processDefinitionActivationFromEditor,
  isPersonTable,
  buildPayload,
  buildKeys,
  adminSqlService,
  getChangedPayloadKeys,
  getEditorInstance,
  fetchRows,
  personEditorId,
  resetPersonAssignments,
  openPersonAssignments,
  openDefinitionArtifactsPrompt,
  openProcessDefinitionActivationModal,
  openProcessDefinitionVersioningModal,
  showFeedbackToast,
  getDeleteInstance
}) {
  const submitForm = async () => {
    if (!props.table) {
      return;
    }
    error.value = "";
    modalError.value = "";
    if (isPersonTable.value && editorMode.value === "create") {
      const password = formData.value.password;
      if (typeof password !== "string" || !password.trim()) {
        modalError.value = "Ingresa el password del usuario.";
        return;
      }
    }
    try {
      const payload = buildPayload();
      if (
        props.table.table === "process_definition_versions"
        && editorMode.value === "edit"
        && String(selectedRow.value?.status || "") === "active"
      ) {
        const changedKeys = getChangedPayloadKeys(selectedRow.value || {}, payload);
        const disallowedActiveChanges = changedKeys.filter((key) => !["status", "effective_to"].includes(key));
        if (disallowedActiveChanges.length) {
          openProcessDefinitionVersioningModal();
          return;
        }
      }
      if (
        props.table.table === "process_definition_versions"
        && editorMode.value === "edit"
        && String(selectedRow.value?.status || "") === "draft"
        && String(payload.status || "") === "active"
        && !processDefinitionActivationConfirmed.value
      ) {
        processDefinitionActivationFromEditor.value = true;
        await openProcessDefinitionActivationModal();
        return;
      }
      const usesProcessDefinitionActivationConfirmation = processDefinitionActivationConfirmed.value;
      let createdPersonRow = null;
      let createdDefinitionRow = null;
      let createdTermRow = null;
      let responseNotice = "";
      if (editorMode.value === "create") {
        const response = await adminSqlService.create(props.table.table, payload);
        responseNotice = response?.data?.__notice ? String(response.data.__notice) : "";
        if (isPersonTable.value) {
          const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
          createdPersonRow = { ...payload, ...responseRow };
        }
        if (props.table.table === "process_definition_versions") {
          const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
          createdDefinitionRow = { ...payload, ...responseRow };
        }
        if (props.table.table === "terms") {
          const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
          createdTermRow = { ...payload, ...responseRow };
        }
      } else {
        const keys = buildKeys(selectedRow.value || {});
        const response = await adminSqlService.update(props.table.table, keys, payload);
        responseNotice = response?.data?.__notice ? String(response.data.__notice) : "";
      }
      getEditorInstance()?.hide();
      processDefinitionCloneSourceId.value = "";
      await fetchRows();
      if (usesProcessDefinitionActivationConfirmation) {
        processDefinitionActivationConfirmed.value = false;
        processDefinitionActivationFromEditor.value = false;
      }
      if (responseNotice) {
        showFeedbackToast({
          kind: "success",
          title: "Actualizacion aplicada",
          message: responseNotice,
          duration: 6200
        });
      }
      if (createdPersonRow) {
        const createdId = createdPersonRow.id ?? createdPersonRow._id;
        let selectedPerson = null;
        if (createdId !== null && createdId !== undefined && createdId !== "") {
          selectedPerson = rows.value.find((row) => String(row.id) === String(createdId));
        }
        if (!selectedPerson) {
          selectedPerson = rows.value.find((row) =>
            (createdPersonRow.cedula && row.cedula === createdPersonRow.cedula)
            || (createdPersonRow.email && row.email === createdPersonRow.email)
          );
        }
        if (selectedPerson) {
          await openPersonAssignments(selectedPerson);
        }
      }
      if (createdDefinitionRow?.id || createdDefinitionRow?.process_id) {
        let selectedDefinition = null;
        if (createdDefinitionRow.id !== null && createdDefinitionRow.id !== undefined && createdDefinitionRow.id !== "") {
          selectedDefinition = rows.value.find((row) => String(row.id) === String(createdDefinitionRow.id));
        }
        if (!selectedDefinition) {
          selectedDefinition = {
            ...createdDefinitionRow,
            id: createdDefinitionRow.id ?? ""
          };
        }
        openDefinitionArtifactsPrompt(selectedDefinition);
      }
      if (createdTermRow?.id) {
        const shouldInstantiate = window.confirm("El periodo se creo correctamente. ¿Deseas instanciar ahora las tareas automaticas?");
        if (shouldInstantiate) {
          try {
            const generationResponse = await adminSqlService.generateTermTasks(createdTermRow.id);
            const result = generationResponse?.data || {};
            showFeedbackToast({
              kind: "success",
              title: "Instanciacion completada",
              message: `Tareas: ${result.tasks_created ?? 0}. Items: ${result.task_items_created ?? 0}. Asignaciones: ${result.assignments_created ?? 0}.`,
              duration: 6200
            });
          } catch (generationError) {
            showFeedbackToast({
              kind: "error",
              title: "No se pudo instanciar",
              message: generationError?.response?.data?.error || generationError?.response?.data?.message || "No se pudieron generar las tareas del periodo."
            });
          }
        }
      }
    } catch (err) {
      const responseMessage = err?.response?.data?.message || "";
      if (
        props.table?.table === "process_definition_versions"
        && editorMode.value === "edit"
        && responseMessage === "Una definicion activa solo permite cambiar estado o vigencia final."
      ) {
        processDefinitionActivationConfirmed.value = false;
        openProcessDefinitionVersioningModal();
        return;
      }
      if (processDefinitionActivationConfirmed.value) {
        processDefinitionActivationConfirmed.value = false;
        processDefinitionActivationFromEditor.value = false;
      }
      modalError.value = responseMessage || "No se pudo guardar el registro.";
    }
  };

  const confirmDelete = async () => {
    if (!props.table || !selectedRow.value) {
      return;
    }
    error.value = "";
    try {
      const keys = buildKeys(selectedRow.value);
      await adminSqlService.remove(props.table.table, keys);
      if (
        isPersonTable.value
        && personEditorId.value
        && String(selectedRow.value?.id) === String(personEditorId.value)
      ) {
        resetPersonAssignments();
      }
      getDeleteInstance()?.hide();
      await fetchRows();
    } catch (err) {
      error.value = err?.response?.data?.message || "No se pudo eliminar el registro.";
    }
  };

  return {
    submitForm,
    confirmDelete
  };
}
