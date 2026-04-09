import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

export function useAdminFkSearch({
  formData,
  fkDisplay,
  fkTable,
  fkRows,
  fkSearch,
  fkLoading,
  fkError,
  fkField,
  fkSetter,
  fkViewerRow,
  fkCreateForm,
  fkCreateError,
  fkCreateExitTarget,
  fkNestedExitTarget,
  unitTypeByUnitId,
  fkPositionFilters,
  resetFkFilters,
  resetFkUnitPositionFilters,
  loadFkUnitTypeOptions,
  loadFkCargoOptions,
  loadFkProcessDefinitionProcessOptions,
  resolveFkTable,
  resolveDisplayField,
  isFkUnitPositions,
  isFkUnits,
  isForeignKeyField,
  prefetchFkLabelsForRows,
  prefetchUnitTypeForUnitPositions,
  buildFkFilterParams,
  getFkCachedLabel,
  formatCell,
  fkPrimaryListField,
  ensureFkInstance,
  getFkInstance,
  hideParentModals,
  allTablesMap
}) {
  const fetchFkRows = async () => {
    if (!fkTable.value) {
      fkRows.value = [];
      return;
    }
    fkLoading.value = true;
    fkError.value = "";
    try {
      const filterParams = buildFkFilterParams();
      const inheritedUnitId = filterParams.filter_unit_id;
      if (filterParams.filter_unit_id !== undefined) {
        delete filterParams.filter_unit_id;
      }
      const baseParams = {
        q: fkSearch.value || undefined,
        ...filterParams
      };

      let rowsData = [];
      if (isFkUnitPositions.value) {
        const selectedUnitId = fkPositionFilters.value.unit_id || inheritedUnitId || "";
        const selectedUnitTypeId = fkPositionFilters.value.unit_type_id || "";
        const selectedCargoId = fkPositionFilters.value.cargo_id || "";
        const cargoFilter = selectedCargoId ? { filter_cargo_id: selectedCargoId } : {};
        const activeFilter = { filter_is_active: 1 };
        if (selectedUnitId) {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
            params: {
              ...baseParams,
              filter_unit_id: selectedUnitId,
              ...cargoFilter,
              ...activeFilter,
              limit: 200
            }
          });
          rowsData = response.data || [];
        } else if (selectedUnitTypeId) {
          const unitsResponse = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
            params: {
              filter_unit_type_id: selectedUnitTypeId,
              limit: 500
            }
          });
          const unitIds = Array.from(
            new Set(
              (unitsResponse.data || [])
                .map((row) => row?.id)
                .filter((value) => value !== null && value !== undefined && value !== "")
            )
          );
          if (!unitIds.length) {
            rowsData = [];
          } else {
            const responses = await Promise.all(
              unitIds.map((unitId) =>
                axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
                  params: {
                    ...baseParams,
                    filter_unit_id: unitId,
                    ...cargoFilter,
                    ...activeFilter,
                    limit: 200
                  }
                })
              )
            );
            const mergedRows = new Map();
            responses.forEach((response) => {
              (response.data || []).forEach((row) => {
                const key = row?.id !== undefined ? String(row.id) : JSON.stringify(row);
                mergedRows.set(key, row);
              });
            });
            rowsData = Array.from(mergedRows.values());
          }
        } else {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
            params: {
              ...baseParams,
              ...cargoFilter,
              ...activeFilter,
              limit: 25
            }
          });
          rowsData = response.data || [];
        }

        const activeAssignmentsResponse = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
          params: {
            filter_is_current: 1,
            limit: 5000
          }
        });
        const assignedPositionIds = new Set(
          (activeAssignmentsResponse.data || [])
            .map((row) => row?.position_id)
            .filter((value) => value !== null && value !== undefined && value !== "")
            .map((value) => String(value))
        );
        rowsData = rowsData.filter((row) => !assignedPositionIds.has(String(row?.id)));
      } else if (isFkUnits.value) {
        const selectedUnitTypeId = fkPositionFilters.value.unit_type_id || "";
        const unitTypeFilter = selectedUnitTypeId
          ? { filter_unit_type_id: selectedUnitTypeId }
          : {};
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
          params: {
            ...baseParams,
            ...unitTypeFilter,
            limit: 100
          }
        });
        rowsData = response.data || [];
      } else {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(fkTable.value.table), {
          params: {
            ...baseParams,
            limit: 25
          }
        });
        rowsData = response.data || [];
      }

      if (fkTable.value.table === "process_definition_series" && fkField.value === "series_id") {
        rowsData = rowsData.filter(
          (row) => Number(row?.is_active) === 1 && String(row?.source_type || "") !== "legacy"
        );
      }

      fkRows.value = rowsData;
      const fkFields = (fkTable.value.fields || [])
        .filter((field) => isForeignKeyField(field))
        .map((field) => field.name);
      await prefetchFkLabelsForRows(fkRows.value, fkFields);
      if (fkTable.value.table === "unit_positions") {
        await prefetchUnitTypeForUnitPositions(fkRows.value);
      }
    } catch (err) {
      fkError.value = err?.response?.data?.message || "No se pudo cargar la informacion.";
    } finally {
      fkLoading.value = false;
    }
  };

  const openFkSearch = async (field, onSelect = null) => {
    const tableName = resolveFkTable(field.name);
    if (!tableName) {
      return;
    }
    hideParentModals();
    fkSetter.value = onSelect;
    fkField.value = field.name;
    fkTable.value = allTablesMap.value[tableName] || null;
    unitTypeByUnitId.value = {};
    fkViewerRow.value = null;
    resetFkFilters();
    fkCreateForm.value = {};
    fkCreateError.value = "";
    fkCreateExitTarget.value = "none";
    fkNestedExitTarget.value = "none";
    fkSearch.value = "";
    resetFkUnitPositionFilters();
    if (tableName === "unit_positions" || tableName === "units") {
      await loadFkUnitTypeOptions();
    }
    if (tableName === "unit_positions") {
      await loadFkCargoOptions();
    }
    if (tableName === "process_definition_versions") {
      await loadFkProcessDefinitionProcessOptions();
    }
    await fetchFkRows();
    ensureFkInstance();
    getFkInstance()?.show();
  };

  const applyFkSelection = (row) => {
    if (!fkField.value || !row) {
      return;
    }
    if (fkSetter.value) {
      fkSetter.value(row);
      fkSetter.value = null;
      return;
    }
    formData.value[fkField.value] = row.id ?? row[fkField.value] ?? "";
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    fkDisplay.value = {
      ...fkDisplay.value,
      [fkField.value]: labelValue ? String(labelValue) : ""
    };
  };

  const selectFkRow = (row) => {
    applyFkSelection(row);
    getFkInstance()?.hide();
  };

  const formatFkListCell = (row, field) => {
    if (!row || !field) {
      return "—";
    }
    if (field.name === "__unit_type_id") {
      const unitId = row.unit_id;
      if (unitId === null || unitId === undefined || unitId === "") {
        return "—";
      }
      const unitTypeId = unitTypeByUnitId.value[String(unitId)];
      if (unitTypeId === null || unitTypeId === undefined || unitTypeId === "") {
        return "—";
      }
      const unitTypeLabel = getFkCachedLabel("unit_types", unitTypeId);
      return unitTypeLabel ?? unitTypeId;
    }
    return formatCell(row[field.name], field);
  };

  const formatFkPrimaryCell = (row) => {
    if (!row) {
      return "—";
    }
    if (!fkPrimaryListField.value) {
      const displayField = resolveDisplayField(fkTable.value) || "id";
      const value = row[displayField];
      return value === null || value === undefined || value === "" ? "—" : String(value);
    }
    return formatFkListCell(row, fkPrimaryListField.value);
  };

  return {
    fetchFkRows,
    openFkSearch,
    applyFkSelection,
    selectFkRow,
    formatFkListCell,
    formatFkPrimaryCell
  };
}
