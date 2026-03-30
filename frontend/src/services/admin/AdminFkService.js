export class AdminFkService {
  createFkCreateForm(fields) {
    const payload = {};
    (fields || []).forEach((field) => {
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
    return payload;
  }

  createFkFilters(fields, tableName) {
    const payload = {};
    (fields || []).forEach((field) => {
      payload[field.name] = "";
    });
    if (tableName === "process_definition_versions") {
      payload.process_id = "";
      payload.variation_key = "";
      payload.status = "active";
      payload.execution_mode = "";
    }
    if (tableName === "template_artifacts") {
      payload.template_code = "";
      payload.storage_version = "";
      payload.is_active = "";
    }
    return payload;
  }

  buildFilterParams(filters) {
    const params = {};
    Object.entries(filters || {}).forEach(([field, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        params[`filter_${field}`] = value;
      }
    });
    return params;
  }

  buildCreatePayload(fields, form) {
    const payload = {};
    (fields || []).forEach((field) => {
      let value = form[field.name];
      if (value === "" || value === undefined) {
        value = null;
      }
      if (field.type === "number" && value !== null) {
        value = Number(value);
      }
      if (field.type === "boolean" && value !== null) {
        value = Number(value) === 1 ? 1 : 0;
      }
      payload[field.name] = value;
    });
    return payload;
  }
}

export const adminFkService = new AdminFkService();
