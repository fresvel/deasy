<template>
  <div class="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 w-full flex flex-col font-sans">
    
    <section class="deasy-hero-shell mb-8">
      <div class="deasy-hero-layout">
        <div class="deasy-hero-main deasy-hero-main--with-media text-center sm:text-left">
          <div class="deasy-hero-media flex flex-col items-center gap-3 sm:items-start">
            <div class="deasy-hero-media-card deasy-hero-media-card--avatar">
              <img class="h-16 w-16 rounded-[1rem] object-cover bg-white/70 sm:h-[4.5rem] sm:w-[4.5rem]" :src="photo.value" alt="Foto de perfil" />
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
          <button type="button" class="deasy-hero-back-button" @click="goBack">
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
      <!-- Cada tarjeta navega a la ruta de su seccion. Antes emitia la ETIQUETA al padre, que la
           comparaba contra su propio menu: si las dos listas divergian, el clic se tragaba en silencio. -->
      <AppNavCard
        v-for="section in sectionCards"
        :key="section.slug"
        layout="stacked"
        :title="section.label"
        :description="section.meta"
        :icon="getIcon(section.cardIcon)"
        icon-class="w-6 h-6 stroke-[1.5]"
        show-arrow
        class-name="min-h-[140px]"
        @click="router.push({ name: section.name })"
      />
    </div>
  </div>
</template>

<script setup>
/**
 * Inicio del dossier: es la ruta hija por defecto de /perfil.
 *
 * Ya no recibe props ni emite: como lo monta el <router-view> de PerfilView, el contexto le llega por
 * inject y navega por su cuenta. Su lista propia de secciones tambien desaparecio: era una copia a mano
 * del menu lateral, y el acuerdo entre ambas era una etiqueta con tilde. Ahora las dos leen
 * PROFILE_SECTIONS.
 */
import { computed, inject } from "vue";
import { useRouter } from "vue-router";
import AppNavCard from "@/shared/components/layout/AppNavCard.vue";
import {
  IconCertificate, IconChecks, IconId, IconSquareCheck, IconCircleCheck, IconGlobe, IconArrowLeft
} from '@tabler/icons-vue';
import { PROFILE_CONTEXT, PROFILE_SECTIONS, cardIconFor } from "@/modules/perfil/profileSections.js";

const router = useRouter();
const { currentUser, photo, dossierCounts, goBack } = inject(PROFILE_CONTEXT);

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

const sectionCards = computed(() =>
  PROFILE_SECTIONS.map((section) => {
    const count = Number(dossierCounts.value?.[section.countKey] ?? 0);
    return {
      ...section,
      cardIcon: cardIconFor(section),
      meta: section.countKey
        ? `${count} ${count === 1 ? "registro" : "registros"}`
        : "Gestiona tus certificados digitales"
    };
  })
);

const displayName = computed(() => {
  const firstName = currentUser.value?.first_name ?? "";
  const lastName = currentUser.value?.last_name ?? "";
  return `${firstName} ${lastName}`.trim() || "Usuario";
});
</script>

<style scoped>
/* Scoped styles removed in favor of Tailwind CSS */
</style>
