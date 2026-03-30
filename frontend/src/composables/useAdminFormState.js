import { adminFkService } from "@/services/admin/AdminFkService";

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
  toDateTimeInputValue,
  resetInlineFkState
}) {
  const resetForm = () => {
    resetInlineFkState();
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
    if (props.table?.table === "process_definition_series") {
      const sourceType = String(formData.value?.source_type || "").trim();
      if (field.name === "unit_type_id") {
        return sourceType !== "unit_type";
      }
      if (field.name === "cargo_id") {
        return sourceType !== "cargo";
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
      && ["process_id", "variation_key", "definition_version"].includes(field.name)
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
    if (props.table?.table !== "process_definition_series" || field?.name !== "source_type") {
      return;
    }
    const sourceType = String(formData.value?.source_type || "").trim();
    if (sourceType === "unit_type") {
      formData.value = {
        ...formData.value,
        cargo_id: ""
      };
      fkDisplay.value = {
        ...fkDisplay.value,
        cargo_id: ""
      };
      return;
    }
    if (sourceType === "cargo") {
      formData.value = {
        ...formData.value,
        unit_type_id: ""
      };
      fkDisplay.value = {
        ...fkDisplay.value,
        unit_type_id: ""
      };
      return;
    }
    formData.value = {
      ...formData.value,
      unit_type_id: "",
      cargo_id: ""
    };
    fkDisplay.value = {
      ...fkDisplay.value,
      unit_type_id: "",
      cargo_id: ""
    };
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
        && ["process_id", "variation_key", "definition_version"].includes(field.name)
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
