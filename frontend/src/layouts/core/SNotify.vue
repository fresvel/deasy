<!-- [F1.4 2026-08-11] EL AVISO ESTABA DEBAJO DEL VELO DEL MODAL. Este panel vivia en
     `z-[50]` y el velo del dialogo en 1075: un aviso que saltara con un dialogo abierto
     —que es justo cuando saltan, porque el dialogo es lo que dispara la accion— quedaba
     tapado. Y empataba con la cabecera (`SHeader`, z-50), asi que ahi quien ganaba lo
     decidia el orden del DOM.

     1190/1200 lo pone por encima de todo lo que hay hoy (modal 1075, tip 1100, toast de
     admin 1080). Son numeros PROVISIONALES elegidos para que la relacion sea correcta,
     no una escala: la app tiene 11 valores en 14 grafias repartidos en tres bandas que no
     se hablan (la de Tailwind, tres numeros a ojo y la herencia de Bootstrap). Declarar
     las capas de apilamiento de verdad es F6.2 del plan. -->
<template>
  <div>
    <div
      v-show="show"
      class="fixed inset-0 top-16 z-1190 bg-navy/20 backdrop-blur-[2px]"
      @click="$emit('close')"
    ></div>

    <div
      v-show="show"
      class="fixed right-4 top-[4.5rem] z-1200 flex w-[calc(100vw-2rem)] origin-top-right transform flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(var(--elev-ink-rgb),0.04),0_18px_48px_rgba(var(--elev-ink-rgb),0.12)] transition-all duration-200 sm:right-6 sm:w-80 md:w-96 lg:right-8"
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
        <button class="deasy-btn deasy-btn--neutral deasy-btn--sm w-full">
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
