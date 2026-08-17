<!-- [F1.4 2026-08-11 · reescrito en F5.3] EL AVISO ESTABA DEBAJO DEL VELO DEL MODAL. Este panel
     vivia en `z-[50]` y el velo del dialogo en 1075: un aviso que saltara con un dialogo abierto
     —que es justo cuando saltan, porque el dialogo es lo que dispara la accion— quedaba tapado. Y
     empataba con la cabecera, asi que ahi quien ganaba lo decidia el orden del DOM.

     Se arreglo con 1190/1200, numeros elegidos a ojo para que la relacion fuera correcta. Ahora es
     la banda 5000 de la escala, que dice lo mismo pero con nombre y por el motivo declarado: **los
     avisos van por encima de los dialogos**, no por debajo. La escala vive en `tokens.css`. -->
<template>
  <div>
    <div
      v-show="show"
      class="fixed inset-0 top-16 z-(--z-velo-notificaciones) bg-navy/20 backdrop-blur-[2px]"
      @click="$emit('close')"
    ></div>

    <div
      v-show="show"
      class="fixed right-4 top-[4.5rem] z-(--z-notificaciones) flex w-[calc(100vw-2rem)] origin-top-right transform flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(var(--elev-ink-rgb),0.04),0_18px_48px_rgba(var(--elev-ink-rgb),0.12)] transition-all duration-200 sm:right-6 sm:w-80 md:w-96 lg:right-8"
      :class="show ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-95 opacity-0'"
    >
      <header class="flex items-center justify-between border-b border-line bg-white px-5 py-4">
        <div class="flex items-center gap-2 text-strong">
          <IconBellFilled class="h-5 w-5 text-info" />
          <h3 class="m-0 text-sm font-semibold leading-tight">Notificaciones</h3>
        </div>
        <AppCloseButton class="sm:hidden" label="Cerrar notificaciones" @click="$emit('close')" />
      </header>

      <div class="custom-scrollbar flex max-h-[60vh] flex-1 flex-col overflow-y-auto p-3">
        <div class="flex flex-col items-center justify-center gap-3 py-10 text-muted">
          <div class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--neutral">
            <IconInbox class="h-6 w-6 stroke-[1.5]" />
          </div>
          <span class="text-sm font-medium">Bandeja vacía</span>
        </div>
      </div>

      <footer class="border-t border-line bg-surface/70 p-3">
        <button class="deasy-btn deasy-btn--neutral-outline w-full">
          Marcar todo como leído
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import { IconBellFilled, IconInbox } from "@tabler/icons-vue";

defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

defineEmits(["close"]);
</script>
