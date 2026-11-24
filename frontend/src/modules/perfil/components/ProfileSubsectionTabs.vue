<template>
  <!-- ⚠️ UN SOLO COMPONENTE PARA LOS DOS NIVELES DE PESTAÑA, con `nested` decidiendo el aspecto.
       El comportamiento es identico —lista con estado, contador y `role="tablist"`— asi que
       duplicarlo seria duplicar la accesibilidad; lo que cambia es como se lee: el nivel 1 con
       subrayado (navegacion) y el 2 como grupo segmentado (filtro de lo ya elegido). -->
  <!-- CUANDO LAS PESTAÑAS NO CABEN, SE RECORREN CON DOS FLECHAS (2026-11-23). La tira ya se
       desplazaba en horizontal, pero con la barra oculta: en una pantalla estrecha las últimas
       pestañas quedaban fuera y nada decía que existían. Las flechas sólo aparecen si hay algo que
       no cabe, y cada una se apaga al llegar a su extremo. La pestaña activa se trae siempre a la
       vista: abrir «Organigrama», que es la última de trece, no puede dejarla escondida. -->
  <div class="deasy-inline-tabs-marco">
    <AppButton
      v-if="desborda"
      variant="neutral-outline"
      icon-only
      :disabled="!hayAntes"
      title="Pestañas anteriores"
      aria-label="Pestañas anteriores"
      @click="mover(-1)"
    >
      <IconChevronLeft class="h-4 w-4" />
    </AppButton>
    <div
      ref="tira"
      class="deasy-inline-tabs"
      :class="nested ? 'deasy-inline-tabs--anidadas' : ''"
      role="tablist"
      :aria-label="ariaLabel"
      @scroll.passive="medir"
    >
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        class="deasy-inline-tab"
        :class="[nested ? 'deasy-inline-tab--anidada' : '', tab.key === modelValue ? 'deasy-inline-tab--active' : '']"
        :aria-selected="tab.key === modelValue ? 'true' : 'false'"
        @click="$emit('update:modelValue', tab.key)"
      >
        <span class="truncate">{{ tab.label }}</span>
        <span
          v-if="typeof tab.count === 'number'"
          class="deasy-inline-tab__badge"
          :class="tab.key === modelValue ? 'deasy-inline-tab__badge--active' : ''"
        >
          {{ tab.count }}
        </span>
      </button>
    </div>
    <AppButton
      v-if="desborda"
      variant="neutral-outline"
      icon-only
      :disabled="!hayDespues"
      title="Pestañas siguientes"
      aria-label="Pestañas siguientes"
      @click="mover(1)"
    >
      <IconChevronRight class="h-4 w-4" />
    </AppButton>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  tabs: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: 'Subsecciones',
  },
  /* El segundo nivel: se dibuja como grupo segmentado en vez de con subrayado. */
  nested: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['update:modelValue']);

/* ── Recorrer la tira cuando no cabe ──────────────────────────────────────────────────────────── */
const tira = ref(null);
const desborda = ref(false);
const hayAntes = ref(false);
const hayDespues = ref(false);

/* El margen de 1 px absorbe el redondeo: con zoom, `scrollWidth` y `clientWidth` pueden diferir en
   una fracción sin que haya nada escondido, y las flechas aparecerían sin motivo. */
const medir = () => {
  const el = tira.value;
  if (!el) return;
  desborda.value = el.scrollWidth > el.clientWidth + 1;
  hayAntes.value = el.scrollLeft > 1;
  hayDespues.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
};

/* Avanza casi un ancho entero: deja a la vista la última pestaña de antes, para no perder el sitio. */
const mover = (sentido) => {
  const el = tira.value;
  if (!el) return;
  el.scrollBy({ left: sentido * el.clientWidth * 0.8, behavior: "smooth" });
};

/* EN DOS TIEMPOS, y el orden importa: primero se mide —para que, si no cabe, aparezcan las flechas—,
   y sólo cuando las flechas ya están pintadas se trae la pestaña activa. Al revés, la tira se
   encoge DESPUÉS de haberla colocado, por el sitio que ocupan las flechas, y la activa queda medio
   tapada: pasaba con «Organigrama», la última de trece. */
const traerActivaALaVista = async () => {
  await nextTick();
  medir();
  await nextTick();
  tira.value?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
  medir();
};

let observador = null;
onMounted(() => {
  traerActivaALaVista();
  /* El ancho disponible cambia sin que cambien las pestañas —se abre el menú lateral, se estrecha
     la ventana—, y eso no lo avisa ningún evento de la tira. `ResizeObserver` no existe en el
     entorno de los tests; ahí basta con la medida inicial. */
  if (typeof ResizeObserver !== "undefined" && tira.value) {
    observador = new ResizeObserver(medir);
    observador.observe(tira.value);
  }
});
onBeforeUnmount(() => observador?.disconnect());
watch(() => [props.modelValue, props.tabs.length], traerActivaALaVista);
</script>
