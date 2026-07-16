<template>
  <!-- Variante FIRMAS: en /home/firmas el aside navega las secciones del centro de firmas. -->
  <div v-if="isGlobalSignatureRoute" class="deasy-nav-group scroll-mt-24">
    <div class="deasy-nav-group mt-2">
      <div class="deasy-nav-shell">
        <div class="deasy-nav-section">
          <button
            v-for="item in signatureSidebarItems"
            :key="item.key"
            type="button"
            class="deasy-nav-item"
            :class="isSignatureSidebarItemActive(item) ? 'deasy-nav-item--active' : ''"
            :title="item.label"
            @click="$emit('open-signature-item', item)"
          >
            <span
              class="deasy-nav-item__icon"
              :class="workspaceIconToneClass(item.tone || 'sky')"
            >
              <component :is="item.icon" class="h-4.5 w-4.5 shrink-0" />
            </span>
            <span class="deasy-nav-item__label">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Variante HOME: accesos directos a las secciones del espacio de trabajo. -->
  <div v-else id="procesos" class="deasy-nav-group scroll-mt-24">
    <div v-if="menuLoading" class="deasy-nav-feedback deasy-nav-feedback--info my-2">
      Cargando menú...
    </div>
    <div v-else-if="menuError" class="deasy-nav-feedback deasy-nav-feedback--info my-2">
      {{ menuError }}
    </div>

    <div v-else class="deasy-nav-group mt-2">
      <div class="deasy-nav-shell">
        <div class="deasy-nav-section">
          <button
            v-for="item in accessItems"
            :key="item.key"
            type="button"
            class="deasy-nav-item"
            :title="item.label"
            @click="$emit('open-section', item.key)"
          >
            <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(item.tone)">
              <component :is="item.icon" class="h-4.5 w-4.5 shrink-0" />
            </span>
            <span class="deasy-nav-item__label">{{ item.label }}</span>
            <span
              v-if="item.badge"
              class="ml-auto inline-flex shrink-0 items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-600"
            >{{ item.badge }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Aside de /home: ACCESOS DIRECTOS a las secciones del espacio de trabajo.
//
// Rediseño (decisión de producto): el aside deja de navegar unidad → cargo → proceso. Esa
// navegación ya la hace MEJOR la página consolidada "Mis procesos" (pestañas por unidad +
// multi-selección de procesos), y tener las dos competía: el aside solo mostraba UNA unidad
// (se quedaba fija en la primera) mientras la página las muestra todas. Ahora cada uno hace
// una cosa: el aside lleva a la sección, la página navega dentro de ella.
//
// Los destinos son los mismos que las tarjetas del dashboard, así que el usuario tiene el
// atajo sin salir de donde esté. La variante de firmas (en /home/firmas) se conserva.
import { computed } from 'vue';
import {
  IconChecklist,
  IconSignature,
  IconSend,
  IconFileDescription,
  IconUserCheck,
  IconBriefcase,
  IconBuildingMonument,
} from '@tabler/icons-vue';

const props = defineProps({
  isGlobalSignatureRoute: { type: Boolean, default: false },
  signatureSidebarItems: { type: Array, default: () => [] },
  menuLoading: { type: Boolean, default: false },
  menuError: { type: String, default: '' },
  // Contadores opcionales para las insignias (envíos pendientes, documentos accesibles...).
  sendsCount: { type: Number, default: 0 },
  isSignatureSidebarItemActive: { type: Function, required: true },
  workspaceIconToneClass: { type: Function, required: true },
});

// Espejo de las tarjetas del dashboard: mismas secciones, mismo orden.
const accessItems = computed(() => ([
  { key: 'processes', label: 'Mis procesos', icon: IconChecklist, tone: 'sky' },
  { key: 'signatures', label: 'Centro de firmas', icon: IconSignature, tone: 'sky' },
  { key: 'sends', label: 'Mis envíos', icon: IconSend, tone: 'indigo', badge: props.sendsCount || null },
  { key: 'documents', label: 'Centro documental', icon: IconFileDescription, tone: 'sky' },
  { key: 'dossier', label: 'Mi dossier', icon: IconUserCheck, tone: 'emerald' },
  { key: 'cargos', label: 'Mis cargos', icon: IconBriefcase, tone: 'amber' },
  { key: 'units', label: 'Mis unidades', icon: IconBuildingMonument, tone: 'amber' },
]));

defineEmits(['open-signature-item', 'open-section']);
</script>
