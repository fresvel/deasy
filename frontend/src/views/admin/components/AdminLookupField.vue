<template>
  <div class="input-group" :class="groupClass">
    <input
      :value="modelValue"
      type="text"
      class="form-control"
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
import AdminButton from "@/views/admin/components/AdminButton.vue";

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
