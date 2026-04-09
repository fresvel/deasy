import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

export function useAdminOptionLoaders({
  unitPositionFilters,
  unitPositionFilterLoading,
  unitPositionUnitTypeOptions,
  unitPositionUnitOptions,
  unitPositionCargoOptions,
  vacantPositionFilters,
  vacantPositionFilterLoading,
  vacantPositionUnitTypeOptions,
  vacantPositionUnitOptions,
  vacantPositionCargoOptions,
  processDefinitionProcessOptions,
  processDefinitionSeriesOptions,
  fkPositionFilters,
  fkPositionFilterLoading,
  fkUnitTypeOptions,
  fkUnitOptions,
  fkCargoOptions,
  fkProcessDefinitionProcessOptions,
  isFkUnitPositions,
  isFkUnits
}) {
  const loadUnitPositionUnitTypeOptions = async () => {
    unitPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_types"), {
        params: { limit: 500 }
      });
      unitPositionUnitTypeOptions.value = response.data || [];
    } catch {
      unitPositionUnitTypeOptions.value = [];
    } finally {
      unitPositionFilterLoading.value = false;
    }
  };

  const loadUnitPositionCargoOptions = async () => {
    unitPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("cargos"), {
        params: { limit: 500 }
      });
      unitPositionCargoOptions.value = response.data || [];
    } catch {
      unitPositionCargoOptions.value = [];
    } finally {
      unitPositionFilterLoading.value = false;
    }
  };

  const loadUnitPositionUnitOptions = async () => {
    if (!unitPositionFilters.value.unit_type_id) {
      unitPositionUnitOptions.value = [];
      return;
    }
    unitPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
        params: {
          filter_unit_type_id: unitPositionFilters.value.unit_type_id,
          limit: 500
        }
      });
      unitPositionUnitOptions.value = response.data || [];
      const selectedUnitId = unitPositionFilters.value.unit_id;
      if (
        selectedUnitId
        && !unitPositionUnitOptions.value.some((row) => String(row?.id) === String(selectedUnitId))
      ) {
        unitPositionFilters.value = {
          ...unitPositionFilters.value,
          unit_id: ""
        };
      }
    } catch {
      unitPositionUnitOptions.value = [];
    } finally {
      unitPositionFilterLoading.value = false;
    }
  };

  const loadVacantPositionUnitTypeOptions = async () => {
    vacantPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_types"), {
        params: { limit: 500 }
      });
      vacantPositionUnitTypeOptions.value = response.data || [];
    } catch {
      vacantPositionUnitTypeOptions.value = [];
    } finally {
      vacantPositionFilterLoading.value = false;
    }
  };

  const loadVacantPositionCargoOptions = async () => {
    vacantPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("cargos"), {
        params: { limit: 500 }
      });
      vacantPositionCargoOptions.value = response.data || [];
    } catch {
      vacantPositionCargoOptions.value = [];
    } finally {
      vacantPositionFilterLoading.value = false;
    }
  };

  const loadProcessDefinitionProcessOptions = async () => {
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("processes"), {
        params: {
          orderBy: "name",
          order: "asc",
          limit: 500
        }
      });
      processDefinitionProcessOptions.value = response.data || [];
    } catch {
      processDefinitionProcessOptions.value = [];
    }
  };

  const loadProcessDefinitionSeriesOptions = async () => {
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_series"), {
        params: {
          filter_is_active: 1,
          orderBy: "code",
          order: "asc",
          limit: 500
        }
      });
      processDefinitionSeriesOptions.value = (response.data || []).filter(
        (row) => String(row?.source_type || "") !== "legacy"
      );
    } catch {
      processDefinitionSeriesOptions.value = [];
    }
  };

  const loadVacantPositionUnitOptions = async () => {
    if (!vacantPositionFilters.value.unit_type_id) {
      vacantPositionUnitOptions.value = [];
      return;
    }
    vacantPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
        params: {
          filter_unit_type_id: vacantPositionFilters.value.unit_type_id,
          limit: 500
        }
      });
      vacantPositionUnitOptions.value = response.data || [];
      const selectedUnitId = vacantPositionFilters.value.unit_id;
      if (
        selectedUnitId
        && !vacantPositionUnitOptions.value.some((row) => String(row?.id) === String(selectedUnitId))
      ) {
        vacantPositionFilters.value = {
          ...vacantPositionFilters.value,
          unit_id: ""
        };
      }
    } catch {
      vacantPositionUnitOptions.value = [];
    } finally {
      vacantPositionFilterLoading.value = false;
    }
  };

  const loadFkUnitTypeOptions = async () => {
    if (!isFkUnitPositions.value && !isFkUnits.value) {
      return;
    }
    fkPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_types"), {
        params: { limit: 500 }
      });
      fkUnitTypeOptions.value = response.data || [];
    } catch {
      fkUnitTypeOptions.value = [];
    } finally {
      fkPositionFilterLoading.value = false;
    }
  };

  const loadFkCargoOptions = async () => {
    if (!isFkUnitPositions.value) {
      return;
    }
    fkPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("cargos"), {
        params: { limit: 500 }
      });
      fkCargoOptions.value = response.data || [];
    } catch {
      fkCargoOptions.value = [];
    } finally {
      fkPositionFilterLoading.value = false;
    }
  };

  const loadFkUnitOptions = async () => {
    if (!isFkUnitPositions.value || !fkPositionFilters.value.unit_type_id) {
      fkUnitOptions.value = [];
      return;
    }
    fkPositionFilterLoading.value = true;
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
        params: {
          filter_unit_type_id: fkPositionFilters.value.unit_type_id,
          limit: 500
        }
      });
      fkUnitOptions.value = response.data || [];
      const selectedUnitId = fkPositionFilters.value.unit_id;
      if (
        selectedUnitId
        && !fkUnitOptions.value.some((row) => String(row?.id) === String(selectedUnitId))
      ) {
        fkPositionFilters.value = {
          ...fkPositionFilters.value,
          unit_id: ""
        };
      }
    } catch {
      fkUnitOptions.value = [];
    } finally {
      fkPositionFilterLoading.value = false;
    }
  };

  const loadFkProcessDefinitionProcessOptions = async () => {
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("processes"), {
        params: {
          orderBy: "name",
          order: "asc",
          limit: 500
        }
      });
      fkProcessDefinitionProcessOptions.value = response.data || [];
    } catch {
      fkProcessDefinitionProcessOptions.value = [];
    }
  };

  return {
    loadUnitPositionUnitTypeOptions,
    loadUnitPositionCargoOptions,
    loadUnitPositionUnitOptions,
    loadVacantPositionUnitTypeOptions,
    loadVacantPositionCargoOptions,
    loadProcessDefinitionProcessOptions,
    loadProcessDefinitionSeriesOptions,
    loadVacantPositionUnitOptions,
    loadFkUnitTypeOptions,
    loadFkCargoOptions,
    loadFkUnitOptions,
    loadFkProcessDefinitionProcessOptions
  };
}
