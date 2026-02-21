<template>
  <div class="profile-home container-fluid py-4">
    <div class="card profile-home-card">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div class="d-flex align-items-center gap-3">
            <img class="profile-home-avatar" :src="photo" alt="Foto de perfil" />
            <div>
              <h4 class="mb-1">{{ displayName }}</h4>
              <p class="mb-0 text-muted">{{ currentUser?.email || currentUser?.cedula || "Sin identificador" }}</p>
            </div>
          </div>
          <div class="profile-home-badge">
            Perfil
          </div>
        </div>

        <p class="profile-home-copy mb-3">
          Selecciona una sección para continuar con la gestión de tu dossier académico.
        </p>

        <div class="profile-home-grid">
          <button
            v-for="section in sections"
            :key="section.label"
            class="profile-home-btn"
            type="button"
            @click="$emit('navigate-section', section.label)"
          >
            <span>{{ section.label }}</span>
            <strong>{{ dossierCounts?.[section.key] ?? 0 }}</strong>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from "vue";

const props = defineProps({
  currentUser: {
    type: Object,
    default: null
  },
  photo: {
    type: String,
    default: "/images/avatar.png"
  },
  dossierCounts: {
    type: Object,
    default: () => ({})
  }
});

defineEmits(["navigate-section"]);

const sections = [
  { label: "Formación", key: "formacion" },
  { label: "Experiencia", key: "experiencia" },
  { label: "Referencias", key: "referencias" },
  { label: "Capacitación", key: "capacitacion" },
  { label: "Certificación", key: "certificacion" }
];

const displayName = computed(() => {
  const firstName = props.currentUser?.first_name ?? "";
  const lastName = props.currentUser?.last_name ?? "";
  return `${firstName} ${lastName}`.trim() || "Usuario";
});
</script>

<style scoped>
.profile-home-card {
  border: 0;
  border-radius: var(--radius-lg);
}

.profile-home-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-home-badge {
  background: rgba(var(--brand-primary-rgb), 0.1);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.2);
  color: var(--brand-ink);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 700;
}

.profile-home-copy {
  color: var(--brand-muted);
}

.profile-home-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.profile-home-btn {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.15);
  border-radius: 12px;
  background: #fff;
  padding: 0.7rem 0.9rem;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--brand-navy);
  font-size: 0.95rem;
}

.profile-home-btn strong {
  color: var(--brand-accent);
}

.profile-home-btn:hover {
  border-color: transparent;
  color: #fff;
  background: var(--brand-gradient);
}

.profile-home-btn:hover strong {
  color: #fff;
}

@media (max-width: 575px) {
  .profile-home-grid {
    grid-template-columns: 1fr;
  }
}
</style>
