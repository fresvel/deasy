import {
  PROCESS_DEFINITION_HIDDEN_FIELDS,
  formatTemplateArtifactFieldLabel
} from "@/services/admin/AdminTableManagerConfig";

export function useAdminPresentationAdapters({
  props,
  allTablesMap,
  positionMetaById,
  processIdByDefinitionId,
  processDefinitionMetaById,
  fkLabelCache,
  resolveFkTable,
  isForeignKeyField,
  getFkCachedLabel,
  formatDateOnly,
  formatDateTimeHour,
  formatPositionType,
  formatSelectOptionLabel,
  formatAvailableFormatsSummary
}) {
  const getViewerFieldsForTable = (tableMeta, { includeVirtual = true } = {}) => {
    if (!tableMeta?.fields) {
      return [];
    }
    const fields = tableMeta.fields.filter((field) => {
      if (field.name === "password_hash") {
        return false;
      }
      if (!includeVirtual && field.virtual) {
        return false;
      }
      return true;
    });
    if (tableMeta.table === "process_target_rules") {
      const expandedFields = [];
      fields.forEach((field) => {
        expandedFields.push(field);
        if (field.name === "process_definition_id") {
          expandedFields.push({
            name: "__process_name",
            label: "Proceso",
            type: "text"
          });
        }
      });
      return expandedFields;
    }
    if (tableMeta.table === "template_artifacts") {
      return fields.map((field) => formatTemplateArtifactFieldLabel(field));
    }
    if (tableMeta.table === "process_definition_versions") {
      return fields.filter((field) => !PROCESS_DEFINITION_HIDDEN_FIELDS.has(field.name));
    }
    if (tableMeta.table === "process_definition_templates" && includeVirtual) {
      const expandedFields = [];
      fields.forEach((field) => {
        expandedFields.push(field);
        if (field.name === "process_definition_id") {
          expandedFields.push(
            { name: "__definition_series", label: "Serie", type: "text" },
            { name: "__definition_version", label: "Version", type: "text" },
            { name: "__definition_status", label: "Estado de definicion", type: "text" }
          );
        }
      });
      return expandedFields;
    }
    return fields;
  };

  const rowKeyForTable = (tableMeta, row) => {
    if (!tableMeta) {
      return JSON.stringify(row);
    }
    const primaryKeys = tableMeta.primaryKeys?.length ? tableMeta.primaryKeys : ["id"];
    return primaryKeys.map((key) => row?.[key]).join("-");
  };

  const rowKey = (row) => rowKeyForTable(props.table, row);

  const buildPersonAssignmentContext = (row) => {
    const firstName = row?.first_name ? String(row.first_name).trim() : "";
    const lastName = row?.last_name ? String(row.last_name).trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();
    return {
      id: row?.id ? String(row.id) : "",
      name: fullName || `Persona #${row?.id ?? ""}`,
      cedula: row?.cedula ? String(row.cedula) : "",
      email: row?.email ? String(row.email) : ""
    };
  };

  const formatValueForTable = (tableMeta, value, field, row = null) => {
    if (value === null || value === undefined || value === "") {
      if (!["__plaza", "__position_type", "__process_name", "__definition_series", "__definition_version", "__definition_status"].includes(field?.name)) {
        return "—";
      }
    }
    const fieldName = field?.name || "";
    if (["__plaza", "__position_type"].includes(fieldName)) {
      const positionId = row?.position_id;
      if (positionId === null || positionId === undefined || positionId === "") {
        return "—";
      }
      const positionMeta = positionMetaById.value[String(positionId)];
      if (!positionMeta) {
        return "—";
      }
      if (fieldName === "__position_type") {
        return formatPositionType(positionMeta.position_type);
      }
      const slotNo = positionMeta.slot_no;
      return slotNo === null || slotNo === undefined || slotNo === "" ? "—" : slotNo;
    }
    if (fieldName === "__process_name") {
      const definitionId = row?.process_definition_id;
      if (definitionId === null || definitionId === undefined || definitionId === "") {
        return "—";
      }
      const processId = processIdByDefinitionId.value[String(definitionId)];
      if (processId === null || processId === undefined || processId === "") {
        return "—";
      }
      const label = getFkCachedLabel("processes", processId);
      return label ?? processId;
    }
    if (["__definition_series", "__definition_version", "__definition_status"].includes(fieldName)) {
      const definitionId = row?.process_definition_id;
      if (definitionId === null || definitionId === undefined || definitionId === "") {
        return "—";
      }
      const definitionMeta = processDefinitionMetaById.value[String(definitionId)];
      if (!definitionMeta) {
        return "—";
      }
      if (fieldName === "__definition_series") {
        return definitionMeta.variation_key || "—";
      }
      if (fieldName === "__definition_version") {
        return definitionMeta.definition_version || "—";
      }
      return definitionMeta.status || "—";
    }
    if (["created_at", "updated_at", "created", "updated"].includes(fieldName)) {
      return formatDateTimeHour(value);
    }
    if (tableMeta?.table === "process_definition_versions" && fieldName === "series_id") {
      const seriesLabel = getFkCachedLabel("process_definition_series", value);
      if (seriesLabel !== null && seriesLabel !== undefined && seriesLabel !== "") {
        return seriesLabel;
      }
      return row?.variation_key || value || "—";
    }
    if (tableMeta?.table === "process_target_rules") {
      if (["effective_from", "effective_to"].includes(fieldName)) {
        return formatDateOnly(value);
      }
    }
    if (tableMeta?.table === "position_assignments") {
      if (["start_date", "end_date"].includes(field?.name)) {
        return formatDateOnly(value);
      }
    }
    if (["scope", "artifact_origin", "usage_role", "template_usage_role"].includes(fieldName)) {
      return formatSelectOptionLabel(field, value);
    }
    if (fieldName === "available_formats") {
      return formatAvailableFormatsSummary(value);
    }
    if (field.type === "boolean") {
      return Number(value) === 1 ? "Si" : "No";
    }
    if (isForeignKeyField(field)) {
      const tableName = resolveFkTable(field.name);
      if (!tableName) {
        return value;
      }
      const cache = fkLabelCache.value[tableName];
      const label = cache?.[value];
      return label ?? value;
    }
    return value;
  };

  const formatCell = (value, field, row = null) =>
    formatValueForTable(props.table, value, field, row);

  const formatDefinitionRuleCell = (row, fieldName) =>
    formatValueForTable(
      allTablesMap.value.process_target_rules || { table: "process_target_rules", fields: [] },
      row?.[fieldName],
      { name: fieldName },
      row
    );

  const toDateInputValue = (value) => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toISOString().slice(0, 10);
  };

  const toDateTimeInputValue = (value) => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toISOString().slice(0, 16);
  };

  const normalizeComparableFormValue = (fieldName, value, tableMeta = props.table) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const fieldMeta = tableMeta?.fields?.find((field) => field.name === fieldName) || null;
    if (fieldMeta?.type === "date") {
      return formatDateOnly(value);
    }
    if (fieldMeta?.type === "datetime") {
      return toDateTimeInputValue(value);
    }
    if (fieldMeta?.type === "number" || fieldMeta?.type === "boolean") {
      const numeric = Number(value);
      return Number.isNaN(numeric) ? String(value) : String(numeric);
    }
    return String(value).trim();
  };

  const getChangedPayloadKeys = (baseRow, payload, tableMeta = props.table) => {
    if (!payload || typeof payload !== "object") {
      return [];
    }
    return Object.keys(payload).filter((key) => (
      normalizeComparableFormValue(key, payload[key], tableMeta)
      !== normalizeComparableFormValue(key, baseRow?.[key], tableMeta)
    ));
  };

  const getNextSemanticVersion = (value) => {
    const source = String(value || "").trim();
    const match = source.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      return "0.1.0";
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]) + 1;
    return `${major}.${minor}.${patch}`;
  };

  return {
    getViewerFieldsForTable,
    rowKeyForTable,
    rowKey,
    buildPersonAssignmentContext,
    formatValueForTable,
    formatCell,
    formatDefinitionRuleCell,
    toDateInputValue,
    toDateTimeInputValue,
    normalizeComparableFormValue,
    getChangedPayloadKeys,
    getNextSemanticVersion
  };
}
