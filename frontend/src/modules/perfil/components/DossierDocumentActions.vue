<template>
  <div class="inline-flex items-center gap-1">

    <!-- Editar registro -->
    <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-edit" title="Editar"
      @click="$emit('edit')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M16.862 4.487 18.549 2.8a1.875 1.875 0 1 1 2.651 2.651L8.093 17.56a4.5 4.5 0 0 1-1.897 1.13l-2.685.805.806-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z" />
      </svg>
    </AdminButton>

    <!-- Gestión de PDF -->
    <div class="relative" ref="pdfBtnRef">
      <AdminButton variant="secondary" size="sm" icon-only
        :class-name="hasDocument ? 'hope-action-btn hope-action-pdf has-doc' : 'hope-action-btn hope-action-pdf'"
        :title="hasDocument ? 'Gestionar PDF' : 'Subir PDF'" @click.stop="showModal = true">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <span v-if="hasDocument" class="pdf-indicator"></span>
      </AdminButton>

      <Teleport to="body">
        <Transition name="modal-fade">
          <div v-if="showModal" class="modal-overlay" @click="closeModal">
            <div class="modal-content" @click.stop>
              <h3 class="modal-title">Gestión de PDF</h3>

              <template v-if="hasDocument">
                <button class="modal-btn" @click="doAction('preview')">Ver PDF</button>
                <button class="modal-btn" @click="doAction('upload')">Actualizar PDF</button>
                <button class="modal-btn danger" @click="doAction('delete-document')">Eliminar PDF</button>
              </template>

              <template v-else>
                <button class="modal-btn" @click="doAction('upload')">Subir PDF</button>
              </template>

              <button class="modal-close" @click="closeModal">Cancelar</button>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>

    <!-- Eliminar registro completo -->
    <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-delete"
      title="Eliminar registro" @click="$emit('delete')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M19.325 9.468s-.543 6.735-.858 9.572c-.15 1.355-.987 2.15-2.358 2.174-2.61.047-5.221.05-7.83-.005-1.318-.027-2.141-.83-2.288-2.162-.317-2.862-.857-9.579-.857-9.579M20.708 6.24H3.75m13.69 0a1.65 1.65 0 0 1-1.614-1.324L15.583 3.7a1.28 1.28 0 0 0-1.237-.95h-4.233a1.28 1.28 0 0 0-1.237.95l-.243 1.216A1.65 1.65 0 0 1 7.018 6.24" />
      </svg>
    </AdminButton>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import AdminButton from "@/modules/admin/components/ui/AdminButton.vue";

defineProps({
  hasDocument: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["edit", "preview", "upload", "delete", "delete-document"]);

const showModal = ref(false);
const pdfBtnRef = ref(null);

const closeModal = () => {
  showModal.value = false;
};

const doAction = (action) => {
  showModal.value = false;
  emit(action);
};
</script>

<style scoped>
.hope-action-pdf {
  position: relative;
}

.pdf-indicator {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  border: 1.5px solid white;
  pointer-events: none;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 20px;
  width: 260px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.modal-title {
  font-size: 16px;
  margin-bottom: 12px;
  font-weight: 600;
}

.modal-btn {
  width: 100%;
  padding: 8px;
  margin: 5px 0;
  border: none;
  border-radius: 8px;
  background: #f1f5f9;
  cursor: pointer;
  transition: 0.2s;
}

.modal-btn:hover {
  background: #e2e8f0;
}

.modal-btn.danger {
  background: #fee2e2;
  color: #dc2626;
}

.modal-btn.danger:hover {
  background: #fecaca;
}

.modal-close {
  margin-top: 10px;
  font-size: 12px;
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>