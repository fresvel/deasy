/**
 * Envio del formulario de administracion (crear/editar) y borrado.
 *
 * submitForm era una sola funcion de complejidad cognitiva 67 (umbral de Sonar: 15) que mezclaba
 * cinco cosas: guardas de entrada, guardas del ciclo de vida de process_definition_versions,
 * persistencia, cierre del editor y encadenados post-creacion. Cada una vive ahora en su unidad
 * con nombre propio; los helpers de arriba son puros y no tocan refs.
 */

const PROCESS_DEFINITION_VERSIONS = "process_definition_versions";
const ACTIVE_DEFINITION_EDITABLE_KEYS = ["status", "effective_to"];
const ACTIVE_DEFINITION_CONFLICT = "Una configuracion activa solo permite cambiar estado o vigencia final.";

/** Un id sirve para buscar si no es nulo ni cadena vacia (0 y "0" si valen). */
const hasIdentifier = (value) => value !== null && value !== undefined && value !== "";

const readResponseNotice = (response) => (response?.data?.__notice ? String(response.data.__notice) : "");

/** La fila creada es el payload enviado, pisado por lo que devuelva el backend. */
const mergeCreatedRow = (payload, response) => {
  const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
  return { ...payload, ...responseRow };
};

const isMissingPassword = (password) => typeof password !== "string" || !password.trim();

const findRowById = (rows, id) => (
  hasIdentifier(id) ? rows.find((row) => String(row.id) === String(id)) : null
);

/** Primero por id; si el backend no lo devolvio, por cedula o email. */
const findCreatedPersonRow = (rows, createdPersonRow) => (
  findRowById(rows, createdPersonRow.id ?? createdPersonRow._id)
  || rows.find((row) => (
    (createdPersonRow.cedula && row.cedula === createdPersonRow.cedula)
    || (createdPersonRow.email && row.email === createdPersonRow.email)
  ))
);

/** Si la definicion no aparece en las filas refrescadas, se sintetiza a partir de lo creado. */
const resolveCreatedDefinitionRow = (rows, createdDefinitionRow) => (
  findRowById(rows, createdDefinitionRow.id)
  || { ...createdDefinitionRow, id: createdDefinitionRow.id ?? "" }
);

const resolveCreatedProcessRow = (rows, createdProcessRow) => (
  rows.find((row) => (
    (createdProcessRow.id && String(row.id) === String(createdProcessRow.id))
    || (createdProcessRow.slug && String(row.slug) === String(createdProcessRow.slug))
  )) || createdProcessRow
);

/** Tablas cuya fila recien creada dispara un encadenado propio. */
const CREATED_ROW_BY_TABLE = {
  [PROCESS_DEFINITION_VERSIONS]: "definition",
  processes: "process",
  terms: "term"
};

const collectCreatedRows = ({ table, isPerson, payload, response }) => {
  const created = {};
  if (isPerson) {
    created.person = mergeCreatedRow(payload, response);
  }
  const key = CREATED_ROW_BY_TABLE[table];
  if (key) {
    created[key] = mergeCreatedRow(payload, response);
  }
  return created;
};

/** Una version activa solo admite cambios de estado o vigencia final; lo demas pide versionar. */
const needsVersioning = ({ table, mode, selectedRow, payload, getChangedPayloadKeys }) => {
  if (table !== PROCESS_DEFINITION_VERSIONS || mode !== "edit") {
    return false;
  }
  if (String(selectedRow?.status || "") !== "active") {
    return false;
  }
  const changedKeys = getChangedPayloadKeys(selectedRow || {}, payload);
  return changedKeys.filter((key) => !ACTIVE_DEFINITION_EDITABLE_KEYS.includes(key)).length > 0;
};

/** Pasar un borrador a activo se confirma antes en su propio modal. */
const needsActivationConfirmation = ({ table, mode, selectedRow, payload, activationConfirmed }) => (
  table === PROCESS_DEFINITION_VERSIONS
  && mode === "edit"
  && String(selectedRow?.status || "") === "draft"
  && String(payload.status || "") === "active"
  && !activationConfirmed
);

/** El backend tambien rechaza el cambio prohibido; se reconduce al mismo modal de versionado. */
const isActiveDefinitionConflict = ({ table, mode, message }) => (
  table === PROCESS_DEFINITION_VERSIONS
  && mode === "edit"
  && message === ACTIVE_DEFINITION_CONFLICT
);

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
  openProcessConfiguration,
  openProcessDefinitionActivationModal,
  openProcessDefinitionVersioningModal,
  openProcessLaunch,
  showFeedbackToast,
  getDeleteInstance
}) {
  /** Devuelve true si una guarda desvia el flujo a un modal y no hay que guardar. */
  const runPreSaveGuards = async (payload) => {
    const guardContext = {
      table: props.table.table,
      mode: editorMode.value,
      selectedRow: selectedRow.value,
      payload
    };
    if (needsVersioning({ ...guardContext, getChangedPayloadKeys })) {
      openProcessDefinitionVersioningModal();
      return true;
    }
    const activationConfirmed = processDefinitionActivationConfirmed.value;
    if (needsActivationConfirmation({ ...guardContext, activationConfirmed })) {
      processDefinitionActivationFromEditor.value = true;
      await openProcessDefinitionActivationModal();
      return true;
    }
    return false;
  };

  const persistForm = async (payload) => {
    const table = props.table.table;
    if (editorMode.value === "create") {
      const response = await adminSqlService.create(table, payload);
      return {
        responseNotice: readResponseNotice(response),
        created: collectCreatedRows({ table, isPerson: isPersonTable.value, payload, response })
      };
    }
    const keys = buildKeys(selectedRow.value || {});
    const response = await adminSqlService.update(table, keys, payload);
    return { responseNotice: readResponseNotice(response), created: {} };
  };

  const closeEditorAfterSave = async ({ responseNotice, usedActivationConfirmation }) => {
    getEditorInstance()?.hide();
    processDefinitionCloneSourceId.value = "";
    await fetchRows();
    if (usedActivationConfirmation) {
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
  };

  const runCreationFollowUps = async (created, { openProcessConfigurationAfterCreate }) => {
    if (created.person) {
      const selectedPerson = findCreatedPersonRow(rows.value, created.person);
      if (selectedPerson) {
        await openPersonAssignments(selectedPerson);
      }
    }
    if (created.definition?.id || created.definition?.process_id) {
      openDefinitionArtifactsPrompt(resolveCreatedDefinitionRow(rows.value, created.definition));
    }
    if (created.process && openProcessConfigurationAfterCreate) {
      await openProcessConfiguration(resolveCreatedProcessRow(rows.value, created.process));
    }
    if (created.term?.id && typeof openProcessLaunch === "function") {
      // En vez de un confirm nativo, se abre el modal de lanzamiento del periodo: muestra los
      // procesos vinculados a su tipo (pendientes/lanzados) y permite lanzar/relanzar.
      await openProcessLaunch(created.term);
    }
  };

  const handleSaveError = (err) => {
    const responseMessage = err?.response?.data?.message || "";
    const conflict = isActiveDefinitionConflict({
      table: props.table?.table,
      mode: editorMode.value,
      message: responseMessage
    });
    if (conflict) {
      processDefinitionActivationConfirmed.value = false;
      openProcessDefinitionVersioningModal();
      return;
    }
    if (processDefinitionActivationConfirmed.value) {
      processDefinitionActivationConfirmed.value = false;
      processDefinitionActivationFromEditor.value = false;
    }
    modalError.value = responseMessage || "No se pudo guardar el registro.";
  };

  const submitForm = async ({ openProcessConfigurationAfterCreate = false } = {}) => {
    if (!props.table) {
      return;
    }
    error.value = "";
    modalError.value = "";
    const creatingPerson = isPersonTable.value && editorMode.value === "create";
    if (creatingPerson && isMissingPassword(formData.value.password)) {
      modalError.value = "Ingresa el password del usuario.";
      return;
    }
    try {
      const payload = buildPayload();
      if (await runPreSaveGuards(payload)) {
        return;
      }
      const usedActivationConfirmation = processDefinitionActivationConfirmed.value;
      const { responseNotice, created } = await persistForm(payload);
      await closeEditorAfterSave({ responseNotice, usedActivationConfirmation });
      await runCreationFollowUps(created, { openProcessConfigurationAfterCreate });
    } catch (err) {
      handleSaveError(err);
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
