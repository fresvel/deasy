<template>
  <div class="modal-body w-full px-4 sm:px-6 py-6 relative">
    
    <!-- Botón de Cerrar (Nativo Bootstrap) -->
    <button 
      type="button" 
      class="btn-close absolute top-4 right-4 z-10" 
      data-modal-dismiss 
      aria-label="Close"
      @click="$emit('close')">
    </button>

    <header class="mb-5 text-center w-full max-w-xl mx-auto mt-2">
      <h2 class="modal-title font-bold text-xl text-slate-800 tracking-tight mb-1">{{ title }}</h2>
      <p class="text-sm text-slate-500 mb-0 font-medium">{{ description }}</p>
    </header>

    <div v-if="errorMessage" class="alert alert-danger w-full max-w-xl mx-auto text-sm py-2 px-3 rounded-lg" role="alert">
      {{ errorMessage }}
    </div>

    <!-- Contenedor centralizado para todo el form -->
    <form class="flex flex-col gap-4 w-full max-w-xl mx-auto text-sm" @submit.prevent="$emit('submit')">
      <!-- Slot interno para los inputs -->
      <slot></slot>

      <div class="flex justify-end gap-3 mt-5 w-full pt-4 border-t border-slate-100">
        <button type="button" class="btn btn-light bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 btn-sm px-4 font-medium rounded-lg" data-modal-dismiss @click="$emit('cancel')" :disabled="isSubmitting">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary bg-sky-600 hover:bg-sky-700 border-none btn-sm px-5 font-medium rounded-lg shadow-sm" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          {{ submitText }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  description: String,
  errorMessage: String,
  isSubmitting: Boolean,
  submitText: { type: String, default: "Guardar" }
});
defineEmits(['submit', 'cancel', 'close']);
</script>