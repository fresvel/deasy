import { adminSqlService } from "@/services/admin/AdminSqlService";

export class PersonAssignmentsAdminService {
  constructor(sqlService = adminSqlService) {
    this.sqlService = sqlService;
  }

  createCargoForm() {
    return {
      position_id: "",
      start_date: "",
      end_date: "",
      is_current: "1"
    };
  }

  createRoleForm() {
    return {
      role_id: "",
      unit_id: ""
    };
  }

  createContractForm() {
    return {
      position_id: "",
      relation_type: "",
      dedication: "",
      start_date: "",
      end_date: "",
      status: "activo"
    };
  }

  createCargoLabels() {
    return { position_id: "" };
  }

  createRoleLabels() {
    return {
      role_id: "",
      unit_id: ""
    };
  }

  createContractLabels() {
    return { position_id: "" };
  }

  createAssignmentsState() {
    return {
      personEditorId: "",
      section: "ocupaciones",
      loading: false,
      cargoRows: [],
      cargoUnitByPositionId: {},
      roleRows: [],
      contractRows: [],
      cargoError: "",
      roleError: "",
      contractError: "",
      cargoForm: this.createCargoForm(),
      cargoLabels: this.createCargoLabels(),
      cargoEditId: "",
      roleForm: this.createRoleForm(),
      roleLabels: this.createRoleLabels(),
      roleEditId: "",
      roleEditStartDate: "",
      contractForm: this.createContractForm(),
      contractLabels: this.createContractLabels(),
      contractEditId: ""
    };
  }

  async listAssignments(personId) {
    const [cargoRes, roleRes, contractRes] = await Promise.all([
      this.sqlService.list("position_assignments", {
        filter_person_id: personId,
        orderBy: "start_date",
        order: "desc",
        limit: 200
      }),
      this.sqlService.list("role_assignments", {
        filter_person_id: personId,
        orderBy: "assigned_at",
        order: "desc",
        limit: 200
      }),
      this.sqlService.list("contracts", {
        filter_person_id: personId,
        orderBy: "start_date",
        order: "desc",
        limit: 200
      })
    ]);

    return {
      cargoRows: cargoRes.data || [],
      roleRows: roleRes.data || [],
      contractRows: contractRes.data || []
    };
  }

  buildCargoPayload(personId, form) {
    const payload = {
      person_id: Number(personId),
      position_id: form.position_id ? Number(form.position_id) : null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      is_current: Number(form.is_current) === 1 ? 1 : 0
    };

    if (!payload.position_id) {
      return { error: "Selecciona un puesto." };
    }
    if (!payload.start_date) {
      return { error: "Selecciona la fecha de inicio." };
    }

    return { payload };
  }

  buildRolePayload(personId, form, editStartDate = "") {
    const payload = {
      person_id: Number(personId),
      role_id: form.role_id ? Number(form.role_id) : null,
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      start_date: editStartDate || new Date().toISOString().slice(0, 10)
    };

    if (!payload.role_id) {
      return { error: "Selecciona un rol." };
    }
    if (!payload.unit_id) {
      return { error: "Selecciona una unidad." };
    }

    return { payload };
  }

  buildContractPayload(personId, form) {
    const payload = {
      person_id: Number(personId),
      position_id: form.position_id ? Number(form.position_id) : null,
      relation_type: form.relation_type?.trim(),
      dedication: form.dedication?.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      status: form.status || "activo"
    };

    if (!payload.position_id) {
      return { error: "Selecciona un puesto." };
    }
    if (!payload.relation_type || !payload.dedication || !payload.start_date) {
      return { error: "Completa relacion, dedicacion y fecha de inicio." };
    }

    return { payload };
  }

  saveCargo(editId, payload) {
    if (editId) {
      return this.sqlService.update("position_assignments", { id: Number(editId) }, payload);
    }
    return this.sqlService.create("position_assignments", payload);
  }

  saveRole(editId, payload) {
    if (editId) {
      return this.sqlService.update("role_assignments", { id: Number(editId) }, payload);
    }
    return this.sqlService.create("role_assignments", payload);
  }

  saveContract(editId, payload) {
    if (editId) {
      return this.sqlService.update("contracts", { id: Number(editId) }, payload);
    }
    return this.sqlService.create("contracts", payload);
  }

  deleteCargo(id) {
    return this.sqlService.remove("position_assignments", { id: Number(id) });
  }

  deleteRole(id) {
    return this.sqlService.remove("role_assignments", { id: Number(id) });
  }

  deleteContract(id) {
    return this.sqlService.remove("contracts", { id: Number(id) });
  }
}

export const personAssignmentsAdminService = new PersonAssignmentsAdminService();
