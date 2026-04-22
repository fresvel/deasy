<template>
  <div class="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 w-full flex flex-col font-sans">
    
    <section class="deasy-hero-shell mb-8">
      <div class="deasy-hero-layout">
        <div class="deasy-hero-main deasy-hero-main--with-media text-center sm:text-left">
          <div class="deasy-hero-media flex flex-col items-center gap-3 sm:items-start">
            <div class="deasy-hero-media-card deasy-hero-media-card--avatar">
              <img class="h-16 w-16 rounded-[1rem] object-cover bg-white/70 sm:h-[4.5rem] sm:w-[4.5rem]" :src="photo" alt="Foto de perfil" />
            </div>
          </div>
          <div class="deasy-hero-copy sm:pt-0">
            <div class="deasy-hero-kicker">Perfil académico</div>
            <h1 class="deasy-hero-title">{{ displayName }}</h1>
            <p class="deasy-hero-description">
              Gestiona tu dossier académico y tu información profesional.
            </p>
          </div>
        </div>
        <div class="deasy-hero-side deasy-hero-side--compact">
          <button type="button" class="deasy-hero-back-button" @click="$emit('go-back')">
            <span class="deasy-hero-back-button__icon">
              <IconArrowLeft class="h-4.5 w-4.5" />
            </span>
            <span>Volver atrás</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Sections Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AppNavCard
        v-for="section in sectionCards"
        :key="section.label"
        layout="stacked"
        :title="section.label"
        :description="section.meta"
        :icon="getIcon(section.icon)"
        icon-class="w-6 h-6 stroke-[1.5]"
        show-arrow
        class-name="min-h-[140px]"
        @click="$emit('navigate-section', section.label)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from "vue";
import AppNavCard from "@/shared/components/layout/AppNavCard.vue";
import { 
  IconCertificate, IconChecks, IconId, IconSquareCheck, IconCircleCheck, IconGlobe, IconArrowLeft
} from '@tabler/icons-vue';

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

defineEmits(["navigate-section", "go-back"]);

const getIcon = (name) => {
  const map = {
    'certificate': IconCertificate,
    'check-double': IconChecks,
    'id-card': IconId,
    'square-check': IconSquareCheck,
    'check-circle': IconCircleCheck,
    'globe': IconGlobe
  };
  return map[name] || IconCircleCheck;
};

const sections = [
  { label: "Formación", key: "formacion", icon: "certificate" },
  { label: "Experiencia", key: "experiencia", icon: "check-double" },
  { label: "Referencias", key: "referencias", icon: "id-card" },
  { label: "Capacitación", key: "capacitacion", icon: "square-check" },
  { label: "Certificación", key: "certificacion", icon: "check-circle" },
  { label: "Investigación", key: "investigacion", icon: "globe" },
  { label: "Certificados de firma", key: null, icon: "id-card" }
];

const sectionCards = computed(() =>
  sections.map((section) => {
    const count = Number(props.dossierCounts?.[section.key] ?? 0);
    return {
      ...section,
      meta: section.key ? `${count} ${count === 1 ? "registro" : "registros"}` : "Gestiona tus certificados digitales"
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
/* Scoped styles removed in favor of Tailwind CSS */
</style>
