import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

export function useAdminFkLabels({
  fkLabelCache,
  allTablesMap,
  processIdByDefinitionId,
  processDefinitionMetaById,
  unitTypeByUnitId,
  positionMetaById,
  resolveFkTable,
  resolveDisplayField
}) {
  const setFkLabel = (tableName, id, label) => {
    if (!tableName || id === null || id === undefined || id === "") {
      return;
    }
    if (!fkLabelCache.value[tableName]) {
      fkLabelCache.value[tableName] = {};
    }
    fkLabelCache.value[tableName][id] = label;
  };

  const fetchFkLabel = async (tableName, id) => {
    if (!tableName || id === null || id === undefined || id === "") {
      return;
    }
    if (fkLabelCache.value[tableName]?.[id] !== undefined) {
      return;
    }
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(tableName), {
        params: { filter_id: id, limit: 1 }
      });
      const row = response.data?.[0];
      if (row && tableName === "persons") {
        const lastName = row.last_name ? String(row.last_name).trim() : "";
        const firstName = row.first_name ? String(row.first_name).trim() : "";
        const fullName = `${lastName} ${firstName}`.trim();
        const label = fullName || String(row.email ?? row.id ?? id);
        setFkLabel(tableName, id, label);
        return;
      }
      const displayField = resolveDisplayField(allTablesMap.value?.[tableName]);
      const label = row ? String(row[displayField] ?? row.id ?? id) : String(id);
      setFkLabel(tableName, id, label);
    } catch {
      setFkLabel(tableName, id, String(id));
    }
  };

  const prefetchFkLabelsForRows = async (rowsToScan, fieldNames) => {
    if (!rowsToScan?.length || !fieldNames?.length) {
      return;
    }
    const tasks = [];
    fieldNames.forEach((fieldName) => {
      const tableName = resolveFkTable(fieldName);
      if (!tableName) {
        return;
      }
      const ids = Array.from(
        new Set(
          rowsToScan
            .map((row) => row?.[fieldName])
            .filter((value) => value !== null && value !== undefined && value !== "")
        )
      );
      ids.forEach((id) => tasks.push(fetchFkLabel(tableName, id)));
    });
    await Promise.all(tasks);
  };

  const prefetchProcessLabelsForDefinitionRows = async (rowsToScan, tableMeta = null) => {
    const effectiveTable = tableMeta;
    if (!rowsToScan?.length || effectiveTable?.table !== "process_target_rules") {
      return;
    }

    const definitionIds = Array.from(
      new Set(
        rowsToScan
          .map((row) => row?.process_definition_id)
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    );

    const missingDefinitionIds = definitionIds.filter(
      (definitionId) => processIdByDefinitionId.value[String(definitionId)] === undefined
    );

    if (!missingDefinitionIds.length) {
      return;
    }

    const resolved = await Promise.all(
      missingDefinitionIds.map(async (definitionId) => {
        try {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_versions"), {
            params: { filter_id: definitionId, limit: 1 }
          });
          const definitionRow = response.data?.[0];
          const processId = definitionRow?.process_id;
          if (processId !== null && processId !== undefined && processId !== "") {
            await fetchFkLabel("processes", processId);
          }
          return {
            definitionId: String(definitionId),
            processId: processId ?? null
          };
        } catch {
          return {
            definitionId: String(definitionId),
            processId: null
          };
        }
      })
    );

    const nextMap = { ...processIdByDefinitionId.value };
    resolved.forEach(({ definitionId, processId }) => {
      nextMap[definitionId] = processId;
    });
    processIdByDefinitionId.value = nextMap;
  };

  const prefetchProcessDefinitionMeta = async (rowsToScan, tableMeta = null) => {
    if (!rowsToScan?.length) {
      return;
    }
    if (
      tableMeta?.table !== "process_definition_templates"
      && !rowsToScan.some((row) => row?.process_definition_id !== null && row?.process_definition_id !== undefined && row?.process_definition_id !== "")
    ) {
      return;
    }

    const definitionIds = Array.from(
      new Set(
        rowsToScan
          .map((row) => row?.process_definition_id)
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    );

    if (!definitionIds.length) {
      return;
    }

    const missingDefinitionIds = definitionIds.filter(
      (definitionId) => processDefinitionMetaById.value[String(definitionId)] === undefined
    );

    if (!missingDefinitionIds.length) {
      return;
    }

    const resolved = await Promise.all(
      missingDefinitionIds.map(async (definitionId) => {
        try {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_versions"), {
            params: {
              filter_id: definitionId,
              limit: 1
            }
          });
          return {
            definitionId: String(definitionId),
            row: response.data?.[0] || null
          };
        } catch {
          return {
            definitionId: String(definitionId),
            row: null
          };
        }
      })
    );

    const nextMap = { ...processDefinitionMetaById.value };
    resolved.forEach(({ definitionId, row }) => {
      nextMap[definitionId] = row;
    });
    processDefinitionMetaById.value = nextMap;
  };

  const prefetchUnitTypeForUnitPositions = async (rowsToScan) => {
    if (!rowsToScan?.length) {
      return;
    }
    const unitIds = Array.from(
      new Set(
        rowsToScan
          .map((row) => row?.unit_id)
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    );
    if (!unitIds.length) {
      return;
    }

    const missingUnitIds = unitIds.filter(
      (unitId) => unitTypeByUnitId.value[String(unitId)] === undefined
    );

    if (missingUnitIds.length) {
      const resolved = await Promise.all(
        missingUnitIds.map(async (unitId) => {
          try {
            const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
              params: { filter_id: unitId, limit: 1 }
            });
            return {
              unitId: String(unitId),
              unitTypeId: response.data?.[0]?.unit_type_id ?? null
            };
          } catch {
            return {
              unitId: String(unitId),
              unitTypeId: null
            };
          }
        })
      );
      const nextMap = { ...unitTypeByUnitId.value };
      resolved.forEach(({ unitId, unitTypeId }) => {
        nextMap[unitId] = unitTypeId;
      });
      unitTypeByUnitId.value = nextMap;
    }

    const unitTypeIds = Array.from(
      new Set(
        unitIds
          .map((unitId) => unitTypeByUnitId.value[String(unitId)])
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    );
    await Promise.all(unitTypeIds.map((unitTypeId) => fetchFkLabel("unit_types", unitTypeId)));
  };

  const prefetchPositionMetaForAssignments = async (rowsToScan) => {
    if (!rowsToScan?.length) {
      return;
    }
    const positionIds = Array.from(
      new Set(
        rowsToScan
          .map((row) => row?.position_id)
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    );
    if (!positionIds.length) {
      return;
    }
    const missingPositionIds = positionIds.filter(
      (positionId) => positionMetaById.value[String(positionId)] === undefined
    );
    if (!missingPositionIds.length) {
      return;
    }
    const resolved = await Promise.all(
      missingPositionIds.map(async (positionId) => {
        try {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
            params: { filter_id: positionId, limit: 1 }
          });
          const row = response.data?.[0] || null;
          return {
            positionId: String(positionId),
            row
          };
        } catch {
          return {
            positionId: String(positionId),
            row: null
          };
        }
      })
    );
    const nextMap = { ...positionMetaById.value };
    resolved.forEach(({ positionId, row }) => {
      nextMap[positionId] = row;
    });
    positionMetaById.value = nextMap;
  };

  const getFkCachedLabel = (tableName, value) => {
    if (!tableName || value === null || value === undefined || value === "") {
      return null;
    }
    const cache = fkLabelCache.value[tableName];
    if (!cache) {
      return null;
    }
    const key = String(value);
    if (cache[key] !== undefined) {
      return cache[key];
    }
    return null;
  };

  return {
    setFkLabel,
    fetchFkLabel,
    prefetchFkLabelsForRows,
    prefetchProcessLabelsForDefinitionRows,
    prefetchProcessDefinitionMeta,
    prefetchUnitTypeForUnitPositions,
    prefetchPositionMetaForAssignments,
    getFkCachedLabel
  };
}
