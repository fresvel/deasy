<template>
  <button
    :type="type"
    :class="classes"
    :title="title || ariaLabel"
    :aria-label="ariaLabel || title"
    :disabled="disabled"
    v-bind="attrs"
    @click="$emit('click', $event)"
  >
    <span v-if="variant === 'close'" class="flex items-center justify-center w-full h-full">
      <IconX class="w-4 h-4" stroke-width="2.5" />
    </span>
    <span v-else-if="$slots.default && showInnerWrapper" class="btn-inner">
      <slot />
    </span>
    <slot v-else />
  </button>
</template>

<script setup>
import { computed, useAttrs } from "vue";
import { IconX } from "@tabler/icons-vue";

const props = defineProps({
  type: {
    type: String,
    default: "button"
  },
  variant: {
    type: String,
    default: "secondary"
  },
  size: {
    type: String,
    default: "md"
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ""
  },
  ariaLabel: {
    type: String,
    default: ""
  },
  className: {
    type: [String, Array, Object],
    default: ""
  }
});

defineEmits(["click"]);

const attrs = useAttrs();

const variantClassMap = {
  primary: "deasy-btn--primary admin-btn--primary",
  secondary: "deasy-btn--secondary admin-btn--secondary",
  cancel: "deasy-btn--cancel admin-btn--cancel",
  outlinePrimary: "deasy-btn--outline-primary admin-btn--outline-primary",
  outlineDanger: "deasy-btn--outline-danger admin-btn--outline-danger",
  softPrimary: "deasy-btn--soft-primary",
  softNeutral: "deasy-btn--soft-neutral",
  softSuccess: "deasy-btn--soft-success",
  softWarning: "deasy-btn--soft-warning",
  softDanger: "deasy-btn--soft-danger",
  success: "deasy-btn--success admin-btn--success",
  danger: "deasy-btn--danger admin-btn--danger",
  close: "deasy-btn--close admin-btn--close",
  menu: "deasy-btn--menu person-assignment-menu-btn",
  plain: ""
};

const sizeClassMap = {
  sm: "deasy-btn--sm admin-btn--sm",
  md: "deasy-btn--md",
  lg: "deasy-btn--lg admin-btn--lg"
};

/* [F1.6 2026-08-11] ANTES ESTO ERA `mapa[clave] || clave`, y estampaba la clave como si
   fuera una clase. Dos fallos en uno:

   1. Una variante desconocida acababa en el DOM como clase literal —`class="foo"`— que no
      existe en ningun modulo. El boton salia sin estilo y nada avisaba: ni el build, ni el
      lint, ni los tests ven una clase que no casa con ninguna regla.
   2. Peor: `plain` SI esta en el mapa, pero mapeado a `""`, que es FALSY. El `||` lo
      tomaba por ausente y caia al literal igual. Eran 16 usos de `variant="plain"`
      estampando `class="plain"`.

   Con pertenencia en vez de verdad, `""` es una respuesta valida. Y lo desconocido se
   queda fuera del DOM y grita en desarrollo, que es donde hay alguien mirando. */
const resolveClass = (map, key, kind) => {
  if (Object.hasOwn(map, key)) return map[key];
  if (import.meta.env.DEV) {
    console.warn(`[AppButton] ${kind} desconocida: "${key}". Valores validos: ${Object.keys(map).join(", ")}`);
  }
  return "";
};

const classes = computed(() => [
  ["close", "plain"].includes(props.variant)
    ? ""
    : "deasy-btn admin-btn",
  resolveClass(variantClassMap, props.variant, "variant"),
  props.variant !== "plain" && !props.iconOnly ? resolveClass(sizeClassMap, props.size, "size") : "",
  props.iconOnly ? "deasy-btn deasy-btn--icon admin-btn admin-btn--icon" : "",
  props.className
]);

const showInnerWrapper = computed(() => props.iconOnly || props.variant === "close");
</script>
