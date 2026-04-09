<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="sqlFkCreateModalLabel"
    :title="`Crear referencia ${fkTable?.label || ''}`"
    size="lg"
    close-action
    @close="$emit('cancel')"
  >
    <div v-if="fkCreateError" class="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ fkCreateError }}
    </div>
    <div v-if="!fkCreateFields.length" class="text-sm text-slate-500">
      No hay campos editables disponibles para crear esta referencia.
    </div>
    <form v-else class="grid gap-3 md:grid-cols-12">
      <AdminFieldGroup
        v-for="field in fkCreateFields"
        :key="field.name"
        :label="field.label || field.name"
        :required="Boolean(field.required)"
        group-class="md:col-span-6"
      >
        <AdminInputField
          v-if="isInputField(field)"
          :model-value="fkCreateForm[field.name]"
          :type="inputType(field)"
          :placeholder="field.placeholder || ''"
          @update:model-value="updateField(field.name, $event)"
        />
        <AdminInputField
          v-else-if="field.type === 'textarea'"
          :model-value="fkCreateForm[field.name]"
          as="textarea"
          :rows="3"
          @update:model-value="updateField(field.name, $event)"
        />
        <AdminSelectField
          v-else-if="field.type === 'select'"
          :model-value="fkCreateForm[field.name]"
          @update:model-value="updateField(field.name, $event)"
        >
          <option value="">Seleccionar</option>
          <option v-for="option in field.options || []" :key="option" :value="option">
            {{ formatSelectOptionLabel(field, option) }}
          </option>
        </AdminSelectField>
        <AdminSelectField
          v-else-if="field.type === 'boolean'"
          :model-value="fkCreateForm[field.name]"
          @update:model-value="updateField(field.name, $event)"
        >
          <option value="1">Si</option>
          <option value="0">No</option>
        </AdminSelectField>
        <AdminInputField
          v-else
          :model-value="fkCreateForm[field.name]"
          :placeholder="field.placeholder || ''"
          @update:model-value="updateField(field.name, $event)"
        />
      </AdminFieldGroup>
    </form>
    <template #footer>
      <AdminButton
        variant="cancel"
        :disabled="fkCreateLoading"
        @click="$emit('cancel')"
      >
        Cancelar
      </AdminButton>
      <AdminButton
        variant="primary"
        :disabled="!canCreateFkReference || fkCreateLoading"
        @click="$emit('submit')"
      >
        {{ fkCreateLoading ? "Guardando..." : "Guardar y seleccionar" }}
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/ui/AppButton.vue";
import AdminFieldGroup from "@/modules/admin/components/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/AdminInputField.vue";
import AdminModalShell from "@/shared/components/ui/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/AdminSelectField.vue";

const props = defineProps({
  fkTable: {
    type: Object,
    default: null
  },
  fkCreateError: {
    type: String,
    default: ""
  },
  fkCreateFields: {
    type: Array,
    default: () => []
  },
  fkCreateForm: {
    type: Object,
    default: () => ({})
  },
  fkCreateLoading: {
    type: Boolean,
    default: false
  },
  canCreateFkReference: {
    type: Boolean,
    default: false
  },
  isInputField: {
    type: Function,
    required: true
  },
  inputType: {
    type: Function,
    required: true
  },
  formatSelectOptionLabel: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(["update:fkCreateForm", "cancel", "submit"]);
const modalRef = ref(null);

const updateField = (fieldName, value) => {
  emit("update:fkCreateForm", {
    ...props.fkCreateForm,
    [fieldName]: value
  });
};

defineExpose({
  el: modalRef
});
</script>
