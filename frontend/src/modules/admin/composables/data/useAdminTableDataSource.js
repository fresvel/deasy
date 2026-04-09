import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

export function useAdminTableDataSource({
  props,
  rows,
  loading,
  error,
  searchTerm,
  processFilters,
  documentFilters,
  processDefinitionInlineFilters,
  processTargetRuleInlineFilters,
  templateArtifactInlineFilters,
  unitPositionFilters,
  vacantSearchTerm,
  vacantPositionFilters,
  vacantPositionRows,
  vacantPositionLoading,
  vacantPositionError,
  unassignedTemplateArtifactSearch,
  unassignedTemplateArtifactFilters,
  unassignedTemplateArtifactRows,
  unassignedTemplateArtifactLoading,
  unassignedTemplateArtifactError,
  personEditorId,
  personAssignmentContext,
  isPositionFilterTable,
  isUnitPositionsTable,
  isPositionAssignmentsTable,
  isProcessDefinitionTemplatesTable,
  isPersonTable,
  prefetchFkLabelsForRows,
  prefetchProcessLabelsForDefinitionRows,
  prefetchPositionMetaForAssignments,
  prefetchUnitTypeForUnitPositions,
  isForeignKeyField,
  buildPersonAssignmentContext,
  resetPersonAssignments
}) {
  const fetchUnitPositionsForCurrentFilters = async ({
    baseParams = {},
    limit = 500,
    includePositionTypeFilter = false,
    onlyActive = false,
    filters = null
  } = {}) => {
    const sourceFilters = filters || unitPositionFilters.value;
    const selectedUnitId = sourceFilters.unit_id;
    const selectedUnitTypeId = sourceFilters.unit_type_id;
    const selectedCargoId = sourceFilters.cargo_id;
    const selectedPositionType = includePositionTypeFilter ? sourceFilters.position_type : "";
    const cargoFilter = selectedCargoId ? { filter_cargo_id: selectedCargoId } : {};
    const positionTypeFilter = selectedPositionType ? { filter_position_type: selectedPositionType } : {};
    const positionActiveFilter = onlyActive ? { filter_is_active: 1 } : {};

    if (selectedUnitId) {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
        params: {
          ...baseParams,
          filter_unit_id: selectedUnitId,
          ...cargoFilter,
          ...positionTypeFilter,
          ...positionActiveFilter,
          limit
        }
      });
      return response.data || [];
    }

    if (selectedUnitTypeId) {
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
        return [];
      }
      const responses = await Promise.all(
        unitIds.map((unitId) =>
          axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
            params: {
              ...baseParams,
              filter_unit_id: unitId,
              ...cargoFilter,
              ...positionTypeFilter,
              ...positionActiveFilter,
              limit
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
      return Array.from(mergedRows.values());
    }

    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
      params: {
        ...baseParams,
        ...cargoFilter,
        ...positionTypeFilter,
        ...positionActiveFilter,
        limit
      }
    });
    return response.data || [];
  };

  const loadVacantPositions = async () => {
    if (!isPositionAssignmentsTable.value) {
      vacantPositionRows.value = [];
      vacantPositionError.value = "";
      vacantPositionLoading.value = false;
      return;
    }
    vacantPositionLoading.value = true;
    vacantPositionError.value = "";
    try {
      const positionRows = await fetchUnitPositionsForCurrentFilters({
        baseParams: { q: vacantSearchTerm.value || undefined },
        limit: 500,
        includePositionTypeFilter: true,
        onlyActive: true,
        filters: vacantPositionFilters.value
      });
      if (!positionRows.length) {
        vacantPositionRows.value = [];
        return;
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
      vacantPositionRows.value = positionRows.filter(
        (row) => !assignedPositionIds.has(String(row.id))
      );
      await prefetchFkLabelsForRows(vacantPositionRows.value, ["unit_id", "cargo_id"]);
      await prefetchUnitTypeForUnitPositions(vacantPositionRows.value);
    } catch {
      vacantPositionRows.value = [];
      vacantPositionError.value = "No se pudo cargar los puestos sin ocupaciones.";
    } finally {
      vacantPositionLoading.value = false;
    }
  };

  const loadUnassignedTemplateArtifacts = async () => {
    if (!isProcessDefinitionTemplatesTable.value) {
      unassignedTemplateArtifactRows.value = [];
      unassignedTemplateArtifactError.value = "";
      unassignedTemplateArtifactLoading.value = false;
      return;
    }
    unassignedTemplateArtifactLoading.value = true;
    unassignedTemplateArtifactError.value = "";
    try {
      const artifactParams = {
        q: unassignedTemplateArtifactSearch.value.trim() || undefined,
        limit: 500
      };
      if (
        unassignedTemplateArtifactFilters.value.is_active !== ""
        && unassignedTemplateArtifactFilters.value.is_active !== null
        && unassignedTemplateArtifactFilters.value.is_active !== undefined
      ) {
        artifactParams.filter_is_active = unassignedTemplateArtifactFilters.value.is_active;
      }

      const [artifactResponse, linkedResponse] = await Promise.all([
        axios.get(API_ROUTES.ADMIN_SQL_TABLE("template_artifacts"), {
          params: artifactParams
        }),
        axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
          params: {
            limit: 5000
          }
        })
      ]);

      const linkedArtifactIds = new Set(
        (linkedResponse.data || [])
          .map((row) => row?.template_artifact_id)
          .filter((value) => value !== null && value !== undefined && value !== "")
          .map((value) => String(value))
      );

      unassignedTemplateArtifactRows.value = (artifactResponse.data || []).filter(
        (row) => !linkedArtifactIds.has(String(row.id))
      );
    } catch {
      unassignedTemplateArtifactRows.value = [];
      unassignedTemplateArtifactError.value = "No se pudo cargar los artifacts sin definicion.";
    } finally {
      unassignedTemplateArtifactLoading.value = false;
    }
  };

  const fetchRows = async () => {
    if (!props.table) {
      rows.value = [];
      vacantSearchTerm.value = "";
      vacantPositionRows.value = [];
      vacantPositionError.value = "";
      vacantPositionLoading.value = false;
      unassignedTemplateArtifactSearch.value = "";
      unassignedTemplateArtifactRows.value = [];
      unassignedTemplateArtifactError.value = "";
      unassignedTemplateArtifactLoading.value = false;
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const filters = {};
      if (props.table?.table === "processes") {
        Object.entries(processFilters.value).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            filters[`filter_${key}`] = value;
          }
        });
      }
      if (props.table?.table === "documents") {
        Object.entries(documentFilters.value).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            filters[`filter_${key}`] = value;
          }
        });
      }
      if (props.table?.table === "process_definition_versions") {
        Object.entries(processDefinitionInlineFilters.value).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            filters[`filter_${key}`] = typeof value === "string" ? value.trim() : value;
          }
        });
      }
      if (props.table?.table === "process_target_rules") {
        Object.entries(processTargetRuleInlineFilters.value).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            filters[`filter_${key}`] = typeof value === "string" ? value.trim() : value;
          }
        });
      }
      if (props.table?.table === "template_artifacts") {
        Object.entries(templateArtifactInlineFilters.value).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            filters[`filter_${key}`] = typeof value === "string" ? value.trim() : value;
          }
        });
      }

      const baseParams = {
        q: searchTerm.value || undefined,
        ...filters
      };

      if (isPositionFilterTable.value) {
        const hasPositionScopeFilter = Boolean(
          unitPositionFilters.value.unit_id
          || unitPositionFilters.value.unit_type_id
          || unitPositionFilters.value.cargo_id
        );
        if (isPositionAssignmentsTable.value && hasPositionScopeFilter) {
          const positionRows = await fetchUnitPositionsForCurrentFilters({
            baseParams: {},
            limit: 500
          });
          const positionIds = Array.from(
            new Set(
              positionRows
                .map((row) => row?.id)
                .filter((value) => value !== null && value !== undefined && value !== "")
            )
          );
          if (!positionIds.length) {
            rows.value = [];
          } else {
            const responses = await Promise.all(
              positionIds.map((positionId) =>
                axios.get(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
                  params: {
                    ...baseParams,
                    filter_position_id: positionId,
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
            rows.value = Array.from(mergedRows.values());
          }
        } else if (isUnitPositionsTable.value) {
          rows.value = await fetchUnitPositionsForCurrentFilters({
            baseParams,
            limit: hasPositionScopeFilter ? 200 : 50
          });
        } else {
          const response = await adminSqlService.list(props.table.table, {
            ...baseParams,
            limit: 50
          });
          rows.value = response.data || [];
        }
      } else {
        const response = await adminSqlService.list(props.table.table, {
          ...baseParams,
          limit: 50
        });
        rows.value = response.data || [];
      }

      const fkFields = props.table.fields
        .filter((field) => isForeignKeyField(field))
        .map((field) => field.name);
      await prefetchFkLabelsForRows(rows.value, fkFields);
      await prefetchProcessLabelsForDefinitionRows(rows.value, props.table);
      if (isPositionAssignmentsTable.value) {
        await prefetchPositionMetaForAssignments(rows.value);
        await loadVacantPositions();
      } else {
        vacantPositionRows.value = [];
        vacantPositionError.value = "";
        vacantPositionLoading.value = false;
      }
      if (isProcessDefinitionTemplatesTable.value) {
        await loadUnassignedTemplateArtifacts();
      } else {
        unassignedTemplateArtifactRows.value = [];
        unassignedTemplateArtifactError.value = "";
        unassignedTemplateArtifactLoading.value = false;
      }
      if (isPersonTable.value && personEditorId.value) {
        const selectedPerson = rows.value.find(
          (row) => String(row.id) === String(personEditorId.value)
        );
        if (!selectedPerson) {
          resetPersonAssignments();
        } else {
          personAssignmentContext.value = buildPersonAssignmentContext(selectedPerson);
        }
      }
    } catch (err) {
      error.value = err?.response?.data?.message || "No se pudo cargar la informacion.";
    } finally {
      loading.value = false;
    }
  };

  return {
    fetchUnitPositionsForCurrentFilters,
    loadVacantPositions,
    loadUnassignedTemplateArtifacts,
    fetchRows
  };
}
