<template>
  <AdminModalShell ref="modalRef" labelled-by="personAssignmentsModalLabel" title="Asignaciones del usuario" size="xl">
    <div class="person-assignment-panel">
      <div v-if="!personEditorId" class="mb-0 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        Usa el boton de asignaciones en la fila de una persona para empezar.
      </div>
      <template v-else>
        <div class="person-assignment-context mb-3">
          <strong>{{ personAssignmentName }}</strong>
          <span class="ml-2 text-emerald-700/80">{{ personAssignmentMeta }}</span>
        </div>

        <div v-if="personAssignmentsLoading" class="mb-2 text-sm text-slate-500">Cargando asignaciones...</div>
        <div v-else class="grid gap-4">
          <div>
            <div class="person-assignment-menu">
              <AdminButton
                v-for="section in personAssignmentSections"
                :key="section.key"
                variant="menu"
                :class="{ 'is-active': personAssignmentSection === section.key }"
                @click="$emit('update:person-assignment-section', section.key)"
              >
                <font-awesome-icon :icon="section.icon" />
                {{ section.label }}
              </AdminButton>
            </div>
          </div>

          <div v-if="personAssignmentSection === 'ocupaciones'">
            <h6 class="mb-2 inline-flex items-center gap-2 text-sm font-bold text-slate-800">
              <font-awesome-icon icon="id-card" />
              <span>Ocupaciones</span>
            </h6>
            <div v-if="personCargoError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ personCargoError }}</div>
            <div class="person-assignment-form">
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-6">
                  <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Puesto</label>
                  <AdminLookupField
                    :model-value="personCargoLabels.position_id"
                    placeholder="Selecciona un puesto"
                    readonly
                    prevent-input-interaction
                    :clear-disabled="!personCargoForm.position_id"
                    @clear="$emit('clear-person-cargo-position')"
                    @search="$emit('open-person-cargo-fk-search', 'position_id')"
                  />
                </div>
                <AdminFieldGroup label="Inicio" group-class="md:col-span-4">
                  <AdminInputField :model-value="personCargoForm.start_date" type="date" @update:model-value="updateCargoField('start_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Fin" group-class="md:col-span-4">
                  <AdminInputField :model-value="personCargoForm.end_date" type="date" @update:model-value="updateCargoField('end_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Actual" group-class="md:col-span-4">
                  <AdminSelectField :model-value="personCargoForm.is_current" @update:model-value="updateCargoField('is_current', $event)">
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </AdminSelectField>
                </AdminFieldGroup>
              </div>
              <AdminFormActions
                :primary-label="personCargoEditId ? 'Guardar ocupacion' : 'Agregar ocupacion'"
                :show-cancel="Boolean(personCargoEditId)"
                cancel-label="Cancelar edicion"
                @primary="$emit('submit-person-cargo-create')"
                @cancel="$emit('reset-person-cargo-form')"
              />
            </div>

            <div class="mt-3 person-assignment-table">
              <AdminDataTable :fields="personCargoTableFields" :rows="personCargoRows" :row-key="rowKey" empty-text="Sin ocupaciones asignadas.">
                <template #cell="{ row, field }">
                  <template v-if="field.name === 'position_id'">
                    {{ formatCell(row.position_id, { name: "position_id" }) }}
                  </template>
                  <template v-else-if="field.name === 'unit_label'">
                    {{ formatPersonCargoUnit(row) }}
                  </template>
                  <template v-else-if="field.name === 'start_date'">
                    {{ toDateInputValue(row.start_date) }}
                  </template>
                  <template v-else-if="field.name === 'end_date'">
                    {{ toDateInputValue(row.end_date) || "—" }}
                  </template>
                  <template v-else-if="field.name === 'is_current'">
                    {{ Number(row.is_current) === 1 ? "Si" : "No" }}
                  </template>
                  <template v-else>
                    {{ row[field.name] ?? "—" }}
                  </template>
                </template>
                <template #actions="{ row }">
                  <AdminTableActions
                    edit-tooltip="Editar ocupacion"
                    delete-message="Eliminar ocupacion"
                    @view="$emit('view-person-cargo', row)"
                    @edit="$emit('start-person-cargo-edit', row)"
                    @delete="$emit('delete-person-cargo', row)"
                  />
                </template>
              </AdminDataTable>
            </div>
          </div>

          <div v-if="personAssignmentSection === 'roles'">
            <h6 class="mb-2 inline-flex items-center gap-2 text-sm font-bold text-slate-800">
              <font-awesome-icon icon="lock" />
              <span>Roles</span>
            </h6>
            <div v-if="personRoleError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ personRoleError }}</div>
            <div class="person-assignment-form">
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-6">
                  <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Rol</label>
                  <AdminLookupField
                    :model-value="personRoleLabels.role_id"
                    placeholder="Selecciona un rol"
                    readonly
                    prevent-input-interaction
                    :clear-disabled="!personRoleForm.role_id"
                    @clear="$emit('clear-person-role-field', 'role_id')"
                    @search="$emit('open-person-role-fk-search', 'role_id')"
                  />
                </div>
                <div class="md:col-span-6">
                  <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Unidad</label>
                  <AdminLookupField
                    :model-value="personRoleLabels.unit_id"
                    placeholder="Selecciona una unidad"
                    readonly
                    prevent-input-interaction
                    :clear-disabled="!personRoleForm.unit_id"
                    @clear="$emit('clear-person-role-field', 'unit_id')"
                    @search="$emit('open-person-role-fk-search', 'unit_id')"
                  />
                </div>
              </div>
              <AdminFormActions
                :primary-label="personRoleEditId ? 'Guardar rol' : 'Agregar rol'"
                :show-cancel="Boolean(personRoleEditId)"
                cancel-label="Cancelar edicion"
                @primary="$emit('submit-person-role-create')"
                @cancel="$emit('reset-person-role-form')"
              />
            </div>

            <div class="mt-3 person-assignment-table">
              <AdminDataTable :fields="personRoleTableFields" :rows="personRoleRows" :row-key="rowKey" empty-text="Sin roles asignados.">
                <template #cell="{ row, field }">
                  <template v-if="field.name === 'role_id'">
                    {{ formatCell(row.role_id, { name: "role_id" }) }}
                  </template>
                  <template v-else-if="field.name === 'unit_id'">
                    {{ formatCell(row.unit_id, { name: "unit_id" }) }}
                  </template>
                  <template v-else>
                    {{ row[field.name] ?? "—" }}
                  </template>
                </template>
                <template #actions="{ row }">
                  <AdminTableActions
                    edit-tooltip="Editar rol"
                    delete-message="Eliminar rol"
                    @view="$emit('view-person-role', row)"
                    @edit="$emit('start-person-role-edit', row)"
                    @delete="$emit('delete-person-role', row)"
                  />
                </template>
              </AdminDataTable>
            </div>
          </div>

          <div v-if="personAssignmentSection === 'contratos'">
            <h6 class="mb-2 inline-flex items-center gap-2 text-sm font-bold text-slate-800">
              <font-awesome-icon icon="check-double" />
              <span>Contratos / Puestos</span>
            </h6>
            <div v-if="personContractError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ personContractError }}</div>
            <div class="person-assignment-form">
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-4">
                  <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Puesto</label>
                  <AdminLookupField
                    :model-value="personContractLabels.position_id"
                    placeholder="Selecciona un puesto"
                    readonly
                    prevent-input-interaction
                    :clear-disabled="!personContractForm.position_id"
                    @clear="$emit('clear-person-contract-position')"
                    @search="$emit('open-person-contract-fk-search')"
                  />
                </div>
                <AdminFieldGroup label="Relacion" group-class="md:col-span-4">
                  <AdminInputField :model-value="personContractForm.relation_type" @update:model-value="updateContractField('relation_type', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Dedicacion" group-class="md:col-span-4">
                  <AdminInputField :model-value="personContractForm.dedication" @update:model-value="updateContractField('dedication', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Inicio" group-class="md:col-span-4">
                  <AdminInputField :model-value="personContractForm.start_date" type="date" @update:model-value="updateContractField('start_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Fin" group-class="md:col-span-4">
                  <AdminInputField :model-value="personContractForm.end_date" type="date" @update:model-value="updateContractField('end_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Estado" group-class="md:col-span-4">
                  <AdminSelectField :model-value="personContractForm.status" @update:model-value="updateContractField('status', $event)">
                    <option value="activo">activo</option>
                    <option value="finalizado">finalizado</option>
                    <option value="cancelado">cancelado</option>
                  </AdminSelectField>
                </AdminFieldGroup>
              </div>
              <AdminFormActions
                :primary-label="personContractEditId ? 'Guardar contrato' : 'Agregar contrato'"
                :show-cancel="Boolean(personContractEditId)"
                cancel-label="Cancelar edicion"
                @primary="$emit('submit-person-contract-create')"
                @cancel="$emit('reset-person-contract-form')"
              />
            </div>

            <div class="mt-3 person-assignment-table">
              <AdminDataTable :fields="personContractTableFields" :rows="personContractRows" :row-key="rowKey" empty-text="Sin contratos asignados.">
                <template #cell="{ row, field }">
                  <template v-if="field.name === 'position_id'">
                    {{ formatCell(row.position_id, { name: "position_id" }) }}
                  </template>
                  <template v-else-if="field.name === 'start_date'">
                    {{ toDateInputValue(row.start_date) }}
                  </template>
                  <template v-else-if="field.name === 'end_date'">
                    {{ toDateInputValue(row.end_date) || "—" }}
                  </template>
                  <template v-else>
                    {{ row[field.name] ?? "—" }}
                  </template>
                </template>
                <template #actions="{ row }">
                  <AdminTableActions
                    edit-tooltip="Editar contrato"
                    delete-message="Eliminar contrato"
                    @view="$emit('view-person-contract', row)"
                    @edit="$emit('start-person-contract-edit', row)"
                    @delete="$emit('delete-person-contract', row)"
                  />
                </template>
              </AdminDataTable>
            </div>
          </div>
        </div>
      </template>
    </div>
    <template #footer>
      <AdminButton variant="outlineDanger" data-modal-dismiss>Cerrar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/components/AppButton.vue";
import AdminDataTable from "@/components/AppDataTable.vue";
import AdminFieldGroup from "@/views/admin/components/AdminFieldGroup.vue";
import AdminFormActions from "@/views/admin/components/AdminFormActions.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminLookupField from "@/views/admin/components/AdminLookupField.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";
import AdminTableActions from "@/views/admin/components/AdminTableActions.vue";

const props = defineProps({
  personEditorId: { type: [String, Number], default: "" },
  personAssignmentName: { type: String, default: "" },
  personAssignmentMeta: { type: String, default: "" },
  personAssignmentsLoading: { type: Boolean, default: false },
  personAssignmentSections: { type: Array, default: () => [] },
  personAssignmentSection: { type: String, default: "" },
  personCargoError: { type: String, default: "" },
  personCargoLabels: { type: Object, default: () => ({}) },
  personCargoForm: { type: Object, default: () => ({}) },
  personCargoEditId: { type: [String, Number], default: "" },
  personCargoTableFields: { type: Array, default: () => [] },
  personCargoRows: { type: Array, default: () => [] },
  personRoleError: { type: String, default: "" },
  personRoleLabels: { type: Object, default: () => ({}) },
  personRoleForm: { type: Object, default: () => ({}) },
  personRoleEditId: { type: [String, Number], default: "" },
  personRoleTableFields: { type: Array, default: () => [] },
  personRoleRows: { type: Array, default: () => [] },
  personContractError: { type: String, default: "" },
  personContractLabels: { type: Object, default: () => ({}) },
  personContractForm: { type: Object, default: () => ({}) },
  personContractEditId: { type: [String, Number], default: "" },
  personContractTableFields: { type: Array, default: () => [] },
  personContractRows: { type: Array, default: () => [] },
  rowKey: { type: Function, required: true },
  formatCell: { type: Function, required: true },
  formatPersonCargoUnit: { type: Function, required: true },
  toDateInputValue: { type: Function, required: true }
});

const emit = defineEmits([
  "update:person-assignment-section",
  "update:person-cargo-form",
  "update:person-contract-form",
  "clear-person-cargo-position",
  "open-person-cargo-fk-search",
  "submit-person-cargo-create",
  "reset-person-cargo-form",
  "view-person-cargo",
  "start-person-cargo-edit",
  "delete-person-cargo",
  "clear-person-role-field",
  "open-person-role-fk-search",
  "submit-person-role-create",
  "reset-person-role-form",
  "view-person-role",
  "start-person-role-edit",
  "delete-person-role",
  "clear-person-contract-position",
  "open-person-contract-fk-search",
  "submit-person-contract-create",
  "reset-person-contract-form",
  "view-person-contract",
  "start-person-contract-edit",
  "delete-person-contract"
]);

const modalRef = ref(null);

const updateCargoField = (field, value) => emit("update:person-cargo-form", { ...props.personCargoForm, [field]: value });
const updateContractField = (field, value) => emit("update:person-contract-form", { ...props.personContractForm, [field]: value });

defineExpose({ el: modalRef });
</script>
