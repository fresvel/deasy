<template>
  <!-- Llevaba `d-inline-flex align-items-center` de BOOTSTRAP, clases que no existen en este
       proyecto: el div era un bloque normal y su `gap` no hacia nada, asi que la fila nunca fue
       flex. El `gap-2` sustituye ademas al `margin: 0 0.15rem` que cada boton se ponia a si
       mismo — el espacio entre hermanos lo pone el contenedor. -->
  <div class="inline-flex items-center gap-2">
    <AdminButton
      variant="softSuccess"
      size="sm"
      icon-only
      :title="canEdit ? 'Editar' : 'No tienes permiso para editar este registro'"
      :aria-label="canEdit ? 'Editar' : 'Edicion bloqueada por permisos'"
      :disabled="!canEdit"
      @click="$emit('edit')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M16.862 4.487 18.549 2.8a1.875 1.875 0 1 1 2.651 2.651L8.093 17.56a4.5 4.5 0 0 1-1.897 1.13l-2.685.805.806-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z" />
      </svg>
    </AdminButton>
    <AdminButton v-if="hasDocument" variant="softInfo" size="sm" icon-only
      title="Ver PDF" @click="$emit('preview')">
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
    <AdminButton v-if="hasDocument" variant="softActionUpload" size="sm" icon-only
      title="Descargar PDF" @click="$emit('download')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M12 3.75v10.5" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="m16.5 9.75-4.5 4.5-4.5-4.5" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M4.5 15.75v.75A2.25 2.25 0 0 0 6.75 18.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-.75" />
      </svg>
    </AdminButton>
    <AdminButton variant="softActionUpload" size="sm" icon-only 
      :title="canUpload ? (hasDocument ? 'Actualizar PDF' : 'Subir PDF') : 'No tienes permiso para subir o actualizar PDFs'"
      :aria-label="canUpload ? (hasDocument ? 'Actualizar PDF' : 'Subir PDF') : 'Subida bloqueada por permisos'"
      :disabled="!canUpload"
      @click="$emit('upload')">
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
    <AdminButton v-if="hasDocument" variant="softWarning" size="sm" icon-only
      :title="canDeleteDocument ? 'Eliminar solo PDF' : 'No tienes permiso para eliminar PDFs'"
      :aria-label="canDeleteDocument ? 'Eliminar solo PDF' : 'Eliminacion de PDF bloqueada por permisos'"
      :disabled="!canDeleteDocument"
      @click="$emit('delete-document')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 17.25H7.5A2.25 2.25 0 0 1 5.25 15V6.75A2.25 2.25 0 0 1 7.5 4.5h6A2.25 2.25 0 0 1 15.75 6.75V9" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="m14.25 15.75 3 3m0-3-3 3" />
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M17.25 12.75a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    </AdminButton>
    <AdminButton variant="softDanger" size="sm" icon-only 
      :title="canDelete ? 'Eliminar registro completo' : 'No tienes permiso para eliminar registros'"
      :aria-label="canDelete ? 'Eliminar registro completo' : 'Eliminacion bloqueada por permisos'"
      :disabled="!canDelete"
      @click="$emit('delete')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M19.325 9.468s-.543 6.735-.858 9.572c-.15 1.355-.987 2.15-2.358 2.174-2.61.047-5.221.05-7.83-.005-1.318-.027-2.141-.83-2.288-2.162-.317-2.862-.857-9.579-.857-9.579M20.708 6.24H3.75m13.69 0a1.65 1.65 0 0 1-1.614-1.324L15.583 3.7a1.28 1.28 0 0 0-1.237-.95h-4.233a1.28 1.28 0 0 0-1.237.95l-.243 1.216A1.65 1.65 0 0 1 7.018 6.24" />
      </svg>
    </AdminButton>
  </div>
</template>

<script setup>
/* [F1.3 2026-08-14] Este era el UNICO importador de `admin/components/ui/AdminButton.vue`, un
   fork de 88 lineas de `AppButton` que se quedo sin recibir tres arreglos:
     · estampaba `emerald-600` y `red-600` crudos en sus variantes de exito y peligro — 3.65:1
       contra su propio texto blanco, que NO llega al 4.5 de AA;
     · repetia el `mapa[clave] || clave` que manda una variante desconocida al DOM como clase
       literal, con `plain: ""` cayendo en el mismo agujero por ser falsy;
     · y en modo icono estampaba ademas `px-3 py-2 text-sm`, utilidades que GANAN al `p-0` de
       `deasy-btn--icon` porque `@layer utilities` va despues de `components`.
   Ese tercer punto es la unica diferencia visible del cambio: estos botones pasan a ser
   cuadrados de 36 px, como los otros 172 botones de accion de la app. */
import AdminButton from "@/shared/components/buttons/AppButton.vue";

defineProps({
  hasDocument: {
    type: Boolean,
    default: false
  },
  canEdit: {
    type: Boolean,
    default: true
  },
  canUpload: {
    type: Boolean,
    default: true
  },
  canDeleteDocument: {
    type: Boolean,
    default: true
  },
  canDelete: {
    type: Boolean,
    default: true
  }
});

defineEmits(["edit", "preview", "download", "upload", "delete", "delete-document"]);
</script>
