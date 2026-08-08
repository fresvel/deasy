<template>
  <div :class="wrapperClasses">
    <div v-if="title" class="deasy-dropzone__header">
      <h3 v-if="variant === 'card'" class="deasy-dropzone__title">{{ title }}</h3>
      <label v-else :for="resolvedInputId" class="deasy-dropzone__label">{{ title }}</label>
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
        @dragover.prevent="handleDragOver"
        @dragleave="handleDragLeave"
        @drop.prevent.stop="handleDrop"
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
import BtnDelete from "@/shared/components/buttons/BtnDelete.vue";

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
  // Señal explícita de "hay archivo" para usos donde el archivo se gestiona en el padre y no se pasa
  // selectedFile (p. ej. el wizard de plantillas). Si no se pasa, se deriva de selectedFile.
  filled: {
    type: Boolean,
    default: false
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
const hasFile = computed(() => props.filled || Boolean(props.selectedFile));

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
    "deasy-dropzone__surface--filled": hasFile.value && !props.disabled,
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

// Lee el File de una entrada del FileSystem API y le adjunta su ruta interna multinivel
// (fullPath: "/carpeta/sub/doc.pdf"), ya que webkitRelativePath no se rellena al arrastrar.
const readEntryFile = (entry) =>
  new Promise((resolve) => {
    entry.file(
      (file) => {
        try {
          file.relativePathOverride = String(entry.fullPath || entry.name).replace(/^\/+/, "");
        } catch {
          // File no extensible en algunos navegadores: se ignora y caera al nombre plano.
        }
        resolve(file);
      },
      () => resolve(null)
    );
  });

// readEntries devuelve los hijos por lotes; hay que invocarlo hasta que llegue un lote vacio.
const readDirectoryEntries = (directoryReader) =>
  new Promise((resolve) => {
    const collected = [];
    const readBatch = () => {
      directoryReader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(collected);
            return;
          }
          collected.push(...batch);
          readBatch();
        },
        () => resolve(collected)
      );
    };
    readBatch();
  });

// Recorre recursivamente una entrada (archivo o carpeta multinivel) y devuelve todos los File.
const collectEntryFiles = async (entry) => {
  if (!entry) return [];
  if (entry.isFile) {
    const file = await readEntryFile(entry);
    return file ? [file] : [];
  }
  if (entry.isDirectory) {
    const children = await readDirectoryEntries(entry.createReader());
    const nested = await Promise.all(children.map(collectEntryFiles));
    return nested.flat();
  }
  return [];
};

const handleDrop = async (event) => {
  event.preventDefault();
  if (props.disabled) return;
  internalActive.value = false;

  // Las entradas del DataTransfer deben capturarse de forma SINCRONA antes de cualquier await,
  // porque el DataTransfer se invalida al terminar el handler.
  const items = event.dataTransfer?.items;
  const entries = items && items.length
    ? Array.from(items)
        .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
        .filter(Boolean)
    : [];

  if (entries.some((entry) => entry.isDirectory)) {
    const nested = await Promise.all(entries.map(collectEntryFiles));
    emitFiles(nested.flat());
    return;
  }

  emitFiles(event.dataTransfer?.files);
};
</script>
