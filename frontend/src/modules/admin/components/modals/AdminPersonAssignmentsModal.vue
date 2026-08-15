<template>
  <AppModalShell ref="modalRef" labelled-by="personAssignmentsModalLabel" title="Asignaciones del usuario" size="xl">
    <div>
      <div v-if="!personEditorId" class="mb-0 rounded-2xl border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-sm text-info">
        Usa el boton de asignaciones en la fila de una persona para empezar.
      </div>
      <template v-else>
        <div class="mb-3">
          <strong>{{ personAssignmentName }}</strong>
          <span class="ml-2 text-success/80">{{ personAssignmentMeta }}</span>
        </div>

        <div v-if="personAssignmentsLoading" class="mb-2 text-sm text-muted">Cargando asignaciones...</div>
        <div v-else class="grid gap-4">
          <div>
            <div>
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
            <h6 class="mb-2 inline-flex items-center gap-2 text-sm font-bold text-strong">
              <font-awesome-icon icon="id-card" />
              <span>Ocupaciones</span>
            </h6>
            <AppAlert v-if="personCargoError">{{ personCargoError }}</AppAlert>
            <div>
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-6">
                  <label :for="fieldId('cargo-position')" class="deasy-form-label deasy-form-label--inline">Puesto</label>
                  <AdminLookupField
                    :id="fieldId('cargo-position')"
                    :model-value="personCargoLabels.position_id"
                    placeholder="Selecciona un puesto"
                    :suggest-provider="cargoPositionSuggestProvider"
                    :clear-disabled="!personCargoForm.position_id"
                    @clear="$emit('clear-person-cargo-position')"
                    @select="$emit('select-person-cargo', 'position_id', $event)"
                    @search="$emit('open-person-cargo-fk-search', 'position_id')"
                  />
                </div>
                <AdminFieldGroup label="Inicio" :label-for="fieldId('cargo-start-date')" group-class="md:col-span-4">
                  <AdminInputField :id="fieldId('cargo-start-date')" :model-value="personCargoForm.start_date" type="date" @update:model-value="updateCargoField('start_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Fin" :label-for="fieldId('cargo-end-date')" group-class="md:col-span-4">
                  <AdminInputField :id="fieldId('cargo-end-date')" :model-value="personCargoForm.end_date" type="date" @update:model-value="updateCargoField('end_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Actual" :label-for="fieldId('cargo-is-current')" group-class="md:col-span-4">
                  <SToggle :id="fieldId('cargo-is-current')" :model-value="Number(personCargoForm.is_current) === 1" label-position="end" @change="(value) => updateCargoField('is_current', value ? '1' : '0')" />
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

            <div class="mt-3">
              <AppDataTable :fields="personCargoTableFields" :rows="personCargoRows" :row-key="rowKey" empty-text="Sin ocupaciones asignadas.">
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
              </AppDataTable>
            </div>
          </div>

          <div v-if="personAssignmentSection === 'roles'">
            <h6 class="mb-2 inline-flex items-center gap-2 text-sm font-bold text-strong">
              <font-awesome-icon icon="lock" />
              <span>Roles</span>
            </h6>
            <AppAlert v-if="personRoleError">{{ personRoleError }}</AppAlert>
            <div>
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-6">
                  <label :for="fieldId('role-role')" class="deasy-form-label deasy-form-label--inline">Rol</label>
                  <AdminLookupField
                    :id="fieldId('role-role')"
                    :model-value="personRoleLabels.role_id"
                    placeholder="Selecciona un rol"
                    :suggest-provider="roleRoleSuggestProvider"
                    :clear-disabled="!personRoleForm.role_id"
                    @clear="$emit('clear-person-role-field', 'role_id')"
                    @select="$emit('select-person-role', 'role_id', $event)"
                    @search="$emit('open-person-role-fk-search', 'role_id')"
                  />
                </div>
                <div class="md:col-span-6">
                  <label :for="fieldId('role-unit')" class="deasy-form-label deasy-form-label--inline">Unidad</label>
                  <AdminLookupField
                    :id="fieldId('role-unit')"
                    :model-value="personRoleLabels.unit_id"
                    placeholder="Selecciona una unidad"
                    :suggest-provider="roleUnitSuggestProvider"
                    :clear-disabled="!personRoleForm.unit_id"
                    @clear="$emit('clear-person-role-field', 'unit_id')"
                    @select="$emit('select-person-role', 'unit_id', $event)"
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

            <div class="mt-3">
              <AppDataTable :fields="personRoleTableFields" :rows="personRoleRows" :row-key="rowKey" empty-text="Sin roles asignados.">
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
              </AppDataTable>
            </div>
          </div>

          <div v-if="personAssignmentSection === 'contratos'">
            <h6 class="mb-2 inline-flex items-center gap-2 text-sm font-bold text-strong">
              <font-awesome-icon icon="check-double" />
              <span>Contratos / Puestos</span>
            </h6>
            <AppAlert v-if="personContractError">{{ personContractError }}</AppAlert>
            <div>
              <div class="grid gap-3 md:grid-cols-12">
                <div class="md:col-span-4">
                  <label :for="fieldId('contract-position')" class="deasy-form-label deasy-form-label--inline">Puesto</label>
                  <AdminLookupField
                    :id="fieldId('contract-position')"
                    :model-value="personContractLabels.position_id"
                    placeholder="Selecciona un puesto"
                    :suggest-provider="contractPositionSuggestProvider"
                    :clear-disabled="!personContractForm.position_id"
                    @clear="$emit('clear-person-contract-position')"
                    @select="$emit('select-person-contract', $event)"
                    @search="$emit('open-person-contract-fk-search')"
                  />
                </div>
                <AdminFieldGroup label="Relacion" :label-for="fieldId('contract-relation-type')" group-class="md:col-span-4">
                  <AdminInputField :id="fieldId('contract-relation-type')" :model-value="personContractForm.relation_type" @update:model-value="updateContractField('relation_type', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Dedicacion" :label-for="fieldId('contract-dedication')" group-class="md:col-span-4">
                  <AdminInputField :id="fieldId('contract-dedication')" :model-value="personContractForm.dedication" @update:model-value="updateContractField('dedication', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Inicio" :label-for="fieldId('contract-start-date')" group-class="md:col-span-4">
                  <AdminInputField :id="fieldId('contract-start-date')" :model-value="personContractForm.start_date" type="date" @update:model-value="updateContractField('start_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Fin" :label-for="fieldId('contract-end-date')" group-class="md:col-span-4">
                  <AdminInputField :id="fieldId('contract-end-date')" :model-value="personContractForm.end_date" type="date" @update:model-value="updateContractField('end_date', $event)" />
                </AdminFieldGroup>
                <AdminFieldGroup label="Estado" :label-for="fieldId('contract-status')" group-class="md:col-span-4">
                  <AdminSelectField :id="fieldId('contract-status')" :model-value="personContractForm.status" @update:model-value="updateContractField('status', $event)">
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

            <div class="mt-3">
              <AppDataTable :fields="personContractTableFields" :rows="personContractRows" :row-key="rowKey" empty-text="Sin contratos asignados.">
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
              </AppDataTable>
            </div>
          </div>
        </div>
      </template>
    </div>
    <template #footer>
      <AdminButton variant="outlineDanger" data-modal-dismiss>Cerrar</AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref, useId } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/modules/admin/components/forms/AdminFormActions.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;

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
  toDateInputValue: { type: Function, required: true },
  cargoPositionSuggestProvider: { type: Function, default: null },
  roleRoleSuggestProvider: { type: Function, default: null },
  roleUnitSuggestProvider: { type: Function, default: null },
  contractPositionSuggestProvider: { type: Function, default: null }
});

const emit = defineEmits([
  "update:person-assignment-section",
  "update:person-cargo-form",
  "update:person-contract-form",
  "clear-person-cargo-position",
  "open-person-cargo-fk-search",
  "select-person-cargo",
  "submit-person-cargo-create",
  "reset-person-cargo-form",
  "view-person-cargo",
  "start-person-cargo-edit",
  "delete-person-cargo",
  "clear-person-role-field",
  "open-person-role-fk-search",
  "select-person-role",
  "submit-person-role-create",
  "reset-person-role-form",
  "view-person-role",
  "start-person-role-edit",
  "delete-person-role",
  "clear-person-contract-position",
  "open-person-contract-fk-search",
  "select-person-contract",
  "submit-person-contract-create",
  "reset-person-contract-form",
  "view-person-contract",
  "start-person-contract-edit",
  "delete-person-contract"
]);

const modalRef = ref(null);

const updateCargoField = (field, value) => emit("update:person-cargo-form", { ...props.personCargoForm, [field]: value });
const updateContractField = (field, value) => emit("update:person-contract-form", { ...props.personContractForm, [field]: value });

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
