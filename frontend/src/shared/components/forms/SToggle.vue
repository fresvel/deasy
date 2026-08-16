<template>
  <div :class="rootClass">
    <!-- ⚠️ `<label>` SOLO SI HAY TEXTO QUE ETIQUETAR. Sin el, esto emitia un segundo
         `<label for="mismo-id">` vacio en todos los formularios donde el grupo de campo YA pone su
         etiqueta encima — trece campos del modal de personas, medidos con dos `label[for]` cada
         uno. Un `<span>` mantiene el clic (el input vive dentro) y deja un solo `<label>`. -->
    <component
      :is="tieneEtiqueta ? 'label' : 'span'"
      :for="tieneEtiqueta ? toggleId : undefined"
      class="items-center gap-3"
      :class="[
        labelPosition === 'end' ? 'inline-flex flex-row-reverse' : 'flex justify-between',
        fieldAligned ? 'h-10' : ''
      ]"
    >
      <span v-if="$slots.default || label || description" class="min-w-0">
        <slot>
          <span class="block text-sm font-semibold text-body select-none">{{ label }}</span>
          <span v-if="description" class="mt-0.5 block text-xs font-medium text-muted">{{ description }}</span>
        </slot>
      </span>

      <span class="relative inline-block w-11 h-6 shrink-0" :class="{ 'cursor-pointer': !disabled }">
        <input
          :id="toggleId"
          type="checkbox"
          class="peer deasy-toggle__input"
          :checked="modelValue"
          :disabled="disabled"
          @change="onChange"
        />
        <span
          class="absolute inset-0 rounded-full bg-gray-200 transition-colors duration-200 ease-in-out peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20 peer-disabled:opacity-50 peer-disabled:pointer-events-none"
        ></span>
        <span
          class="absolute top-1/2 left-0.5 -translate-y-1/2 size-5 rounded-full bg-white shadow-theme-sm transition-transform duration-200 ease-in-out peer-checked:translate-x-full"
        ></span>
      </span>
    </component>
  </div>
</template>

<script setup>
import { computed, useId, useSlots } from "vue";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const slots = useSlots();
const fieldId = (name) => `${uid}-${name}`;

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ""
  },
  description: {
    type: String,
    default: ""
  },
  disabled: {
    type: Boolean,
    default: false
  },
  // 'start' -> label a la izquierda, switch a la derecha (fila, ancho completo).
  // 'end'   -> switch a la izquierda, label a la derecha (inline/compacto).
  labelPosition: {
    type: String,
    default: "start",
    validator: (value) => ["start", "end"].includes(value)
  },
  // Integración con el grid de formularios (deasy-col-N), como SInput/SSelect.
  wide: {
    type: String
  },
  /* DENTRO DE UN GRUPO DE CAMPO, donde el grupo ya pone la etiqueta encima y el control de al lado
     mide 40 px de alto. Sin esto el interruptor mide 24 y su celda 35 frente a las 68 de un campo
     normal: las filas de la rejilla dejan de cuadrar y el formulario se ve torcido. Medido en el
     modal de personas el 2026-08-15. */
  fieldAligned: {
    type: Boolean,
    default: false
  },
  id: {
    type: String
  }
});

const emit = defineEmits(["update:modelValue", "change"]);

const columnClass = computed(() => {
  const wideMap = {
    one: "deasy-col-1",
    two: "deasy-col-2",
    three: "deasy-col-3",
    four: "deasy-col-4",
    five: "deasy-col-5",
    six: "deasy-col-6",
    seven: "deasy-col-7",
    eight: "deasy-col-8",
    nine: "deasy-col-9",
    ten: "deasy-col-10",
    eleven: "deasy-col-11",
    twelve: "deasy-col-12"
  };
  return props.wide ? wideMap[props.wide] || "deasy-col-12" : "";
});

const rootClass = computed(() => {
  if (props.wide) return ["deasy-field-wrapper", columnClass.value];
  /* ⚠️ DENTRO DE UN GRUPO DE CAMPO EL ENVOLTORIO ES DE BLOQUE, y aqui estaba el defecto que se
     veia «chueco»: con `inline-block`, el interruptor compartia LINEA con la etiqueta del grupo
     —que es `inline-flex`— y ambos se alineaban por linea base. Medido en el modal de personas:
     la etiqueta caia en Y=1102 y el control en Y=1085, o sea **el rotulo quedaba DEBAJO de su
     propio interruptor**, al reves que en todos los campos de al lado (etiqueta 763, control 789).
     Un `<input>` no lo sufre porque es de bloque y rompe la linea el solo. */
  if (props.fieldAligned) return "block";
  return props.labelPosition === "end" ? "inline-block" : "w-full";
});

/* Solo hay etiqueta propia si alguien la pasa. Cuando no, el envoltorio deja de ser `<label>`:
   ver el aviso de la plantilla. */
const tieneEtiqueta = computed(() => Boolean(slots.default || props.label || props.description));

// La prop `id` manda; el id por instancia de useId() es solo el respaldo estable.
const toggleId = computed(() => props.id || fieldId("toggle"));

function onChange(event) {
  const value = event.target.checked;
  emit("update:modelValue", value);
  emit("change", value);
}
</script>
