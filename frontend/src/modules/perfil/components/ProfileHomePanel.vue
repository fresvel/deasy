<template>
  <div class="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 w-full flex flex-col font-sans">
    
    <section class="deasy-hero-shell mb-8">
      <div class="deasy-hero-layout">
        <div class="deasy-hero-main deasy-hero-main--with-media text-center sm:text-left">
          <div class="deasy-hero-media flex flex-col items-center gap-3 sm:items-start">
            <div class="deasy-hero-media-card deasy-hero-media-card--avatar">
              <img class="h-24 w-24 rounded-[1.3rem] object-cover bg-white/70 sm:h-28 sm:w-28" :src="photo" alt="Foto de perfil" />
            </div>
          </div>
          <div class="deasy-hero-copy sm:pt-1">
            <div class="deasy-hero-kicker">Perfil académico</div>
            <h1 class="deasy-hero-title">{{ displayName }}</h1>
            <p class="deasy-hero-meta">{{ currentUser?.email || currentUser?.cedula || "Sin identificador" }}</p>
            <p class="deasy-hero-description">
              Selecciona una sección para continuar con la gestión de tu dossier académico y actualizar tu información profesional.
            </p>
          </div>
        </div>
        <div class="deasy-hero-side deasy-hero-side--compact xl:text-right">
          <article v-for="card in profileHeroCards" :key="card.label" class="deasy-hero-stat-card" :class="card.wide ? 'sm:col-span-2' : ''">
            <div class="deasy-hero-stat-card__lead">
              <span class="deasy-hero-stat-card__icon">
                <component :is="getIcon(card.icon)" class="h-5 w-5" />
              </span>
              <div class="deasy-hero-stat-card__body">
                <span class="deasy-hero-stat-card__eyebrow">{{ card.label }}</span>
                <span class="deasy-hero-stat-card__title">{{ card.title }}</span>
              </div>
            </div>
            <span class="max-w-40 break-all text-right text-sm font-bold leading-tight text-[#21517a]">
              {{ card.value }}
            </span>
          </article>
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

const totalRecords = computed(() =>
  Object.values(props.dossierCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0)
);

const profileHeroCards = computed(() => [
  {
    label: 'Perfil',
    title: 'Secciones',
    value: sectionCards.value.length,
    icon: 'id-card'
  },
  {
    label: 'Dossier',
    title: 'Registros',
    value: totalRecords.value,
    icon: 'check-double'
  },
  {
    label: 'Firma',
    title: signatureMarker.value ? 'Token activo' : 'Token pendiente',
    value: signatureMarker.value || 'Pend.',
    icon: 'certificate',
    wide: true
  }
]);

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
