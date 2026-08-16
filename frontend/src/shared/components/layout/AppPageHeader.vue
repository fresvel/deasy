<template>
  <!-- HERO: la cabecera con caja propia, para la portada de una sección -->
  <section v-if="size === 'hero'" class="deasy-hero-shell" :class="shellClass">
    <div class="deasy-hero-layout">
      <div class="deasy-hero-main" :class="[hasMedia ? 'deasy-hero-main--with-media' : '', centered ? 'text-center sm:text-left' : '']">
        <div v-if="hasMedia" class="deasy-hero-media" :class="centered ? 'flex flex-col items-center gap-3 sm:items-start' : ''">
          <div class="deasy-hero-media-card" :class="mediaClass">
            <slot name="media" />
          </div>
        </div>
        <div class="deasy-hero-copy sm:pt-0">
          <div v-if="eyebrow" class="deasy-hero-kicker">{{ eyebrow }}</div>
          <h2 class="deasy-hero-title">{{ title }}</h2>
          <p v-if="description" class="deasy-hero-description">{{ description }}</p>
        </div>
      </div>
      <div v-if="hasActions" class="deasy-hero-side" :class="compactActions ? 'deasy-hero-side--compact' : ''">
        <slot name="actions" />
      </div>
    </div>
  </section>

  <!-- SECTION: la misma cabecera sin caja, dentro de un panel que ya la tiene -->
  <div v-else class="admin-page-header">
    <div class="admin-page-header__main">
      <p v-if="eyebrow" class="deasy-overline deasy-overline--spaced">{{ eyebrow }}</p>
      <h1 class="admin-page-header__title">{{ title }}</h1>
      <p v-if="description" class="admin-page-header__description">{{ description }}</p>
    </div>
    <div v-if="hasActions" class="admin-page-header__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
/* LA CABECERA DE UNA PÁGINA — kicker, título, descripción, media y acciones.
 *
 * Colapsa dos familias que eran **el mismo concepto con dos nombres**: `deasy-hero-*` (3 usos, con
 * caja y media) y `admin-page-header` con título (2 usos). Las dos dicen lo mismo —dónde estás y
 * qué puedes hacer aquí— y sólo se diferencian en si la cabecera trae su propia caja.
 *
 * Que ya se habían mezclado lo demuestra `deasy-hero-back-button`: se usa **14 veces**, y varias de
 * ellas **dentro de `admin-page-header`**. El botón de una familia viviendo en la caja de la otra
 * es la señal de que la frontera entre ambas no existía.
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
  eyebrow: { type: String, default: "" },
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
const mediaClass = computed(() => (props.avatarMedia ? "deasy-hero-media-card--avatar" : ""));
</script>
