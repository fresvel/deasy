<template>
  <div class="profile-admin-skin relative w-full px-4 py-6 sm:px-6">
    <AppButton
      type="button"
      variant="close"
      class-name="absolute right-4 top-4 z-10"
      data-modal-dismiss
      aria-label="Close"
      @click="$emit('close')"
    >
      <span class="text-xl leading-none">&times;</span>
    </AppButton>

    <header class="mx-auto mt-2 mb-5 w-full max-w-xl text-center">
      <h2 class="mb-1 text-xl font-bold tracking-tight text-slate-800">{{ title }}</h2>
      <p class="mb-0 text-sm font-medium text-slate-500">{{ description }}</p>
    </header>

    <div
      v-if="errorMessage"
      class="mx-auto w-full max-w-xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <form class="mx-auto flex w-full max-w-xl flex-col gap-4 text-sm" @submit.prevent="$emit('submit')">
      <slot />

      <div class="mt-5 flex w-full justify-end gap-3 border-t border-slate-100 pt-4">
        <AppButton
          type="button"
          variant="secondary"
          data-modal-dismiss
          :disabled="isSubmitting"
          @click="$emit('cancel')"
        >
          Cancelar
        </AppButton>
        <AppButton type="submit" variant="primary" :disabled="isSubmitting">
          <span
            v-if="isSubmitting"
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            role="status"
            aria-hidden="true"
          ></span>
          {{ submitText }}
        </AppButton>
      </div>
    </form>
  </div>
</template>

<script setup>
import AppButton from "@/shared/components/buttons/AppButton.vue";

defineProps({
  title: String,
  description: String,
  errorMessage: String,
  isSubmitting: Boolean,
  submitText: { type: String, default: "Guardar" }
});

defineEmits(["submit", "cancel", "close"]);
</script>
