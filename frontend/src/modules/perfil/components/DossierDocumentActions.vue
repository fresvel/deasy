<template>
  <div class="inline-flex items-center gap-1">

    <!-- Editar registro: AZUL -->
    <button type="button" class="action-btn action-btn--edit" title="Editar registro" @click="$emit('edit')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M16.862 4.487 18.549 2.8a1.875 1.875 0 1 1 2.651 2.651L8.093 17.56a4.5 4.5 0 0 1-1.897 1.13l-2.685.805.806-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z" />
      </svg>
    </button>

    <!-- Gestionar PDF: GRIS sin documento · VERDE con documento -->
    <button
      type="button"
      :class="hasDocument ? 'pdf-btn pdf-btn--has-doc' : 'pdf-btn pdf-btn--no-doc'"
      :title="hasDocument ? 'Ver / Gestionar PDF' : 'Subir PDF'"
      @click="$emit('manage-pdf')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    </button>

    <!-- Eliminar registro completo: ROJO -->
    <button type="button" class="action-btn action-btn--delete" title="Eliminar registro" @click="$emit('delete')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M19.325 9.468s-.543 6.735-.858 9.572c-.15 1.355-.987 2.15-2.358 2.174-2.61.047-5.221.05-7.83-.005-1.318-.027-2.141-.83-2.288-2.162-.317-2.862-.857-9.579-.857-9.579M20.708 6.24H3.75m13.69 0a1.65 1.65 0 0 1-1.614-1.324L15.583 3.7a1.28 1.28 0 0 0-1.237-.95h-4.233a1.28 1.28 0 0 0-1.237.95l-.243 1.216A1.65 1.65 0 0 1 7.018 6.24" />
      </svg>
    </button>

  </div>
</template>

<script setup>
defineProps({
  hasDocument: { type: Boolean, default: false }
});

defineEmits(["edit", "manage-pdf", "delete"]);
</script>

<style scoped>
/* ── Base común a los 3 botones ─────────────────────── */
.action-btn,
.pdf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.1s;
  flex-shrink: 0;
}
.action-btn:active,
.pdf-btn:active { transform: scale(0.93); }

/* Editar: AZUL */
.action-btn--edit {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #2563eb;
}
.action-btn--edit:hover {
  background: #dbeafe;
  border-color: #60a5fa;
  color: #1d4ed8;
}

/* Eliminar: ROJO */
.action-btn--delete {
  background: #fff1f2;
  border-color: #fca5a5;
  color: #dc2626;
}
.action-btn--delete:hover {
  background: #fee2e2;
  border-color: #f87171;
  color: #b91c1c;
}

/* Sin documento: GRIS */
.pdf-btn--no-doc {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #94a3b8;
}
.pdf-btn--no-doc:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #64748b;
}

/* Con documento: VERDE */
.pdf-btn--has-doc {
  background: #f0fdf4;
  border-color: #86efac;
  color: #16a34a;
}
.pdf-btn--has-doc:hover {
  background: #dcfce7;
  border-color: #4ade80;
  color: #15803d;
}
</style>