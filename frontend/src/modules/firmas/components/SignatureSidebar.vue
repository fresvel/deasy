<template>
  <div class="deasy-nav-group scroll-mt-24">
    <div class="deasy-nav-group mt-2">
      <div class="deasy-nav-shell">
        <div class="deasy-nav-section">
          <button
            v-for="item in items"
            :key="item.key"
            type="button"
            class="deasy-nav-item"
            :class="isActive(item) ? 'deasy-nav-item--active' : ''"
            :title="item.label"
            @click="$emit('open-item', item)"
          >
            <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(item.tone || 'sky')">
              <component :is="item.icon" class="h-4.5 w-4.5 shrink-0" />
            </span>
            <span class="deasy-nav-item__label">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Aside del centro de firmas: navega entre las secciones de /firmas.
 *
 * Era la variante `isGlobalSignatureRoute` de HomeSidebar. Vivia ahi porque las dos pantallas
 * compartian componente; al tener el centro de firmas ruta y vista propias, el aside se va con el.
 * HomeSidebar se queda solo con los accesos directos del espacio de trabajo, sin el booleano que
 * decidia cual de las dos era.
 */
defineProps({
  items: { type: Array, default: () => [] },
  /** Predicado de seleccion: hoy compara el hash de la ruta con el del item. */
  isActive: { type: Function, required: true },
  workspaceIconToneClass: { type: Function, required: true }
});

defineEmits(["open-item"]);
</script>
