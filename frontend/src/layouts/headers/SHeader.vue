<template>
  <header
    class="sticky top-0 z-(--z-barra-superior) flex h-[60px] w-full flex-col justify-center border-b border-line bg-white pl-[4.25rem] pr-3 text-body shadow-none transition-all duration-300 xl:pl-20"
  >
    <AppLogo
      to="/home"
      size="sm"
      class-name="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white p-1"
      image-class="max-h-8 max-w-8 rounded-xl"
      aria-label="Ir al inicio"
    />
    <div class="mx-auto flex w-full max-w-[2560px] items-center gap-2 sm:gap-3">
      <button
        class="deasy-nav-action"
        type="button"
        aria-label="Abrir menu"
        @click="onClick('User')"
      >
        <IconMenu2 class="h-5.5 w-5.5" />
      </button>
      <!-- 🪤 AQUI HABIA UN `overflow-x-auto` Y RECORTABA EL MENU DE PERFIL — 2026-08-16.
           En CSS, poner UN eje del desbordamiento en algo distinto de `visible` **fuerza el otro a
           `auto`**. Asi que este contenedor, pensado solo para que el titulo pudiera desplazarse en
           horizontal, recortaba TAMBIEN en vertical: el panel del menu de perfil se abria en y=58 y
           la caja terminaba en y=55, o sea que se montaba entero y no se veia ni un pixel.

           Y sobraba: `deasy-workspace-header__context`, que es quien contiene el titulo, YA declara
           su propio `overflow-x-auto` con el mismo ocultado de barra. El desplazamiento horizontal
           no se pierde — estaba escrito dos veces, y la copia de fuera era la que clipaba. -->
      <div class="flex w-full items-center justify-between gap-2 sm:gap-3">
        <slot></slot>
      </div>
    </div>
  </header>
</template>

<script setup>
import { defineEmits, defineProps } from "vue";
import { IconMenu2 } from "@tabler/icons-vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";

defineProps({
  menuOpen: {
    type: Boolean,
    default: false
  },
  menu: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["onclick"]);

const onClick = (item) => {
  emit("onclick", item);
};
</script>
