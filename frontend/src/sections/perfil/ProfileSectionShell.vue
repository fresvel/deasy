<template>
  <section class="profile-shell">
    <div class="profile-shell-surface">
      <header class="profile-shell-header">
        <div>
          <h2 class="profile-shell-title">{{ title }}</h2>
          <p class="profile-shell-subtitle">{{ subtitle }}</p>
        </div>
        <button v-if="showAdd" class="btn btn-primary btn-lg profile-add-btn" type="button" @click="$emit('add')">
          <font-awesome-icon icon="plus" class="me-2" />
          {{ addLabel }}
        </button>
      </header>

      <div class="profile-shell-body">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";

defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ""
  },
  addLabel: {
    type: String,
    default: "Agregar"
  },
  showAdd: {
    type: Boolean,
    default: true
  }
});

defineEmits(["add"]);
</script>

<style scoped>
.profile-shell {
  margin-bottom: 1rem;
}

.profile-shell-surface {
  background: var(--brand-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--brand-shadow-soft);
  padding: 0 1rem 1rem;
}

.profile-shell-header {
  width: 97%;
  margin: 0 auto;
  transform: translateY(-28px);
  border-radius: 20px;
  background: var(--brand-white);
  color: var(--brand-navy);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.18);
  padding: 1rem 1.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: 0 12px 20px rgba(var(--brand-primary-rgb), 0.14);
}

.profile-shell-title {
  margin: 0;
  font-weight: 700;
  font-size: clamp(1.1rem, 2vw, 1.35rem);
}

.profile-shell-subtitle {
  margin: 0.2rem 0 0;
  color: var(--brand-ink);
  font-size: 0.92rem;
}

.profile-shell-body {
  margin-top: -0.6rem;
}

@media (max-width: 767px) {
  .profile-shell-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-shell-header .btn {
    width: 100%;
  }
}
</style>
