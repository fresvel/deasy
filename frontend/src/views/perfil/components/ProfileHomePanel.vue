<template>
  <div class="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 w-full flex flex-col font-sans">
    
    <!-- User Context Card -->
    <div class="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left transition-shadow hover:shadow-md">
      <div class="flex flex-col items-center gap-3 shrink-0">
        <img class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shadow-sm bg-slate-100" :src="photo" alt="Foto de perfil" />
        <div v-if="signatureMarker" class="max-w-[14rem] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Token firma</p>
          <p class="mt-1 break-all font-mono text-xs text-slate-700">{{ signatureMarker }}</p>
        </div>
      </div>
      <div class="flex-1 flex flex-col justify-center mt-2 sm:mt-0">
        <h4 class="text-2xl font-bold text-slate-800 mb-1 tracking-tight">{{ displayName }}</h4>
        <p class="text-sm font-medium text-slate-500 mb-3">{{ currentUser?.email || currentUser?.cedula || "Sin identificador" }}</p>
        <p class="text-slate-600 leading-relaxed text-sm max-w-2xl bg-sky-50/50 p-4 rounded-xl border border-sky-100">
          Selecciona una sección para continuar con la gestión de tu dossier académico y actualizar tu información profesional.
        </p>
      </div>
    </div>

    <!-- Sections Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AppButton
        v-for="section in sectionCards"
        :key="section.label"
        variant="plain"
        class-name="group bg-white rounded-xl border border-slate-200 p-5 text-left flex items-start gap-4 transition-all hover:border-sky-200 hover:shadow-md hover:shadow-sky-100/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 hover:-translate-y-1"
        type="button"
        @click="$emit('navigate-section', section.label)"
      >
        <span class="w-12 h-12 flex-shrink-0 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors">
          <component :is="getIcon(section.icon)" class="w-6 h-6 stroke-[1.5]" />
        </span>
        <span class="flex flex-col flex-1 min-w-0 pt-0.5">
          <strong class="text-slate-800 font-bold text-base block truncate group-hover:text-sky-700 transition-colors">{{ section.label }}</strong>
          <span class="text-slate-500 text-sm font-medium mt-1 inline-flex items-center gap-1.5 opacity-80">
            <span class="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors"></span>
            {{ section.meta }}
          </span>
        </span>
      </AppButton>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from "vue";
import AppButton from "@/components/AppButton.vue";
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
