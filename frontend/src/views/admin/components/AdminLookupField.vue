<template>
  <div class="admin-lookup-field flex items-stretch gap-2" :class="groupClass">
    <input
      :value="modelValue"
      type="text"
      class="admin-input-field min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm transition-colors duration-150 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      :class="inputClass"
      :placeholder="placeholder"
      :readonly="readonly"
      :disabled="disabled"
      :autocomplete="autocomplete"
      @focus="$emit('focus', $event)"
      @blur="$emit('blur', $event)"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown="handlePrevent"
      @paste="handlePrevent"
    />
    <AdminButton
      v-if="showClear"
      variant="secondary"
      icon-only
      :title="clearTitle"
      :aria-label="clearLabel"
      :disabled="clearDisabled"
      @mousedown="handleButtonMouseDown"
      @click="$emit('clear')"
    >
      <font-awesome-icon icon="times" />
    </AdminButton>
    <AdminButton
      v-if="showSearch"
      variant="secondary"
      icon-only
      :title="searchTitle"
      :aria-label="searchLabel"
      :disabled="searchDisabled"
      @mousedown="handleButtonMouseDown"
      @click="$emit('search')"
    >
      <font-awesome-icon icon="search" />
    </AdminButton>
  </div>
</template>

<script setup>
import AdminButton from "@/components/AppButton.vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: ""
  },
  placeholder: {
    type: String,
    default: ""
  },
  readonly: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  autocomplete: {
    type: String,
    default: "off"
  },
  inputClass: {
    type: [String, Array, Object],
    default: ""
  },
  groupClass: {
    type: [String, Array, Object],
    default: ""
  },
  showClear: {
    type: Boolean,
    default: true
  },
  showSearch: {
    type: Boolean,
    default: true
  },
  clearDisabled: {
    type: Boolean,
    default: false
  },
  searchDisabled: {
    type: Boolean,
    default: false
  },
  clearTitle: {
    type: String,
    default: "Limpiar"
  },
  clearLabel: {
    type: String,
    default: "Limpiar"
  },
  searchTitle: {
    type: String,
    default: "Buscar"
  },
  searchLabel: {
    type: String,
    default: "Buscar"
  },
  preventInputInteraction: {
    type: Boolean,
    default: false
  },
  preventButtonMouseDown: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update:modelValue", "focus", "blur", "clear", "search"]);

const handlePrevent = (event) => {
  if (props.preventInputInteraction) {
    event.preventDefault();
  }
};

const handleButtonMouseDown = (event) => {
  if (props.preventButtonMouseDown) {
    event.preventDefault();
  }
};
</script>
