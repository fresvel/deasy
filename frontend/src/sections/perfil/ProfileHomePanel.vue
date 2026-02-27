<template>
  <div class="profile-home container-fluid py-4">
    <div class="card profile-home-card">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div class="d-flex align-items-center gap-3">
            <img class="profile-home-avatar" :src="photo" alt="Foto de perfil" />
            <div>
              <h4 class="mb-1">{{ displayName }}</h4>
              <p class="mb-0 profile-home-id">{{ currentUser?.email || currentUser?.cedula || "Sin identificador" }}</p>
            </div>
          </div>
        </div>

        <p class="profile-home-copy mb-3">
          Selecciona una sección para continuar con la gestión de tu dossier académico.
        </p>

        <div class="profile-home-grid">
          <button
            v-for="section in sectionCards"
            :key="section.label"
            class="profile-home-btn"
            type="button"
            @click="$emit('navigate-section', section.label)"
          >
            <span class="profile-home-btn-icon">
              <font-awesome-icon :icon="section.icon" />
            </span>
            <span class="profile-home-btn-content">
              <strong class="profile-home-btn-title">{{ section.label }}</strong>
              <span class="profile-home-btn-meta">{{ section.meta }}</span>
            </span>
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
  { label: "Formación", key: "formacion", icon: "certificate" },
  { label: "Experiencia", key: "experiencia", icon: "check-double" },
  { label: "Referencias", key: "referencias", icon: "id-card" },
  { label: "Capacitación", key: "capacitacion", icon: "square-check" },
  { label: "Certificación", key: "certificacion", icon: "check-circle" },
  { label: "Investigación", key: "investigacion", icon: "globe" }
];

const sectionCards = computed(() =>
  sections.map((section) => {
    const count = Number(props.dossierCounts?.[section.key] ?? 0);
    return {
      ...section,
      meta: `${count} ${count === 1 ? "registro" : "registros"}`
    };
  })
);

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

.profile-home-copy {
  color: var(--brand-muted);
  font-size: 1rem;
  line-height: 1.45;
}

.profile-home-id {
  color: var(--brand-muted);
  font-size: 0.92rem;
  line-height: 1.35;
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
  padding: 0.75rem 0.9rem;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--brand-navy);
  font-size: 0.95rem;
  min-height: 74px;
}

.profile-home-btn-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--brand-primary-rgb), 0.1);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.2);
  color: var(--brand-primary);
  flex: 0 0 auto;
}

.profile-home-btn-content {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.profile-home-btn-title {
  font-size: 1.03rem;
  line-height: 1.2;
  color: var(--brand-navy);
}

.profile-home-btn-meta {
  font-size: 0.86rem;
  opacity: 0.84;
  line-height: 1.2;
}

.profile-home-btn:hover {
  border-color: transparent;
  color: #fff;
  background: var(--brand-gradient);
}

.profile-home-btn:hover .profile-home-btn-title,
.profile-home-btn:hover .profile-home-btn-meta {
  color: #fff;
}

.profile-home-btn:hover .profile-home-btn-icon {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.26);
  color: #fff;
}

@media (max-width: 575px) {
  .profile-home-grid {
    grid-template-columns: 1fr;
  }
}
</style>
