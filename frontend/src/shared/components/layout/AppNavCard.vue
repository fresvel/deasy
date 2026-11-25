<template>
  <AppButton
    variant="plain"
    type="button"
    :title="title"
    :aria-label="ariaLabel || title"
    :class-name="rootClasses"
    @click="$emit('click', $event)"
  >
    <!-- ⚠️ AQUI HABIA UN `<template>` SIN DIRECTIVA, y no renderizaba NADA. Venia de partir en
         dos el `v-if="layout === 'inline'"` / `v-else`: al morir la rama inline, el `v-else` se
         quedo sin su `v-if` y lo deje como `<template>` a secas. Un `<template>` sin `v-if`,
         `v-for` ni `#slot` dentro de un componente **no es contenido de slot: es un nodo que Vue
         descarta en silencio**, asi que las 16 tarjetas de `/admin` y `/perfil` salieron con su
         caja dibujada y **completamente vacias**. Ni el build ni los 403 tests ni los 26 gates lo
         vieron: lo vio la pantalla. El contenido va directo, sin envoltorio. -->
    <div class="flex h-full w-full flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <h3 :class="titleClasses">{{ title }}</h3>
        <div v-if="showArrow" :class="arrowWrapperClasses">
          <IconChevronRight class="w-6 h-6" />
        </div>
      </div>
      <div class="deasy-tile__slot">
        <span :class="iconWrapperClasses">
          <component :is="icon" :class="iconClasses" />
        </span>
        <span v-if="meta" class="text-sm font-semibold text-body">{{ meta }}</span>
        <span v-if="description" class="text-xs font-medium leading-relaxed text-muted line-clamp-3">{{ description }}</span>
      </div>
    </div>
    <AppTag v-if="badge" :variant="badgeVariant" class-name="mt-4 self-start">
      {{ badge }}
    </AppTag>
    </AppButton>
</template>

<script setup>
import { computed } from "vue";
import { IconChevronRight } from "@tabler/icons-vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  icon: {
    type: [Object, Function, String],
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  meta: {
    type: String,
    default: ""
  },
  showArrow: {
    type: Boolean,
    default: false
  },
  showMetaDot: {
    type: Boolean,
    default: true
  },
  badge: {
    type: String,
    default: ""
  },
  badgeVariant: {
    type: String,
    default: "info"
  },
  ariaLabel: {
    type: String,
    default: ""
  },
  className: {
    type: [String, Array, Object],
    default: ""
  },
  iconWrapperClass: {
    type: [String, Array, Object],
    default: ""
  },
  iconClass: {
    type: [String, Array, Object],
    default: "w-6 h-6"
  },
  titleClass: {
    type: [String, Array, Object],
    default: ""
  }
});

defineEmits(["click"]);

/* Las cuatro cadenas murieron en F8 (2026-08-20): eran identicas salvo el TAMAÑO, y llevaban
   color dentro. La receta vive en `nav.css` y aqui solo queda el nombre del modificador. */
/* ⚠️ AQUI HABIA DOS DISPOSICIONES, `inline` y `stacked`, Y LA PRIMERA ESTABA MUERTA.
   Censado en F13.6 (2026-08-21): **`layout="inline"` tiene CERO usos y `layout="stacked"` los 12**.
   La rama inline —una FILA con el icono a la izquierda— arrastraba media plantilla, una prop
   publica y cuatro recetas de `nav.css`. Retirada entera.

   Y las dos nunca debieron compartir receta: una fila y una baldosa de rejilla no son el mismo
   objeto. Por compartir `deasy-nav-card`, la baldosa heredaba **radio 12 y padding 20** cuando el
   resto del sistema la dibujaba a 16 y 24 — que es lo que hacia que `/admin` y `/perfil` no se
   parecieran a `/home`. Ahora es `deasy-tile`, la receta que `/home` y `/home/firmas` ya usaban. */
const rootClasses = computed(() => ["group deasy-tile", props.className]);

const iconWrapperClasses = computed(() => [
  "deasy-tile__icon",
  props.iconWrapperClass
]);

const iconClasses = computed(() => props.iconClass);

const titleClasses = computed(() => [
  "text-lg font-semibold leading-tight text-navy transition-colors",
  props.titleClass
]);

const arrowWrapperClasses = computed(() => [
  "flex h-8 w-8 translate-x-2 items-center justify-center rounded-full text-gray-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:bg-white group-hover:text-body group-hover:opacity-100"
]);
</script>
