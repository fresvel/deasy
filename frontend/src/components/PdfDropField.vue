<template>
  <div :class="wrapperClasses">
    <div v-if="title" class="deasy-dropzone__header">
      <h3 v-if="variant === 'card'" class="deasy-dropzone__title">{{ title }}</h3>
      <label v-else class="deasy-dropzone__label">{{ title }}</label>
    </div>

    <div
      class="deasy-dropzone__surface"
      :class="surfaceClasses"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <component :is="icon" v-if="icon" :class="iconClasses" />
      <input
        :id="resolvedInputId"
        ref="inputRef"
        type="file"
        class="deasy-dropzone__input"
        :accept="accept"
        :multiple="multiple"
        :disabled="disabled"
        @change="handleInputChange"
      />
      <label :for="resolvedInputId" :class="triggerClasses">
        <span class="deasy-dropzone__action">{{ actionText }}</span>
        <span v-if="helpText" class="deasy-dropzone__help">{{ helpText }}</span>
      </label>
    </div>

    <div v-if="selectedFile" class="deasy-dropzone__selected">
      <span class="deasy-dropzone__file-name">{{ selectedFile.name }}</span>
      <BtnDelete message="Eliminar" @onpress="$emit('clear')" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import BtnDelete from "@/components/BtnDelete.vue";

let inputSequence = 0;

const props = defineProps({
  title: {
    type: String,
    default: ""
  },
  actionText: {
    type: String,
    default: "Seleccionar archivo"
  },
  helpText: {
    type: String,
    default: ""
  },
  accept: {
    type: String,
    default: "application/pdf"
  },
  multiple: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: "card"
  },
  icon: {
    type: [Object, Function],
    default: null
  },
  active: {
    type: Boolean,
    default: false
  },
  selectedFile: {
    type: Object,
    default: null
  },
  inputId: {
    type: String,
    default: ""
  }
});

const emit = defineEmits(["files-selected", "clear"]);

const inputRef = ref(null);
const internalActive = ref(false);
const generatedId = `pdf-drop-field-${inputSequence += 1}`;

const resolvedInputId = computed(() => props.inputId || generatedId);

const isCard = computed(() => props.variant === "card");
const isInline = computed(() => props.variant === "inline");
const isCompact = computed(() => props.variant === "compact");

const wrapperClasses = computed(() => [
  "deasy-dropzone",
  {
    "h-full": isCard.value,
    "opacity-70": props.disabled
  }
]);

const surfaceClasses = computed(() => [
  isCard.value ? "deasy-dropzone__surface--card" : "",
  isCompact.value ? "deasy-dropzone__surface--compact" : "",
  isInline.value ? "deasy-dropzone__surface--inline" : "",
  {
    "deasy-dropzone__surface--active": props.active || internalActive.value,
    "deasy-dropzone__surface--clickable": !props.disabled,
    "deasy-dropzone__surface--disabled": props.disabled
  }
]);

const iconClasses = computed(() => [
  "deasy-dropzone__icon",
  {
    "deasy-dropzone__icon--compact": isCompact.value,
    "deasy-dropzone__icon--inline": isInline.value
  }
]);

const triggerClasses = computed(() => [
  "deasy-dropzone__trigger",
  {
    "deasy-dropzone__trigger--compact": isCompact.value,
    "deasy-dropzone__trigger--inline": isInline.value
  }
]);

const emitFiles = (files) => {
  const normalizedFiles = Array.from(files || []);
  if (!normalizedFiles.length || props.disabled) return;
  emit("files-selected", normalizedFiles);
  if (inputRef.value) {
    inputRef.value.value = "";
  }
};

const handleInputChange = (event) => {
  emitFiles(event.target.files);
};

const handleDragOver = () => {
  if (props.disabled) return;
  internalActive.value = true;
};

const handleDragLeave = () => {
  internalActive.value = false;
};

const handleDrop = (event) => {
  if (props.disabled) return;
  internalActive.value = false;
  emitFiles(event.dataTransfer?.files);
};
</script>
