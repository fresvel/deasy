<template>
  <div class="deasy-counter-nav" :class="shellClass">
    <button
      v-if="controls"
      type="button"
      class="deasy-counter-nav__step"
      :disabled="previousDisabled"
      :title="previousTitle"
      @click.stop="$emit('previous')"
    >
      <IconChevronLeft :class="iconClass" />
    </button>

    <div class="deasy-counter-nav__value" :class="controls ? 'deasy-counter-nav__value--framed' : ''">
      <div v-if="label" class="deasy-counter-nav__label">{{ label }}</div>

      <div class="deasy-counter-nav__reading">
        <template v-if="editable">
          <input
            :value="modelValue"
            aria-label="Ir al número"
            class="deasy-counter-nav__input"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            @input="$emit('update:modelValue', $event.target.value)"
            @keyup.enter="$emit('submit')"
            @blur="$emit('submit')"
          >
          <span>/ {{ total }}</span>
        </template>

        <template v-else>{{ reading }}</template>
      </div>
    </div>

    <button
      v-if="controls"
      type="button"
      class="deasy-counter-nav__step"
      :disabled="nextDisabled"
      :title="nextTitle"
      @click.stop="$emit('next')"
    >
      <IconChevronRight :class="iconClass" />
    </button>
  </div>
</template>

<script setup>
/* EL NAVEGADOR DE CONTADOR — «‹ 3 / 12 ›»
 *
 * Existia, y aun asi el mismo widget estaba escrito tres veces mas a mano (G4, 2026-08-15). No
 * era capricho: al que lo copiaba le faltaba algo que este no daba, y copiar salia mas barato que
 * ampliarlo. Lo que faltaba era exactamente esto:
 *
 *   - `valueLabel` — leer un ESTADO («Coordenadas compartidas») en vez de `n / total`.
 *     MultiSignerBatchStatusPanel navega modos, no numeros.
 *   - `size="sm"` — el navegador superpuesto sobre el PDF mide 24 px, no 36.
 *   - `tone="floating"` — sobre una pagina de PDF el fondo es variable, y un borde de linea sobre
 *     blanco no se distingue: hace falta desenfoque y sombra.
 *   - `controls` — poder mostrar solo la lectura, sin flechas.
 *
 * ⚠️ Y una diferencia que NO era de aspecto sino un defecto: las copias OCULTABAN las flechas con
 * `v-if` cuando no habia a donde ir, asi que el contador cambiaba de ancho y SALTABA de sitio al
 * llegar al primero o al ultimo. Aqui se DESHABILITAN. `controls: false` sigue existiendo para el
 * caso legitimo —un contador que de verdad no navega—, que es otra cosa.
 *
 * El estilo esta entero en `nav.css` bajo `.deasy-counter-nav`. Aqui no viaja ni una utilidad. */
import { computed } from "vue";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-vue";

const props = defineProps({
  label: {
    type: String,
    default: ""
  },
  current: {
    type: Number,
    default: 1
  },
  total: {
    type: Number,
    default: 1
  },
  /* Lectura libre: cuando viene, sustituye a `current / total`. */
  valueLabel: {
    type: String,
    default: ""
  },
  editable: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: [Number, String],
    default: ""
  },
  size: {
    type: String,
    default: "md",
    validator: (v) => ["sm", "md"].includes(v)
  },
  tone: {
    type: String,
    default: "plain",
    validator: (v) => ["plain", "floating"].includes(v)
  },
  controls: {
    type: Boolean,
    default: true
  },
  previousDisabled: {
    type: Boolean,
    default: false
  },
  nextDisabled: {
    type: Boolean,
    default: false
  },
  previousTitle: {
    type: String,
    default: ""
  },
  nextTitle: {
    type: String,
    default: ""
  }
});

defineEmits(["previous", "next", "update:modelValue", "submit"]);

const shellClass = computed(() => [
  props.size === "sm" ? "deasy-counter-nav--sm" : "",
  props.tone === "floating" ? "deasy-counter-nav--floating" : "",
  props.editable ? "deasy-counter-nav--editable" : ""
].filter(Boolean));

const iconClass = computed(() => (props.size === "sm" ? "h-3 w-3" : "h-5 w-5"));

const reading = computed(() => props.valueLabel || `${props.current} / ${props.total}`);
</script>
