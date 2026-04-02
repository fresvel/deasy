<template>
  <div class="profile-admin-skin w-full px-4 py-6 relative sm:px-6">
    
    <button
      type="button"
      class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      data-modal-dismiss
      aria-label="Close"
      @click="$emit('close')"
    >
      <span class="text-xl leading-none">&times;</span>
    </button>

    <header class="mb-5 text-center w-full max-w-xl mx-auto mt-2">
      <h2 class="font-bold text-xl text-slate-800 tracking-tight mb-1">{{ title }}</h2>
      <p class="text-sm text-slate-500 mb-0 font-medium">{{ description }}</p>
    </header>

    <div v-if="errorMessage" class="w-full max-w-xl mx-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {{ errorMessage }}
    </div>

    <!-- Contenedor centralizado para todo el form -->
    <form class="flex flex-col gap-4 w-full max-w-xl mx-auto text-sm" @submit.prevent="$emit('submit')">
      <!-- Slot interno para los inputs -->
      <slot></slot>

      <div class="flex justify-end gap-3 mt-5 w-full pt-4 border-t border-slate-100">
        <button type="button" class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" data-modal-dismiss @click="$emit('cancel')" :disabled="isSubmitting">
          Cancelar
        </button>
        <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" role="status" aria-hidden="true"></span>
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
