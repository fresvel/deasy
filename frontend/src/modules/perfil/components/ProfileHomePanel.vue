<template>
  <div class="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8 w-full flex flex-col font-sans">
    
    <AppPageHeader
      size="hero"
      shell-class="mb-8"
      eyebrow="Perfil académico"
      :title="displayName"
      description="Gestiona tu dossier académico y tu información profesional."
      avatar-media
      centered
      compact-actions
    >
      <template #media><img class="h-full w-full object-cover" :src="photo" alt="Foto de perfil" /></template>
      <template #actions>
        <button type="button" class="deasy-hero-back-button" @click="goBack">
          <span class="deasy-hero-back-button__icon"><IconArrowLeft class="h-4.5 w-4.5" /></span>
          <span>Volver atrás</span>
        </button>
      </template>
    </AppPageHeader>

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
import AppPageHeader from '@/shared/components/layout/AppPageHeader.vue';
import { useRouter } from "vue-router";
import AppNavCard from "@/shared/components/layout/AppNavCard.vue";
import {
  IconCertificate, IconChecks, IconId, IconSquareCheck, IconCircleCheck, IconGlobe, IconArrowLeft
} from '@tabler/icons-vue';
import { PROFILE_CONTEXT, PROFILE_SECTIONS, cardIconFor } from "@/modules/perfil/profileSections.js";

const router = useRouter();
/* 🪤 `photo` ES UN REF Y EN EL TEMPLATE NO LLEVA `.value`. El markup escribia
   `:src="photo.value"` y la foto NO SE VEIA NUNCA: `PerfilView` provee `photo: userPhoto`, que es
   un `ref`, y Vue **auto-desenvuelve** los refs devueltos por `setup` al usarlos en la plantilla.
   Asi que ahi `photo` YA es la URL y `photo.value` es `undefined` — Vue omite el atributo sin
   avisar y solo queda el texto alternativo. Visible desde siempre, invisible para el build, el
   lint y los 339 tests; lo caza mirar la pantalla, que es la norma de este repo para lo visual.
   (Encontrado el 2026-08-15 al verificar F3.4.) */
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
