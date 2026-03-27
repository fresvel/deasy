<template>
  <div class="flex flex-col flex-1 min-w-0 w-full transition-all duration-300 px-2 sm:px-4 md:px-6 lg:px-8 py-6">
    <div class="w-full h-full pb-8">
      <FirmarView v-if="isFirmarActivo" />
      <slot v-else></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useFirmar } from '@/composables/useFirmar';
import FirmarView from '@/views/funciones/FirmarPdf.vue';

const { isFirmarActivo, setFirmarActivo } = useFirmar();
const route = useRoute();

// Ocultar firmas automáticamente si el usuario cambia de ruta clickeando el sidebar o botones del header
watch(
  () => route.path,
  () => {
    setFirmarActivo(false);
  }
);

const props = defineProps({
    showmenu: {
        type: Boolean,
        default: false
    },
    shownotify: {
        type: Boolean,
        default: false
    },
    shownavmenu: {
        type: Boolean,
        default: false
    }
})
</script>
