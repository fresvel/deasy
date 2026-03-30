<template>
  <details ref="menuRef" class="row-action-menu">
    <summary class="row-action-menu__trigger" aria-label="Acciones" title="Acciones">
      <font-awesome-icon icon="ellipsis-vertical" />
    </summary>

    <div class="row-action-menu__panel" role="menu" @click="handlePanelClick">
      <button class="row-action-menu__item row-action-menu__item--edit" type="button" @click="$emit('edit')">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.493 2.79h-3.74c-3.075 0-5.003 2.176-5.003 5.258v8.314c0 3.082 1.92 5.26 5.003 5.26h8.825c3.085 0 5.003-2.178 5.003-5.26v-4.028"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m8.828 10.921 7.473-7.473c.931-.93 2.44-.93 3.371 0l1.217 1.217a2.383 2.383 0 0 1 0 3.371l-7.509 7.509a2.17 2.17 0 0 1-1.535.636H8.1l.094-3.78a2.17 2.17 0 0 1 .635-1.48" clip-rule="evenodd"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m15.166 4.603 4.566 4.566"/></svg>
        Editar
      </button>

      <button class="row-action-menu__item row-action-menu__item--delete" type="button" @click="$emit('delete')">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.325 9.468s-.543 6.735-.858 9.572c-.15 1.355-.987 2.15-2.358 2.174-2.61.047-5.221.05-7.83-.005-1.318-.027-2.141-.83-2.288-2.162-.317-2.862-.857-9.579-.857-9.579M20.708 6.24H3.75m13.69 0a1.65 1.65 0 0 1-1.614-1.324L15.583 3.7a1.28 1.28 0 0 0-1.237-.95h-4.233a1.28 1.28 0 0 0-1.237.95l-.243 1.216A1.65 1.65 0 0 1 7.018 6.24"/></svg>
        Eliminar
      </button>
    </div>
  </details>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

defineEmits(["edit", "delete"]);

const menuRef = ref(null);

const closeMenu = () => {
  if (menuRef.value) {
    menuRef.value.open = false;
  }
};

const handleOutsidePointer = (event) => {
  if (!menuRef.value?.open) return;
  if (menuRef.value.contains(event.target)) return;
  closeMenu();
};

const handleKeydown = (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
};

const handlePanelClick = (event) => {
  if (event.target.closest("button")) {
    closeMenu();
  }
};

onMounted(() => {
  document.addEventListener("pointerdown", handleOutsidePointer);
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleOutsidePointer);
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<style scoped>
.row-action-menu {
  position: relative;
  display: inline-block;
}

.row-action-menu__trigger {
  list-style: none;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 999px;
  border: 1px solid rgba(var(--brand-primary-rgb), 0.22);
  background: var(--brand-white);
  color: var(--brand-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.row-action-menu__trigger::-webkit-details-marker {
  display: none;
}

.row-action-menu__trigger::marker {
  content: "";
}

.row-action-menu__trigger:hover,
.row-action-menu[open] .row-action-menu__trigger {
  background: rgba(var(--brand-primary-rgb), 0.08);
  border-color: rgba(var(--brand-primary-rgb), 0.4);
}

.row-action-menu__panel {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 10.5rem;
  padding: 0.35rem;
  border-radius: 14px;
  background: var(--brand-white);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.14);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
  z-index: 20;
}

.row-action-menu__item {
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  color: #1f2933;
  font-weight: 500;
  text-align: left;
}

.row-action-menu__item:hover {
  background: rgba(var(--brand-primary-rgb), 0.08);
}

.row-action-menu__item--delete {
  color: #b42318;
}

.row-action-menu__item--delete:hover {
  background: rgba(180, 35, 24, 0.08);
}
</style>
