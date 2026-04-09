<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="sqlFkFilterModalLabel"
    :title="`Buscar referencia ${fkTable?.label || ''}`"
    size="lg"
    close-action
    @close="$emit('cancel')"
  >
    <div v-if="!fkFilterFields.length" class="text-sm text-slate-500">
      No hay campos disponibles para aplicar filtros.
    </div>
    <form v-else class="grid gap-3 md:grid-cols-12">
      <AdminFieldGroup
        v-for="field in fkFilterFields"
        :key="field.name"
        :label="field.label || field.name"
        group-class="md:col-span-6"
      >
        <AdminInputField
          v-if="isInputField(field)"
          :model-value="fkFilters[field.name]"
          :type="inputType(field)"
          :placeholder="field.placeholder || ''"
          @update:model-value="updateField(field.name, $event)"
        />
        <AdminInputField
          v-else-if="field.type === 'textarea'"
          :model-value="fkFilters[field.name]"
          as="textarea"
          :rows="3"
          @update:model-value="updateField(field.name, $event)"
        />
        <AdminSelectField
          v-else-if="field.type === 'select'"
          :model-value="fkFilters[field.name]"
          @update:model-value="updateField(field.name, $event)"
        >
          <option value="">Todos</option>
          <option v-for="option in field.options || []" :key="option" :value="option">
            {{ formatSelectOptionLabel(field, option) }}
          </option>
        </AdminSelectField>
        <AdminSelectField
          v-else-if="field.type === 'boolean'"
          :model-value="fkFilters[field.name]"
          @update:model-value="updateField(field.name, $event)"
        >
          <option value="">Todos</option>
          <option value="1">Si</option>
          <option value="0">No</option>
        </AdminSelectField>
        <AdminInputField
          v-else
          :model-value="fkFilters[field.name]"
          :placeholder="field.placeholder || ''"
          @update:model-value="updateField(field.name, $event)"
        />
      </AdminFieldGroup>
    </form>
    <template #footer>
      <AdminButton variant="cancel" @click="$emit('cancel')">
        Cancelar
      </AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('clear')">
        Limpiar
      </AdminButton>
      <AdminButton variant="primary" title="Buscar" aria-label="Buscar" @click="$emit('apply')">
        <font-awesome-icon icon="search" />
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
  fkFilterFields: {
    type: Array,
    default: () => []
  },
  fkFilters: {
    type: Object,
    default: () => ({})
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

const emit = defineEmits(["update:fkFilters", "cancel", "clear", "apply"]);
const modalRef = ref(null);

const updateField = (fieldName, value) => {
  emit("update:fkFilters", {
    ...props.fkFilters,
    [fieldName]: value
  });
};

defineExpose({
  el: modalRef
});
</script>
