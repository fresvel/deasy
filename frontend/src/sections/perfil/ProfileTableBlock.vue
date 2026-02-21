<template>
  <section class="profile-table-block">
    <div class="profile-table-block__surface">
      <header class="profile-table-block__header">
        <h3 class="profile-table-block__title">{{ title }}</h3>
      </header>
      <div class="profile-table-block__content">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { defineProps } from "vue";

defineProps({
  title: {
    type: String,
    required: true
  }
});
</script>

<style scoped>
.profile-table-block {
  margin-bottom: 1rem;
}

.profile-table-block__surface {
  background: var(--brand-white);
  border-radius: var(--radius-md);
  box-shadow: var(--brand-shadow-soft);
  padding: 0 0.9rem 0.9rem;
}

.profile-table-block__header {
  transform: translateY(-14px);
  background: var(--brand-gradient);
  color: var(--brand-white);
  border-radius: 14px;
  padding: 0.65rem 0.9rem;
  box-shadow: 0 10px 18px rgba(var(--brand-primary-rgb), 0.2);
}

.profile-table-block__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.profile-table-block__content {
  margin-top: -0.35rem;
}
</style>
