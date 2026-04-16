<template>
  <div class="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 w-full flex flex-col font-sans">
    
    <!-- User Context Card -->
    <div class="deasy-page-intro mb-8 transition-shadow hover:shadow-md">
      <div class="deasy-page-intro__layout items-center text-center sm:text-left">
      <div class="flex flex-col items-center gap-3 shrink-0">
        <img class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shadow-sm bg-slate-100" :src="photo" alt="Foto de perfil" />
        <div v-if="signatureMarker" class="max-w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Token firma</p>
          <p class="mt-1 break-all font-mono text-xs text-slate-700">{{ signatureMarker }}</p>
        </div>
      </div>
      <div class="deasy-page-intro__body mt-2 flex flex-col justify-center sm:mt-0">
        <h4 class="deasy-page-intro__title">{{ displayName }}</h4>
        <p class="deasy-page-intro__meta">{{ currentUser?.email || currentUser?.cedula || "Sin identificador" }}</p>
        <p class="deasy-page-intro__description">
          Selecciona una sección para continuar con la gestión de tu dossier académico y actualizar tu información profesional.
        </p>
      </div>
      </div>
    </div>

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
  IconCertificate, IconChecks, IconId, IconSquareCheck, IconCircleCheck, IconGlobe 
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

defineEmits(["navigate-section"]);

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

const signatureMarker = computed(() => {
  if (props.currentUser?.signatureMarker) {
    return props.currentUser.signatureMarker;
  }

  const rawToken = props.currentUser?.signatureToken ?? props.currentUser?.token ?? "";
  return rawToken ? `!-${rawToken}-!` : "";
});
</script>

<style scoped>
/* Scoped styles removed in favor of Tailwind CSS */
</style>
