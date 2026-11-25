<template>
  <component
    :is="size === 'hero' ? 'section' : 'div'"
    class="deasy-page-header"
    :class="[size === 'hero' ? 'deasy-page-header--hero' : 'deasy-page-header--section', shellClass]"
  >
    <div
      class="deasy-page-header__main"
      :class="[hasMedia ? 'deasy-page-header__main--with-media' : '', centered ? 'text-center sm:text-start' : '']"
    >
      <div v-if="hasMedia" class="deasy-page-header__media" :class="centered ? 'flex flex-col items-center gap-3 sm:items-start' : ''">
        <div class="deasy-page-header__media-card" :class="mediaClass">
          <slot name="media" />
        </div>
      </div>
      <div class="deasy-page-header__copy sm:pt-0">
        <p v-if="overline" class="deasy-overline deasy-overline--spaced">{{ overline }}</p>
        <component :is="size === 'hero' ? 'h2' : 'h1'" class="deasy-page-header__title">{{ title }}</component>
        <p v-if="description" class="deasy-page-header__description">{{ description }}</p>
      </div>
    </div>
    <div v-if="hasActions" class="deasy-page-header__actions" :class="compactActions ? 'deasy-page-header__actions--compact' : ''">
      <slot name="actions" />
    </div>
  </component>
</template>

<script setup>
/* LA CABECERA DE UNA PÁGINA — kicker, título, descripción, media y acciones.
 *
 * Colapsa dos familias que eran **el mismo concepto con dos nombres**: `deasy-hero-*` (3 usos, con
 * caja y media) y `admin-page-header` con título (2 usos). Las dos dicen lo mismo —dónde estás y
 * qué puedes hacer aquí— y sólo se diferencian en si la cabecera trae su propia caja.
 *
 * Que ya se habían mezclado lo demostraba `deasy-hero-back-button`: se usaba **14 veces**, y varias
 * de ellas **dentro de `admin-page-header`**. El botón de una familia viviendo en la caja de la
 * otra es la señal de que la frontera entre ambas no existía.
 *
 * ⚠️ Ese botón MURIÓ el 2026-08-16 y su final cierra la historia de esta cabecera: al medirlo
 * resultó ser **la quinta geometría** —50 px de alto, radio 16, peso 600, y una caja de icono de
 * 32×32 con radio 12,8 px DENTRO de la caja del propio botón— sobreviviendo a la unificación del
 * 14-ago porque era un `<button>` CRUDO con clase `deasy-*`, y los gates de botón tratan ese
 * prefijo como «bloque del sistema» y dejan de mirarlo. Sus 7 usos hacían lo mismo que el
 * «Regresar» de la cabecera de tabla, que ya era `AppButton`. Hoy los siete lo son.
 *
 * 🪤 EL `mt-1` QUE NO PINTA. Un consumidor escribía `class="admin-page-header__title mt-1"` para
 * separar el título de su kicker, y ese `mt-1` **nunca se aplicó**: `.admin-page-header__title` está
 * declarada FUERA de `@layer` (ver el aviso en `admin.css`) y por tanto gana a `@layer utilities`,
 * donde vive `mt-1`. El hueco lo da ahora `deasy-overline--spaced`, que sí está en la capa.
 * Es un pixel que cambia —el título baja 4 px respecto a hoy— y es el arreglo, no la regresión.
 *
 * ⚠️ Este componente colapsa la PLANTILLA, no el CSS: sigue componiendo las clases que ya existían.
 * Fundir las dos familias de CSS en una es un paso aparte, y está definido en el plan (F6).
 */
import { computed, useSlots } from "vue";

const props = defineProps({
  /* El rótulo pequeño de encima del título. `kicker` en la familia hero. */
  overline: { type: String, default: "" },
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  /* `hero` trae caja, sombra y sitio para media; `section` es la fila desnuda. */
  size: {
    type: String,
    default: "section",
    validator: (v) => ["hero", "section"].includes(v),
  },
  /* La media es un avatar y no un icono: cambia el relleno de su tarjeta. */
  avatarMedia: { type: Boolean, default: false },
  /* Centra copia y media en movil, alineando a la izquierda a partir de `sm`. Lo pide el hero del
     perfil, donde la foto es el sujeto y en pantalla estrecha queda mejor centrada. */
  centered: { type: Boolean, default: false },
  /* Las acciones ocupan todo el ancho en móvil sin empujar el layout. */
  compactActions: { type: Boolean, default: false },
  shellClass: { type: [String, Array, Object], default: "" },
});

const slots = useSlots();
const hasMedia = computed(() => Boolean(slots.media));
const hasActions = computed(() => Boolean(slots.actions));
const mediaClass = computed(() => (props.avatarMedia ? "deasy-page-header__media-card--avatar" : ""));
</script>
