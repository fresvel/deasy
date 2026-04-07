<template>
  <div class="d-inline-flex align-items-center gap-1">
    <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-edit" title="Editar"
      @click="$emit('edit')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M16.862 4.487 18.549 2.8a1.875 1.875 0 1 1 2.651 2.651L8.093 17.56a4.5 4.5 0 0 1-1.897 1.13l-2.685.805.806-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z" />
      </svg>
    </AdminButton>
    <AdminButton v-if="hasDocument" variant="secondary" size="sm" icon-only
      class-name="hope-action-btn hope-action-view" title="Ver PDF" @click="$emit('preview')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 17.25H7.5A2.25 2.25 0 0 1 5.25 15V6.75A2.25 2.25 0 0 1 7.5 4.5h6A2.25 2.25 0 0 1 15.75 6.75V9" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M8.25 8.25h4.5M8.25 11.25h2.25" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M22.5 16.5s-2.625 4.5-6.75 4.5S9 16.5 9 16.5 11.625 12 15.75 12s6.75 4.5 6.75 4.5Z" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M15.75 18.375a1.875 1.875 0 1 0 0-3.75 1.875 1.875 0 0 0 0 3.75Z" />
      </svg>
    </AdminButton>
    <AdminButton v-if="hasDocument" variant="secondary" size="sm" icon-only
      class-name="hope-action-btn hope-action-download" title="Descargar PDF" @click="$emit('download')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M12 3.75v10.5" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="m16.5 9.75-4.5 4.5-4.5-4.5" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M4.5 15.75v.75A2.25 2.25 0 0 0 6.75 18.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-.75" />
      </svg>
    </AdminButton>
    <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-upload"
      :title="hasDocument ? 'Actualizar PDF' : 'Subir PDF'" @click="$emit('upload')">
      <svg v-if="hasDocument" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true"
        viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M20.25 12A8.25 8.25 0 1 1 18 6.3" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M20.25 4.5v4.5h-4.5" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true"
        viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M12 15.75V5.25" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="m7.5 9.75 4.5-4.5 4.5 4.5" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M4.5 15.75v1.5A2.25 2.25 0 0 0 6.75 19.5h10.5a2.25 2.25 0 0 0 2.25-2.25v-1.5" />
      </svg>
    </AdminButton>
    <AdminButton v-if="hasDocument" variant="secondary" size="sm" icon-only
      class-name="hope-action-btn hope-action-delete-pdf" title="Eliminar solo PDF" @click="$emit('delete-document')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 17.25H7.5A2.25 2.25 0 0 1 5.25 15V6.75A2.25 2.25 0 0 1 7.5 4.5h6A2.25 2.25 0 0 1 15.75 6.75V9" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="m14.25 15.75 3 3m0-3-3 3" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M17.25 12.75a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    </AdminButton>
    <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-delete"
      title="Eliminar registro completo" @click="$emit('delete')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M19.325 9.468s-.543 6.735-.858 9.572c-.15 1.355-.987 2.15-2.358 2.174-2.61.047-5.221.05-7.83-.005-1.318-.027-2.141-.83-2.288-2.162-.317-2.862-.857-9.579-.857-9.579M20.708 6.24H3.75m13.69 0a1.65 1.65 0 0 1-1.614-1.324L15.583 3.7a1.28 1.28 0 0 0-1.237-.95h-4.233a1.28 1.28 0 0 0-1.237.95l-.243 1.216A1.65 1.65 0 0 1 7.018 6.24" />
      </svg>
    </AdminButton>
  </div>
</template>

<script setup>
import AdminButton from "@/views/admin/components/AdminButton.vue";

defineProps({
  hasDocument: {
    type: Boolean,
    default: false
  }
});

defineEmits(["edit", "preview", "download", "upload", "delete", "delete-document"]);
</script>
