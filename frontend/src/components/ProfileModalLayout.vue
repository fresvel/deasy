<template>
  <div class="modal-body w-full px-4 py-8 relative">
    <header class="mb-6 text-center w-full max-w-xl mx-auto">
      <h2 class="modal-title font-semibold text-2xl mb-2">{{ title }}</h2>
      <p class="text-gray-500 mb-0">{{ description }}</p>
    </header>

    <div v-if="errorMessage" class="alert alert-danger w-full max-w-xl mx-auto" role="alert">
      {{ errorMessage }}
    </div>

    <!-- Contenedor centralizado para todo el form -->
    <form class="flex flex-col gap-4 w-full max-w-xl mx-auto" @submit.prevent="$emit('submit')">
      <!-- Slot interno para los inputs -->
      <slot></slot>

      <div class="flex justify-end gap-3 mt-6 w-full pt-4 border-t border-gray-100">
        <button type="button" class="btn btn-outline-secondary btn-lg" @click="$emit('cancel')" :disabled="isSubmitting">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary btn-lg px-6" :disabled="isSubmitting">
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
defineEmits(['submit', 'cancel']);
</script>