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
    default: "neutral"
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
/* [F4 2026-08-16] EL NOMBRE DICE EL TONO Y EL MODO, EN ESE ORDEN — `{tono}{Modo}`.
   Antes el prefijo mandaba (`softSuccess`, `outlinePrimary`) y el mismo tono aparecia en tres
   sitios distintos de una lista ordenada alfabeticamente: para saber que formas tenia `danger`
   habia que leerla entera. Ahora las cinco lineas de abajo SON la matriz — tono a la izquierda,
   sus modos a la derecha — y lo que falta se ve de un vistazo.

   DOS MODOS, y el que no lleva sufijo es el normal:
     `{tono}`          contorno en reposo — fondo blanco, borde y texto el token — y SOLIDO al
                       pasar el raton, con el texto en blanco
     `{tono}Soft`      relleno al 6 % (10 % si lleva icono), borde al 71 %, texto el token

   Eran TRES modos hasta el 2026-08-16, cuando el dueño pidió «outline en reposo y solido en
   hover» para TODOS los botones, «Guardar» incluido. En cuanto el contorno es el reposo de
   todos, `primaryOutline` **es** `primary` y `dangerOutline` **es** `danger`: el modo entero
   se queda sin nada que distinguir y mueren los dos nombres (84 usos reasignados). `neutral`
   pierde el sufijo por lo mismo — nombrar el contorno cuando es lo normal es ruido.

   ⚠️ Y con eso el pie de un formulario PIERDE LA JERARQUIA DE PESO: «Guardar» y «Cancelar» eran
   solido azul contra contorno gris, y ahora son dos contornos separados solo por el color. Es un
   intercambio deliberado —homogeneidad por jerarquia—, y el hover devuelve el solido justo
   cuando apuntas. Queda escrito para que dentro de tres meses no se lea como un descuido.

   ⚠️ TRES VARIANTES MURIERON AQUI, y todas por medicion o por regla, no por gusto:

   · `cancel` -> `danger`. Era gris en reposo y ROJO al pasar el raton, o sea la unica variante
     del sistema —con `secondary`— que cambiaba de color en vez de intensificar el suyo (§5.2).
     Decision del dueño: cancelar ES danger, asi que lo es tambien en reposo.
   · `primaryOutline` y `dangerOutline` -> `primary` y `danger`, por lo dicho arriba.
   · `softActionUpload` -> `primarySoft`. Sus 4 usos eran todos `icon-only`, y en esa forma la
     receta manda a `--color-brand-50` / `--color-brand-600`: **el mismo pixel que `softPrimary`**,
     medido en el navegador. Su tono propio (`--color-action-upload`) no llegaba a la pantalla, y
     con el se va el token, que no tenia otro consumidor.

   Lo que si aporto `softActionUpload` en su dia sigue vivo en `infoSoft`: el reparto de los 12
   botones de accion de tabla en tonos. El tratamiento se decidio en el navegador comparando los
   cuatro pintados sobre la tabla de personas (178 botones a la vez): el solido se probo y se
   descarto — cada boton se leia mejor, pero la columna entera se convertia en una franja de color
   que pesaba mas que los datos.

   [F3.2 2026-08-14] `warning` solido FALTABA, y no como capricho: los solidos eran `primary`,
   `success` y `danger`, sin el de aviso, mientras las suaves si tenian los cuatro tonos. La
   asimetria estaba viva — `HomeView` pedia `variant="warning"` y el boton salia SIN NINGUNA clase
   de variante, porque el mapa resuelve por pertenencia y devuelve cadena vacia para lo
   desconocido. Solo avisaba la consola, y solo en desarrollo. Lo vigila `check:variants`. */
const variantClassMap = {
  primary: "deasy-btn--primary",
  primarySoft: "deasy-btn--primary-soft",

  success: "deasy-btn--success",
  successSoft: "deasy-btn--success-soft",

  warning: "deasy-btn--warning",
  warningSoft: "deasy-btn--warning-soft",

  danger: "deasy-btn--danger",
  dangerSoft: "deasy-btn--danger-soft",

  /* `info` no tiene forma normal: su unico papel es el badge de «ver» de las tablas, que es de
     icono. Un contorno azul claro con texto seria indistinguible de `primary` a un metro. */
  infoSoft: "deasy-btn--info-soft",

  neutral: "deasy-btn--neutral",
  neutralSoft: "deasy-btn--neutral-soft",

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
