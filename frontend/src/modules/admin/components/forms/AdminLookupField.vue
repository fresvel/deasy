<template>
  <div class="relative" :class="groupClass">
    <!-- Sin altura propia: la impone el `deasy-control` de dentro (44 px), y los botones se estiran
         con `items-stretch`. Antes fijaba `h-10` y arrastraba al control a 40. -->
    <div class="flex items-stretch gap-2">
      <input
        ref="inputRef"
        :id="inputId"
        :value="displayValue"
        type="text"
        class="deasy-control min-w-0 flex-1"
        :class="inputClass"
        :placeholder="placeholder"
        :readonly="effectiveReadonly"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :role="suggestEnabled ? 'combobox' : undefined"
        :aria-autocomplete="suggestEnabled ? 'list' : undefined"
        :aria-expanded="suggestEnabled ? String(isOpen) : undefined"
        :aria-controls="suggestEnabled ? listboxId : undefined"
        :aria-activedescendant="suggestEnabled && isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined"
        @focus="handleFocus"
        @blur="handleBlur"
        @input="handleInput"
        @click="handleClick"
        @keydown="handleKeydown"
        @paste="handlePrevent"
      />
      <AdminButton
        v-if="showClear"
        variant="neutral-outline"
        icon-only
        :title="clearTitle"
        :aria-label="clearLabel"
        :disabled="clearDisabled"
        @mousedown="handleButtonMouseDown"
        @click="handleClear"
      >
        <font-awesome-icon icon="times" />
      </AdminButton>
      <AdminButton
        v-if="showSearch"
        variant="neutral-outline"
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

    <div
      v-if="suggestEnabled && isOpen"
      :id="listboxId"
      class="absolute left-0 right-0 top-[calc(100%+4px)] z-(--z-capa-emergente) max-h-64 overflow-auto deasy-card py-1 shadow-lg"
      role="listbox"
    >
      <p v-if="loading" class="px-3 py-2 text-sm text-muted">{{ loadingText }}</p>
      <p v-else-if="error" class="px-3 py-2 text-sm text-danger">{{ error }}</p>
      <ul v-else-if="options.length" class="m-0 list-none p-0">
        <li
          v-for="(option, index) in options"
          :id="optionId(index)"
          :key="option.key ?? index"
          class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-body transition-colors duration-100"
          :class="index === activeIndex ? 'bg-blue-light-50 text-info' : 'hover:bg-surface'"
          role="option"
          :aria-selected="index === activeIndex"
          @mousedown.prevent="selectOption(option)"
          @mouseenter="activeIndex = index"
        >
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <span v-if="option.sublabel" class="shrink-0 text-xs text-muted">{{ option.sublabel }}</span>
        </li>
      </ul>
      <p v-else class="px-3 py-2 text-sm text-muted">{{ noResultsText }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";

const props = defineProps({
  // Id del <input> interno, para que el consumidor pueda enlazar su propio
  // <label for>. Si no se pasa, se genera uno.
  id: {
    type: String,
    default: ""
  },
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
  },
  // Modo combobox (opt-in): función que devuelve recomendaciones para la búsqueda
  // actual. Firma: (query: string) => Promise<Array<{ id?, label, row?, sublabel?, key? }>>.
  // Si es null, el componente se comporta exactamente como el lookup clásico.
  suggestProvider: {
    type: Function,
    default: null
  },
  minChars: {
    type: Number,
    default: 0
  },
  debounceMs: {
    type: Number,
    default: 220
  },
  suggestOpenOnFocus: {
    type: Boolean,
    default: true
  },
  loadingText: {
    type: String,
    default: "Buscando…"
  },
  noResultsText: {
    type: String,
    default: "Sin coincidencias"
  }
});

const emit = defineEmits(["update:modelValue", "focus", "blur", "clear", "search", "select"]);

const generatedId = useId();
const listboxId = `admin-lookup-listbox-${generatedId}`;
const inputId = computed(() => props.id || `admin-lookup-${generatedId}`);
const optionId = (index) => `${listboxId}-opt-${index}`;

const suggestEnabled = computed(() => typeof props.suggestProvider === "function");
const effectiveReadonly = computed(() => (suggestEnabled.value ? false : props.readonly));

const inputRef = ref(null);
const query = ref(props.modelValue || "");
const isOpen = ref(false);
const loading = ref(false);
const error = ref("");
const options = ref([]);
const activeIndex = ref(-1);

const displayValue = computed(() => (suggestEnabled.value ? query.value : props.modelValue));

// Mantener el texto visible sincronizado con el valor seleccionado cuando el
// dropdown no está abierto (evita desincronizar la etiqueta comprometida).
watch(
  () => props.modelValue,
  (next) => {
    if (!isOpen.value) {
      query.value = next || "";
    }
  }
);

let debounceTimer = null;
let requestSeq = 0;

const runProvider = async (rawQuery) => {
  const text = rawQuery || "";
  if (text.length < props.minChars) {
    options.value = [];
    loading.value = false;
    error.value = "";
    activeIndex.value = -1;
    return;
  }
  const seq = (requestSeq += 1);
  loading.value = true;
  error.value = "";
  try {
    const result = await props.suggestProvider(text);
    if (seq !== requestSeq) {
      return;
    }
    options.value = Array.isArray(result) ? result : [];
    activeIndex.value = options.value.length ? 0 : -1;
  } catch (err) {
    if (seq !== requestSeq) {
      return;
    }
    options.value = [];
    activeIndex.value = -1;
    error.value = err?.message || "No se pudo cargar la información.";
  } finally {
    if (seq === requestSeq) {
      loading.value = false;
    }
  }
};

const scheduleLoad = (rawQuery) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => runProvider(rawQuery), props.debounceMs);
};

const openDropdown = () => {
  isOpen.value = true;
};

const closeDropdown = () => {
  isOpen.value = false;
  activeIndex.value = -1;
};

const revertQuery = () => {
  query.value = props.modelValue || "";
};

const handleFocus = (event) => {
  emit("focus", event);
  if (suggestEnabled.value && props.suggestOpenOnFocus) {
    openDropdown();
    runProvider(query.value);
  }
};

const handleClick = () => {
  if (suggestEnabled.value && !isOpen.value) {
    openDropdown();
    runProvider(query.value);
  }
};

const handleBlur = (event) => {
  emit("blur", event);
  if (suggestEnabled.value) {
    closeDropdown();
    revertQuery();
  }
};

const handleInput = (event) => {
  if (suggestEnabled.value) {
    query.value = event.target.value;
    openDropdown();
    scheduleLoad(query.value);
    return;
  }
  emit("update:modelValue", event.target.value);
};

const selectOption = (option) => {
  if (!option) {
    return;
  }
  // Se entrega la opción completa (id / label / row) para que el consumidor
  // persista id + etiqueta sin recomputar nada.
  emit("select", option);
  query.value = option.label ?? "";
  closeDropdown();
};

const handleClear = () => {
  emit("clear");
  if (suggestEnabled.value) {
    query.value = "";
    options.value = [];
    closeDropdown();
  }
};

const handleKeydown = (event) => {
  if (!suggestEnabled.value) {
    handlePrevent(event);
    return;
  }
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (!isOpen.value) {
        openDropdown();
        runProvider(query.value);
      } else if (options.value.length) {
        activeIndex.value = Math.min(activeIndex.value + 1, options.value.length - 1);
      }
      break;
    case "ArrowUp":
      event.preventDefault();
      if (options.value.length) {
        activeIndex.value = Math.max(activeIndex.value - 1, 0);
      }
      break;
    case "Enter":
      if (isOpen.value && activeIndex.value >= 0 && options.value[activeIndex.value]) {
        event.preventDefault();
        selectOption(options.value[activeIndex.value]);
      }
      break;
    case "Escape":
      if (isOpen.value) {
        event.preventDefault();
        closeDropdown();
        revertQuery();
      }
      break;
    default:
      break;
  }
};

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
