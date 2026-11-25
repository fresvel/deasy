<template>
  <component :is="rootTag" v-bind="rootAttrs" :class="rootClasses">
    <img
      src="/brand/deasy-logo.png"
      alt="Logo de DEASY"
      :class="imageClasses"
      decoding="async"
      draggable="false"
    />
  </component>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps({
  to: {
    type: [String, Object],
    default: ""
  },
  size: {
    type: String,
    default: "md"
  },
  className: {
    type: [String, Array, Object],
    default: ""
  },
  imageClass: {
    type: [String, Array, Object],
    default: ""
  },
  ariaLabel: {
    type: String,
    default: "DEASY"
  },
  framed: {
    type: Boolean,
    default: false
  }
});

const sizeClasses = {
  sm: "h-8 max-w-8",
  md: "h-12 max-w-12",
  lg: "h-20 max-w-20",
  xl: "h-24 max-w-24"
};

const rootTag = computed(() => (props.to ? RouterLink : "div"));

const rootAttrs = computed(() => {
  if (!props.to) {
    return { role: "img", "aria-label": props.ariaLabel };
  }

  return { to: props.to, "aria-label": props.ariaLabel };
});

/* EL RADIO VA UNA SOLA VEZ, Y A PROPOSITO.
   Antes lo ponian las DOS ramas —14 px al enmarcar y 16 al ser enlace, y sin nombrarlas aqui: en
   un `.vue` Tailwind LEE los comentarios, asi que citar la clase que se retira la mantiene viva— y
   nadie las habia visto juntas porque hoy ninguna vista enmarca un logo enlazado. El dia que
   alguien lo hiciera, dos utilidades de radio de la misma especificidad se pelean y **gana el
   orden de la hoja de estilos, no la intencion**. Aqui la precedencia es explicita: manda el
   marco, que es la caja que se ve.
   Y el 14 px que tenia el marco no era un paso de la escala ni casaba con nada de su pantalla:
   medido en la vista de entrada, la tarjeta de debajo pinta 12 y el boton 8. Ahora 12, como la
   tarjeta con la que convive. */
const claseRadio = computed(() => {
  if (props.framed) return "rounded-xl";
  return props.to ? "rounded-2xl" : "";
});

const rootClasses = computed(() => [
  "inline-flex min-w-0 items-center",
  claseRadio.value,
  props.framed ? "deasy-logo--framed" : "",
  props.to ? "deasy-logo--link transition-opacity hover:opacity-90" : "",
  props.className
]);

const imageClasses = computed(() => [
  "block w-auto object-contain select-none",
  sizeClasses[props.size] || sizeClasses.md,
  props.imageClass
]);
</script>
