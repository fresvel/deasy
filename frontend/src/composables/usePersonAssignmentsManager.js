import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";
import { personAssignmentsAdminService } from "@/services/admin/PersonAssignmentsAdminService";

export function usePersonAssignmentsManager({
  personEditorId,
  personAssignmentContext,
  personAssignmentSection,
  personAssignmentsLoading,
  personCargoRows,
  personCargoUnitByPositionId,
  personRoleRows,
  personContractRows,
  personCargoError,
  personRoleError,
  personContractError,
  personCargoEditId,
  personCargoForm,
  personCargoLabels,
  personRoleEditId,
  personRoleEditStartDate,
  personRoleForm,
  personRoleLabels,
  personContractEditId,
  personContractForm,
  personContractLabels,
  fkTable,
  buildPersonAssignmentContext,
  ensurePersonAssignmentsInstance,
  getPersonAssignmentsInstance,
  openFkSearch,
  resolveDisplayField,
  formatCell,
  toDateInputValue,
  prefetchFkLabelsForRows,
  fetchFkLabel,
  getFkCachedLabel
}) {
  const resetPersonCargoForm = () => {
    personCargoEditId.value = "";
    personCargoForm.value = personAssignmentsAdminService.createCargoForm();
    personCargoLabels.value = personAssignmentsAdminService.createCargoLabels();
  };

  const clearPersonCargoPosition = () => {
    personCargoForm.value = {
      ...personCargoForm.value,
      position_id: ""
    };
    personCargoLabels.value = {
      ...personCargoLabels.value,
      position_id: ""
    };
  };

  const resetPersonRoleForm = () => {
    personRoleEditId.value = "";
    personRoleEditStartDate.value = "";
    personRoleForm.value = personAssignmentsAdminService.createRoleForm();
    personRoleLabels.value = personAssignmentsAdminService.createRoleLabels();
  };

  const clearPersonRoleField = (fieldName) => {
    if (!["role_id", "unit_id"].includes(fieldName)) {
      return;
    }
    personRoleForm.value = {
      ...personRoleForm.value,
      [fieldName]: ""
    };
    personRoleLabels.value = {
      ...personRoleLabels.value,
      [fieldName]: ""
    };
  };

  const resetPersonContractForm = () => {
    personContractEditId.value = "";
    personContractForm.value = personAssignmentsAdminService.createContractForm();
    personContractLabels.value = personAssignmentsAdminService.createContractLabels();
  };

  const clearPersonContractPosition = () => {
    personContractForm.value = {
      ...personContractForm.value,
      position_id: ""
    };
    personContractLabels.value = {
      ...personContractLabels.value,
      position_id: ""
    };
  };

  const resetPersonAssignments = () => {
    personAssignmentContext.value = null;
    const state = personAssignmentsAdminService.createAssignmentsState();
    personEditorId.value = state.personEditorId;
    personAssignmentSection.value = state.section;
    personAssignmentsLoading.value = state.loading;
    personCargoRows.value = state.cargoRows;
    personCargoUnitByPositionId.value = state.cargoUnitByPositionId;
    personRoleRows.value = state.roleRows;
    personContractRows.value = state.contractRows;
    personCargoError.value = state.cargoError;
    personRoleError.value = state.roleError;
    personContractError.value = state.contractError;
    personCargoEditId.value = state.cargoEditId;
    personCargoForm.value = state.cargoForm;
    personCargoLabels.value = state.cargoLabels;
    personRoleEditId.value = state.roleEditId;
    personRoleEditStartDate.value = state.roleEditStartDate;
    personRoleForm.value = state.roleForm;
    personRoleLabels.value = state.roleLabels;
    personContractEditId.value = state.contractEditId;
    personContractForm.value = state.contractForm;
    personContractLabels.value = state.contractLabels;
  };

  const prefetchPersonCargoUnitLabels = async (rowsToScan) => {
    if (!rowsToScan?.length) {
      personCargoUnitByPositionId.value = {};
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
      personCargoUnitByPositionId.value = {};
      return;
    }

    const resolved = await Promise.all(
      positionIds.map(async (positionId) => {
        try {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
            params: { filter_id: positionId, limit: 1 }
          });
          const unitId = response.data?.[0]?.unit_id;
          if (unitId !== null && unitId !== undefined && unitId !== "") {
            await fetchFkLabel("units", unitId);
          }
          const unitLabel = unitId ? getFkCachedLabel("units", unitId) : null;
          return {
            positionId: String(positionId),
            label: unitLabel ? String(unitLabel) : "—"
          };
        } catch {
          return {
            positionId: String(positionId),
            label: "—"
          };
        }
      })
    );

    const map = {};
    resolved.forEach(({ positionId, label }) => {
      map[positionId] = label;
    });
    personCargoUnitByPositionId.value = map;
  };

  const formatPersonCargoUnit = (row) => {
    const positionId = row?.position_id;
    if (positionId === null || positionId === undefined || positionId === "") {
      return "—";
    }
    return personCargoUnitByPositionId.value[String(positionId)] || "—";
  };

  const loadPersonAssignments = async (personId) => {
    if (!personId) {
      resetPersonAssignments();
      return;
    }
    personEditorId.value = String(personId);
    personAssignmentsLoading.value = true;
    personCargoError.value = "";
    personRoleError.value = "";
    personContractError.value = "";
    try {
      const assignments = await personAssignmentsAdminService.listAssignments(personId);
      personCargoRows.value = assignments.cargoRows;
      personRoleRows.value = assignments.roleRows;
      personContractRows.value = assignments.contractRows;
      await prefetchFkLabelsForRows(personCargoRows.value, ["position_id"]);
      await prefetchPersonCargoUnitLabels(personCargoRows.value);
      await prefetchFkLabelsForRows(personRoleRows.value, ["role_id", "unit_id"]);
      await prefetchFkLabelsForRows(personContractRows.value, ["position_id"]);
    } catch {
      personCargoError.value = personCargoError.value || "No se pudo cargar ocupaciones.";
      personRoleError.value = personRoleError.value || "No se pudo cargar roles.";
      personContractError.value = personContractError.value || "No se pudo cargar contratos.";
    } finally {
      personAssignmentsLoading.value = false;
    }
  };

  const openPersonAssignments = async (row) => {
    if (!row?.id) {
      return;
    }
    personAssignmentSection.value = "ocupaciones";
    personCargoError.value = "";
    personRoleError.value = "";
    personContractError.value = "";
    resetPersonCargoForm();
    resetPersonRoleForm();
    resetPersonContractForm();
    personAssignmentContext.value = buildPersonAssignmentContext(row);
    ensurePersonAssignmentsInstance();
    getPersonAssignmentsInstance()?.show();
    await loadPersonAssignments(row.id);
  };

  const bindFkLabel = (row) => {
    const displayField = resolveDisplayField(fkTable.value);
    return row[displayField] ?? row.id;
  };

  const openPersonCargoFkSearch = (fieldName) => {
    if (!fieldName) {
      return;
    }
    openFkSearch({ name: fieldName }, (row) => {
      const idValue = row.id ?? "";
      personCargoForm.value = {
        ...personCargoForm.value,
        [fieldName]: idValue ? String(idValue) : ""
      };
      const labelValue = bindFkLabel(row);
      personCargoLabels.value = {
        ...personCargoLabels.value,
        [fieldName]: labelValue ? String(labelValue) : ""
      };
    });
  };

  const openPersonRoleFkSearch = (fieldName) => {
    if (!fieldName) {
      return;
    }
    openFkSearch({ name: fieldName }, (row) => {
      const idValue = row.id ?? "";
      personRoleForm.value = {
        ...personRoleForm.value,
        [fieldName]: idValue ? String(idValue) : ""
      };
      const labelValue = bindFkLabel(row);
      personRoleLabels.value = {
        ...personRoleLabels.value,
        [fieldName]: labelValue ? String(labelValue) : ""
      };
    });
  };

  const openPersonContractFkSearch = () => {
    openFkSearch({ name: "position_id" }, (row) => {
      const idValue = row.id ?? "";
      personContractForm.value = {
        ...personContractForm.value,
        position_id: idValue ? String(idValue) : ""
      };
      const labelValue = bindFkLabel(row);
      personContractLabels.value = {
        position_id: labelValue ? String(labelValue) : ""
      };
    });
  };

  const startPersonCargoEdit = (row) => {
    if (!row) {
      return;
    }
    personCargoError.value = "";
    personCargoEditId.value = row.id ? String(row.id) : "";
    personCargoForm.value = {
      position_id: row.position_id ? String(row.position_id) : "",
      start_date: toDateInputValue(row.start_date),
      end_date: toDateInputValue(row.end_date),
      is_current: Number(row.is_current) === 1 ? "1" : "0"
    };
    const labelValue = formatCell(row.position_id, { name: "position_id" });
    personCargoLabels.value = {
      position_id: labelValue === "—" ? "" : String(labelValue)
    };
  };

  const startPersonRoleEdit = (row) => {
    if (!row) {
      return;
    }
    personRoleError.value = "";
    personRoleEditId.value = row.id ? String(row.id) : "";
    personRoleEditStartDate.value = toDateInputValue(row.start_date) || new Date().toISOString().slice(0, 10);
    personRoleForm.value = {
      role_id: row.role_id ? String(row.role_id) : "",
      unit_id: row.unit_id ? String(row.unit_id) : ""
    };
    const roleLabel = formatCell(row.role_id, { name: "role_id" });
    const unitLabel = formatCell(row.unit_id, { name: "unit_id" });
    personRoleLabels.value = {
      role_id: roleLabel === "—" ? "" : String(roleLabel),
      unit_id: unitLabel === "—" ? "" : String(unitLabel)
    };
  };

  const startPersonContractEdit = (row) => {
    if (!row) {
      return;
    }
    personContractError.value = "";
    personContractEditId.value = row.id ? String(row.id) : "";
    personContractForm.value = {
      position_id: row.position_id ? String(row.position_id) : "",
      relation_type: row.relation_type ? String(row.relation_type) : "",
      dedication: row.dedication ? String(row.dedication) : "",
      start_date: toDateInputValue(row.start_date),
      end_date: toDateInputValue(row.end_date),
      status: row.status ? String(row.status) : "activo"
    };
    const positionLabel = formatCell(row.position_id, { name: "position_id" });
    personContractLabels.value = {
      position_id: positionLabel === "—" ? "" : String(positionLabel)
    };
  };

  const deletePersonCargo = async (row) => {
    if (!personEditorId.value || !row?.id) {
      return;
    }
    if (!window.confirm("¿Eliminar esta ocupacion?")) {
      return;
    }
    personCargoError.value = "";
    try {
      await personAssignmentsAdminService.deleteCargo(row.id);
      await loadPersonAssignments(personEditorId.value);
      if (personCargoEditId.value && String(personCargoEditId.value) === String(row.id)) {
        resetPersonCargoForm();
      }
    } catch (error) {
      personCargoError.value = error?.response?.data?.message || "No se pudo eliminar la ocupacion.";
    }
  };

  const deletePersonRole = async (row) => {
    if (!personEditorId.value || !row?.id) {
      return;
    }
    if (!window.confirm("¿Eliminar este rol?")) {
      return;
    }
    personRoleError.value = "";
    try {
      await personAssignmentsAdminService.deleteRole(row.id);
      await loadPersonAssignments(personEditorId.value);
      if (personRoleEditId.value && String(personRoleEditId.value) === String(row.id)) {
        resetPersonRoleForm();
      }
    } catch (error) {
      personRoleError.value = error?.response?.data?.message || "No se pudo eliminar el rol.";
    }
  };

  const deletePersonContract = async (row) => {
    if (!personEditorId.value || !row?.id) {
      return;
    }
    if (!window.confirm("¿Eliminar este contrato?")) {
      return;
    }
    personContractError.value = "";
    try {
      await personAssignmentsAdminService.deleteContract(row.id);
      await loadPersonAssignments(personEditorId.value);
      if (personContractEditId.value && String(personContractEditId.value) === String(row.id)) {
        resetPersonContractForm();
      }
    } catch (error) {
      personContractError.value = error?.response?.data?.message || "No se pudo eliminar el contrato.";
    }
  };

  const submitPersonCargoCreate = async () => {
    if (!personEditorId.value) {
      personCargoError.value = "Guarda el usuario antes de asignar ocupaciones.";
      return;
    }
    personCargoError.value = "";
    const { payload, error } = personAssignmentsAdminService.buildCargoPayload(
      personEditorId.value,
      personCargoForm.value
    );
    if (error) {
      personCargoError.value = error;
      return;
    }
    try {
      await personAssignmentsAdminService.saveCargo(personCargoEditId.value, payload);
      await loadPersonAssignments(personEditorId.value);
      resetPersonCargoForm();
    } catch (err) {
      personCargoError.value = err?.response?.data?.message || "No se pudo guardar la ocupacion.";
    }
  };

  const submitPersonRoleCreate = async () => {
    if (!personEditorId.value) {
      personRoleError.value = "Guarda el usuario antes de asignar roles.";
      return;
    }
    personRoleError.value = "";
    const { payload, error } = personAssignmentsAdminService.buildRolePayload(
      personEditorId.value,
      personRoleForm.value,
      personRoleEditStartDate.value
    );
    if (error) {
      personRoleError.value = error;
      return;
    }
    try {
      await personAssignmentsAdminService.saveRole(personRoleEditId.value, payload);
      await loadPersonAssignments(personEditorId.value);
      resetPersonRoleForm();
    } catch (err) {
      personRoleError.value = err?.response?.data?.message || "No se pudo guardar el rol.";
    }
  };

  const submitPersonContractCreate = async () => {
    if (!personEditorId.value) {
      personContractError.value = "Guarda el usuario antes de asignar contratos.";
      return;
    }
    personContractError.value = "";
    const { payload, error } = personAssignmentsAdminService.buildContractPayload(
      personEditorId.value,
      personContractForm.value
    );
    if (error) {
      personContractError.value = error;
      return;
    }
    try {
      await personAssignmentsAdminService.saveContract(personContractEditId.value, payload);
      await loadPersonAssignments(personEditorId.value);
      resetPersonContractForm();
    } catch (err) {
      personContractError.value = err?.response?.data?.message || "No se pudo guardar el contrato.";
    }
  };

  return {
    resetPersonCargoForm,
    clearPersonCargoPosition,
    resetPersonRoleForm,
    clearPersonRoleField,
    resetPersonContractForm,
    clearPersonContractPosition,
    resetPersonAssignments,
    prefetchPersonCargoUnitLabels,
    formatPersonCargoUnit,
    loadPersonAssignments,
    openPersonAssignments,
    openPersonCargoFkSearch,
    openPersonRoleFkSearch,
    openPersonContractFkSearch,
    startPersonCargoEdit,
    startPersonRoleEdit,
    startPersonContractEdit,
    deletePersonCargo,
    deletePersonRole,
    deletePersonContract,
    submitPersonCargoCreate,
    submitPersonRoleCreate,
    submitPersonContractCreate
  };
}
