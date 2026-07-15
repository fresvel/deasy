<template>
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

  <div v-else id="procesos" class="deasy-nav-group scroll-mt-24">

    <div v-if="menuLoading" class="deasy-nav-feedback deasy-nav-feedback--info my-2">
      Cargando menú...
    </div>
    <div v-else-if="menuError" class="deasy-nav-feedback deasy-nav-feedback--info my-2">
      {{ menuError }}
    </div>
    <div v-else-if="!menuCargos.length" class="deasy-nav-feedback deasy-nav-feedback--muted my-2">
      No hay cargos asignados para mostrar.
    </div>

    <div v-else class="deasy-nav-group mt-2">
      <!--
        Selector de UNIDAD. El aside solo muestra los cargos de UNA unidad, y al cargar se
        fija en userUnits[0]. Solo aparece con más de una unidad; con una sola no aporta nada.
      -->
      <div v-if="userUnits.length > 1" class="deasy-nav-shell mb-2">
        <div class="deasy-nav-section">
          <span class="deasy-nav-group-title block px-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Unidad
          </span>
          <AppButton
            v-for="unit in userUnits"
            :key="unit.id"
            variant="plain"
            class-name="deasy-nav-item"
            :class="{ 'deasy-nav-item--active': String(selectedGroupId) === String(unit.id) }"
            type="button"
            :title="unit.label || unit.name"
            @click="$emit('select-unit', unit)"
          >
            <span class="deasy-nav-item__label truncate">{{ unit.label || unit.name }}</span>
          </AppButton>
        </div>
      </div>

      <div class="deasy-nav-shell">
        <div v-for="cargo in menuCargos" :key="cargo.id" class="deasy-nav-section">
        <AppButton
          variant="plain"
          class-name="deasy-nav-group-title"
          :class="{ 'deasy-nav-item--subtle-active': cargo.open }"
          type="button"
          @click="$emit('toggle-cargo', cargo)"
        >
          <span class="flex items-center gap-3.5 text-base font-semibold">
            <span class="deasy-nav-glyph" :class="workspaceIconToneClass(cargoIconMeta(cargo).tone, 'deasy-nav-glyph')">
              <component :is="cargoIconMeta(cargo).icon" class="h-5 w-5 shrink-0" />
            </span>
            <span class="truncate">{{ cargo.name }}</span>
          </span>
        </AppButton>

        <div v-show="cargo.open" class="deasy-nav-tree">
          <AppButton
            v-for="process in cargo.processes"
            :key="process.id"
            variant="plain"
            class-name="deasy-nav-item"
            :class="selectedProcessKey === String(process.process_definition_id) ? 'deasy-nav-item--active' : ''"
            type="button"
            :title="routedMenuLabel(process)"
            @click="$emit('select-process', { process, cargo })"
          >
            <span
              class="deasy-nav-item__icon"
              :class="workspaceIconToneClass(processIconMeta(process).tone)"
            >
              <component :is="processIconMeta(process).icon" class="h-4.5 w-4.5 shrink-0" />
            </span>
            <span class="deasy-nav-item__label">{{ routedMenuLabel(process) }}</span>
            <span v-if="process.is_routed" class="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-600"><IconSend class="h-2.5 w-2.5" />Envíos</span>
          </AppButton>
          <div v-if="!cargo.processes.length" class="px-4 py-1 text-sm italic text-slate-400">
            Sin procesos asignados.
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Aside de navegación de /home: firmas (cuando la ruta es de firmas) o el árbol
// unidad → cargo → proceso. Extraído de HomeView.vue en la Fase C del refactor.
//
// Componente PRESENTACIONAL: recibe los datos como props y las funciones de display como
// props-función (patrón deliverableCardHelpers ya usado en el proyecto), y emite las acciones.
// Toda la lógica sigue en HomeView; aquí solo vive la plantilla del aside, aislada para poder
// rediseñarla sin tocar las 7000 líneas del padre.
import AppButton from '@/shared/components/buttons/AppButton.vue';
import { IconSend } from '@tabler/icons-vue';

defineProps({
  // Datos
  isGlobalSignatureRoute: { type: Boolean, default: false },
  signatureSidebarItems: { type: Array, default: () => [] },
  menuLoading: { type: Boolean, default: false },
  menuError: { type: String, default: '' },
  menuCargos: { type: Array, default: () => [] },
  userUnits: { type: Array, default: () => [] },
  selectedGroupId: { type: [Number, String], default: null },
  selectedProcessKey: { type: [Number, String], default: null },
  // Helpers de display (funciones puras/de presentación que HomeView ya posee)
  isSignatureSidebarItemActive: { type: Function, required: true },
  workspaceIconToneClass: { type: Function, required: true },
  cargoIconMeta: { type: Function, required: true },
  processIconMeta: { type: Function, required: true },
  routedMenuLabel: { type: Function, required: true },
});

defineEmits(['open-signature-item', 'select-unit', 'toggle-cargo', 'select-process']);
</script>
