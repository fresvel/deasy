<template>
  <div class="profile-admin-skin dossier-modal-shell relative w-full">
    <header class="dossier-modal-header">
      <div class="dossier-modal-header__text">
        <h2 class="dossier-modal-title">{{ title }}</h2>
        <p class="dossier-modal-desc">{{ description }}</p>
      </div>
      <AppButton
        type="button"
        variant="close"
        class-name="dossier-modal-close"
        data-modal-dismiss
        aria-label="Close"
        @click="$emit('close')"
      >
        <span class="text-xl leading-none">&times;</span>
      </AppButton>
    </header>

    <form class="dossier-modal-form" @submit.prevent="$emit('submit')">
      <div class="dossier-modal-content">
        <div v-if="errorMessage" class="dossier-modal-alert" role="alert">
          {{ errorMessage }}
        </div>

        <div ref="bodyRef" class="dossier-modal-body">
          <div ref="contentRef" class="flex flex-col gap-4 pb-1">
            <slot />
          </div>
        </div>
      </div>

      <div class="dossier-modal-footer">
        <button
          v-if="isScrollable"
          type="button"
          class="dossier-scroll-hint"
          :class="{ 'dossier-scroll-hint--up': atBottom }"
          :aria-label="atBottom ? 'Volver arriba' : 'Ver más campos'"
          @click="handleScrollClick"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span v-else></span>

        <div class="flex gap-3">
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
      </div>
    </form>
  </div>
</template>

<script setup>
import AppButton from "@/shared/components/buttons/AppButton.vue";
import { ref, onMounted, onBeforeUnmount } from "vue";

defineProps({
  title: String,
  description: String,
  errorMessage: String,
  isSubmitting: Boolean,
  submitText: { type: String, default: "Guardar" }
});

defineEmits(["submit", "cancel", "close"]);

const bodyRef = ref(null);
const contentRef = ref(null);
const isScrollable = ref(false);
const atBottom = ref(false);
let resizeObserver = null;

const checkScrollState = () => {
  const el = bodyRef.value;
  if (!el) return;
  isScrollable.value = el.scrollHeight > el.clientHeight + 4;
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
};

const handleScrollClick = () => {
  const el = bodyRef.value;
  if (!el) return;
  if (atBottom.value) {
    el.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    el.scrollBy({ top: el.clientHeight * 0.6, behavior: "smooth" });
  }
};

onMounted(() => {
  checkScrollState();
  bodyRef.value?.addEventListener("scroll", checkScrollState);
  if (contentRef.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(checkScrollState);
    resizeObserver.observe(contentRef.value);
  }
  window.addEventListener("resize", checkScrollState);
});

onBeforeUnmount(() => {
  bodyRef.value?.removeEventListener("scroll", checkScrollState);
  window.removeEventListener("resize", checkScrollState);
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.dossier-modal-shell {
  overflow: hidden;
}

.dossier-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 1.85rem 1.4rem 3.2rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.12) 0%, rgba(56, 189, 248, 0.2) 100%);
}

.dossier-modal-title {
  margin: 0 0 0.15rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--brand-navy, #0f172a);
}

.dossier-modal-desc {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--brand-secondary, #64748b);
}

.dossier-modal-close {
  flex-shrink: 0;
  width: 2.25rem !important;
  height: 2.25rem !important;
  padding: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dossier-modal-content {
  padding: 1.5rem 1.8rem 0 3rem;
}

.dossier-modal-alert {
  margin: 0 0.4rem 0.75rem 0;
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid #fecaca;
  background: #fef2f2;
  padding: 0.55rem 0.85rem;
  font-size: 0.85rem;
  color: #b91c1c;
}

.dossier-modal-form {
  display: flex;
  flex-direction: column;
}

.dossier-modal-body {
  max-height: min(56vh, 460px);
  overflow-y: auto;
  padding-right: 0.75rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.5) transparent;
}

.dossier-modal-body::-webkit-scrollbar {
  width: 6px;
}

.dossier-modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.dossier-modal-body::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.5);
  border-radius: 999px;
}

.dossier-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.15rem;
  padding: 1.2rem 2.35rem 1.2rem 2.8rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  background: var(--brand-surface-alt, #f8fafc);
}

.dossier-scroll-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #fff;
  color: var(--brand-secondary, #64748b);
  transition: transform 0.2s ease, color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.dossier-scroll-hint:hover {
  color: var(--brand-primary, #0284c7);
  border-color: rgba(2, 132, 199, 0.4);
  background: #f0f9ff;
}

.dossier-scroll-hint--up svg {
  transform: rotate(180deg);
}
</style>