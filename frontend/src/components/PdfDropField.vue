<template>
  <div :class="wrapperClasses">
    <div v-if="title" class="pdf-drop-field__header">
      <h3 v-if="variant === 'card'" class="pdf-drop-field__title">{{ title }}</h3>
      <label v-else class="pdf-drop-field__label">{{ title }}</label>
    </div>

    <div
      class="pdf-drop-field__surface"
      :class="surfaceClasses"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <component :is="icon" v-if="icon" class="pdf-drop-field__icon" />
      <input
        :id="resolvedInputId"
        ref="inputRef"
        type="file"
        class="pdf-drop-field__input"
        :accept="accept"
        :multiple="multiple"
        :disabled="disabled"
        @change="handleInputChange"
      />
      <label :for="resolvedInputId" class="pdf-drop-field__trigger">
        <span class="pdf-drop-field__action">{{ actionText }}</span>
        <span v-if="helpText" class="pdf-drop-field__help">{{ helpText }}</span>
      </label>
    </div>

    <div v-if="selectedFile" class="pdf-drop-field__selected">
      <span class="pdf-drop-field__file-name">{{ selectedFile.name }}</span>
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
  "pdf-drop-field",
  {
    "pdf-drop-field--card": isCard.value,
    "pdf-drop-field--compact": isCompact.value,
    "pdf-drop-field--inline": isInline.value,
    "pdf-drop-field--disabled": props.disabled
  }
]);

const surfaceClasses = computed(() => [
  {
    "pdf-drop-field__surface--active": props.active || internalActive.value,
    "pdf-drop-field__surface--clickable": !props.disabled
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

<style scoped>
.pdf-drop-field {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pdf-drop-field--card {
  height: 100%;
}

.pdf-drop-field__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pdf-drop-field__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.pdf-drop-field__label {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.pdf-drop-field__surface {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed #cbd5e1;
  border-radius: 1rem;
  background: #fff;
  padding: 1.25rem;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.pdf-drop-field--compact .pdf-drop-field__surface,
.pdf-drop-field--inline .pdf-drop-field__surface {
  min-height: auto;
  padding: 0.875rem 1rem;
}

.pdf-drop-field__surface--clickable {
  cursor: pointer;
}

.pdf-drop-field__surface--active {
  border-color: #0ea5e9;
  background: rgba(14, 165, 233, 0.08);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.pdf-drop-field__icon {
  width: 2rem;
  height: 2rem;
  color: #0369a1;
  flex-shrink: 0;
}

.pdf-drop-field--inline .pdf-drop-field__icon,
.pdf-drop-field--compact .pdf-drop-field__icon {
  width: 1.25rem;
  height: 1.25rem;
}

.pdf-drop-field__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.pdf-drop-field__trigger {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  text-align: center;
  margin: 0;
  pointer-events: none;
}

.pdf-drop-field--inline .pdf-drop-field__trigger,
.pdf-drop-field--compact .pdf-drop-field__trigger {
  align-items: flex-start;
  text-align: left;
}

.pdf-drop-field__action {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.pdf-drop-field__help {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.35;
}

.pdf-drop-field__selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid #dbeafe;
  background: #f8fbff;
  border-radius: 0.9rem;
  padding: 0.65rem 0.85rem;
}

.pdf-drop-field__file-name {
  font-size: 0.875rem;
  color: #0f172a;
  font-weight: 600;
  word-break: break-word;
}

.pdf-drop-field--disabled {
  opacity: 0.7;
}

.pdf-drop-field--disabled .pdf-drop-field__surface {
  cursor: not-allowed;
  background: #f1f5f9;
}
</style>
