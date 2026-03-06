<template>
  <details ref="menuRef" class="row-action-menu">
    <summary class="row-action-menu__trigger" aria-label="Acciones" title="Acciones">
      <font-awesome-icon icon="ellipsis-vertical" />
    </summary>

    <div class="row-action-menu__panel" role="menu" @click="handlePanelClick">
      <button class="row-action-menu__item row-action-menu__item--edit" type="button" @click="$emit('edit')">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="me-2"
          aria-hidden="true"
        >
          <path
            d="M11.4925 2.78906H7.75349C4.67849 2.78906 2.75049 4.96606 2.75049 8.04806V16.3621C2.75049 19.4441 4.66949 21.6211 7.75349 21.6211H16.5775C19.6625 21.6211 21.5815 19.4441 21.5815 16.3621V12.3341"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M8.82812 10.921L16.3011 3.44799C17.2321 2.51799 18.7411 2.51799 19.6721 3.44799L20.8891 4.66499C21.8201 5.59599 21.8201 7.10599 20.8891 8.03599L13.3801 15.545C12.9731 15.952 12.4211 16.181 11.8451 16.181H8.09912L8.19312 12.401C8.20712 11.845 8.43412 11.315 8.82812 10.921Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M15.1655 4.60254L19.7315 9.16854"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Editar
      </button>

      <button class="row-action-menu__item row-action-menu__item--delete" type="button" @click="$emit('delete')">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="me-2"
          aria-hidden="true"
        >
          <path
            d="M19.3248 9.46826C19.3248 9.46826 18.7818 16.2033 18.4668 19.0403C18.3168 20.3953 17.4798 21.1893 16.1088 21.2143C13.4998 21.2613 10.8878 21.2643 8.27979 21.2093C6.96079 21.1823 6.13779 20.3783 5.99079 19.0473C5.67379 16.1853 5.13379 9.46826 5.13379 9.46826"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M20.708 6.23975H3.75"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M17.4406 6.23973C16.6556 6.23973 15.9796 5.68473 15.8256 4.91573L15.5826 3.69973C15.4326 3.13873 14.9246 2.75073 14.3456 2.75073H10.1126C9.53358 2.75073 9.02558 3.13873 8.87558 3.69973L8.63258 4.91573C8.47858 5.68473 7.80258 6.23973 7.01758 6.23973"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
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