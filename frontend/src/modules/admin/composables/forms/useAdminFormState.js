import { adminFkService } from "@/modules/admin/services/AdminFkService";

export function useAdminFormState({
  props,
  formFields,
  editableFields,
  formData,
  fkDisplay,
  fkCreateFields,
  fkCreateForm,
  fkFilterFields,
  fkFilters,
  fkTable,
  editorMode,
  isPersonTable,
  isForeignKeyField,
  toDateInputValue,
  toDateTimeInputValue
}) {
  const resetForm = () => {
    const payload = {};
    formFields.value.forEach((field) => {
      if (field.type === "boolean") {
        payload[field.name] = String(field.defaultValue ?? 1);
        return;
      }
      if (field.type === "date" || field.type === "datetime") {
        payload[field.name] = "";
        return;
      }
      payload[field.name] = field.defaultValue ?? "";
    });
    formData.value = payload;
  };

  const resetFkCreateForm = () => {
    fkCreateForm.value = adminFkService.createFkCreateForm(fkCreateFields.value);
  };

  const resetFkFilters = () => {
    fkFilters.value = adminFkService.createFkFilters(
      fkFilterFields.value,
      fkTable.value?.table || ""
    );
  };

  const buildFormFromRow = (row) => {
    const payload = {};
    const displayPayload = {};
    formFields.value.forEach((field) => {
      let value = row?.[field.name] ?? "";
      if (field.type === "boolean") {
        value = String(Number(value) === 1 ? 1 : 0);
      }
      if (field.type === "date") {
        value = toDateInputValue(value);
      }
      if (field.type === "datetime") {
        value = toDateTimeInputValue(value);
      }
      payload[field.name] = value;
      if (isForeignKeyField(field)) {
        displayPayload[field.name] = value ? String(value) : "";
      }
    });
    formData.value = payload;
    fkDisplay.value = displayPayload;
  };

  const isFieldLocked = (field) => {
    if (field.readOnly) {
      return true;
    }
    // EL ALCANCE DE UNA LÍNEA bloquea la columna que no le toca. `cargo_id` NO entra aquí, y esa
    // es la diferencia con la serie: el cargo es el OTRO eje y convive con cualquier alcance.
    if (props.table?.table === "lineas") {
      const scope = String(formData.value?.unit_scope_type || "all_units").trim();
      if (field.name === "unit_type_id") {
        return scope !== "unit_type";
      }
      if (field.name === "unit_id") {
        return scope !== "unit_exact";
      }
    }
    if (
      props.table?.table === "process_definition_versions"
      && editorMode.value === "create"
      && field.name === "status"
    ) {
      return true;
    }
    if (
      props.table?.table === "process_definition_versions"
      && editorMode.value === "edit"
      && ["process_id", "linea_id", "definition_version"].includes(field.name)
    ) {
      return true;
    }
    if (
      editorMode.value === "edit"
      && props.table?.primaryKeys?.includes(field.name)
      && !props.table?.allowPrimaryKeyUpdate
    ) {
      return true;
    }
    return false;
  };

  const handleSelectChange = (field) => {
    if (props.table?.table !== "lineas" || field?.name !== "unit_scope_type") {
      return;
    }
    const scope = String(formData.value?.unit_scope_type || "all_units").trim();
    // Limpia SÓLO la columna del alcance que se abandona. El cargo sobrevive: es el otro eje.
    const limpiar = scope === "unit_type"
      ? { unit_id: "" }
      : scope === "unit_exact"
        ? { unit_type_id: "" }
        : { unit_type_id: "", unit_id: "" };
    formData.value = { ...formData.value, ...limpiar };
    fkDisplay.value = { ...fkDisplay.value, ...limpiar };
  };


  const isInputField = (field) => ["text", "email", "number", "date", "datetime", "password"].includes(field.type);

  const inputType = (field) => (field.type === "datetime" ? "datetime-local" : (field.type || "text"));

  const buildPayload = () => {
    const payload = {};
    editableFields.value.forEach((field) => {
      if (
        props.table?.table === "process_definition_versions"
        && editorMode.value === "create"
        && field.name === "status"
      ) {
        payload.status = "draft";
        return;
      }
      if (
        props.table?.table === "process_definition_versions"
        && editorMode.value === "edit"
        && ["process_id", "linea_id", "definition_version"].includes(field.name)
      ) {
        return;
      }
      let value = formData.value[field.name];
      if (value === "") {
        value = null;
      }
      if (field.type === "number") {
        value = value === null ? null : Number(value);
        if (Number.isNaN(value)) {
          value = null;
        }
      }
      if (field.type === "boolean") {
        value = Number(value) === 1 ? 1 : 0;
      }
      payload[field.name] = value;
    });
    if (
      props.table?.table === "process_definition_versions"
      && editorMode.value === "create"
      && formData.value
    ) {
      payload.source_process_definition_id = payload.source_process_definition_id ?? null;
    }
    if (isPersonTable.value && editorMode.value === "create") {
      const password = formData.value.password;
      if (typeof password === "string" && password !== "") {
        payload.password = password;
      }
    }
    return payload;
  };

  return {
    resetForm,
    resetFkCreateForm,
    resetFkFilters,
    buildFormFromRow,
    isFieldLocked,
    handleSelectChange,
    isInputField,
    inputType,
    buildPayload
  };
}
