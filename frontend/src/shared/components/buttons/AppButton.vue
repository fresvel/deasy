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
    <span v-if="$slots.default && showInnerWrapper">
      <slot />
    </span>
    <slot v-else />
  </button>
</template>

<script setup>
import { computed, useAttrs } from "vue";

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

/* [F1.3 2026-08-14] AQUI HABIA UN GEMELO `admin-btn--*` PEGADO A CADA VARIANTE, y no pintaba
   nada propio: `buttons.css` declaraba los once **en la misma lista de selectores** que su
   hermano `deasy-btn--*`, o sea que el elemento recibia dos nombres para una regla. Retirados
   con su mitad del CSS, en el mismo commit y con cambio cero en el CSS construido.

   Cuatro de los que habia aqui eran peores que redundantes: `admin-btn--icon`, `--sm`, `--lg` y
   `person-assignment-menu-btn` **no los declaraba ningun CSS**. Llevaban meses viajando al DOM
   sin pintar, y no los veia ningun gate: los gates leen atributos `class` del markup, y estos
   viven en un MAPA DE JAVASCRIPT. La clase base `admin-btn` si se queda — la consume
   `.admin-page-header__actions .admin-btn`, que es deuda de la fase 6, no de esta. */
const variantClassMap = {
  primary: "deasy-btn--primary",
  secondary: "deasy-btn--secondary",
  cancel: "deasy-btn--cancel",
  outlinePrimary: "deasy-btn--outline-primary",
  outlineDanger: "deasy-btn--outline-danger",
  softPrimary: "deasy-btn--soft-primary",
  softNeutral: "deasy-btn--soft-neutral",
  softSuccess: "deasy-btn--soft-success",
  softWarning: "deasy-btn--soft-warning",
  softDanger: "deasy-btn--soft-danger",
  /* [F3.4 2026-08-14] `softInfo` y `softActionUpload` son los dos tonos que le faltaban a la
     familia suave: el azul de «ver» y el indigo de «subir/versionar/descargar». Existian solo
     dentro de `hope-action-*`, y con ellos los 12 botones de accion colapsaron a variantes.

     El tratamiento se decidio en el navegador, comparando los cuatro pintados sobre la tabla de
     personas (178 botones a la vez): el solido se probo y se descarto — cada boton se leia mejor,
     pero la columna entera se convertia en una franja de color que pesaba mas que los datos. */
  softInfo: "deasy-btn--soft-info",
  softActionUpload: "deasy-btn--soft-action-upload",
  success: "deasy-btn--success",
  /* [F3.2 2026-08-14] `warning` FALTABA, y no como capricho: los solidos eran `primary`,
     `success` y `danger`, sin el de aviso, mientras las SUAVES si tenian los cuatro tonos. La
     asimetria estaba viva — `HomeView` pedia `variant="warning"` para confirmar el reseteo de un
     flujo y el boton salia SIN NINGUNA clase de variante, porque el mapa resuelve por pertenencia
     y devuelve cadena vacia para lo desconocido. Solo avisaba la consola, y solo en desarrollo.
     `--color-warning` sobre blanco da 5.43:1, que pasa AA. Lo vigila `check:variants`. */
  warning: "deasy-btn--warning",
  danger: "deasy-btn--danger",
  menu: "deasy-btn--menu",
  plain: ""
};

const sizeClassMap = {
  sm: "deasy-btn--sm",
  md: "deasy-btn--md",
  lg: "deasy-btn--lg"
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
  props.variant === "plain"
    ? ""
    : "deasy-btn admin-btn",
  resolveClass(variantClassMap, props.variant, "variant"),
  /* [G3 2026-08-14] AQUI HABIA UNA EXCEPCION PARA `close`, y su historia vale como norma:
     `variant="close"` no admitia tamaño —la ✕ es un cuadrado fijo— pero eso no estaba escrito en
     ninguna parte, asi que `AppFormModalLayout` recibio el `--md` por defecto, su `px-4 py-2`
     dejo la caja interna en 4 px y el icono se aplasto a **2 px: invisible**.

     El primer arreglo fue añadir `close` a esta lista de excepciones. El bueno fue quitarlo del
     componente: `close` no era una variante —traia su propio icono, ignoraba el slot y prohibia
     el tamaño— sino OTRO BOTON. Vive en `AppCloseButton.vue`, sin `variant` ni `size` que puedan
     estropearlo. La combinacion invalida ya no se puede escribir. */
  props.variant === "plain" || props.iconOnly
    ? ""
    : resolveClass(sizeClassMap, props.size, "size"),
  props.iconOnly ? "deasy-btn deasy-btn--icon admin-btn" : "",
  props.className
]);

const showInnerWrapper = computed(() => props.iconOnly);
</script>
