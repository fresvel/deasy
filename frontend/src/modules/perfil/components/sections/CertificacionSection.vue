<template>
  <!-- Sin subpestanas: subsections vacio en el descriptor, asi que DossierSectionCrud no pinta tabs. -->
  <DossierSectionCrud :descriptor="descriptor" :fields="tableFields">
    <template #form="{ editingItem, onUpdated, reload, close }">
      <AgregarCertificacion
        :editing-item="editingItem"
        @certificacion-added="reload"
        @certificacion-updated="onUpdated"
        @close="close"
      />
    </template>
    <template #cell="{ row, field }">
      <span v-if="field.name === 'horas'">{{ row.horas || '—' }}</span>
      <span v-else-if="field.name === 'fecha'">{{ formatDossierDate(row.fecha) }}</span>
      <span v-else-if="field.name === 'tipo'">{{ row.tipo || '—' }}</span>
      <span v-else-if="field.name === 'descripcion'" class="max-w-xs truncate block">{{ row.descripcion || '—' }}</span>
    </template>
    <template #delete-question="{ item }">
      ¿Deseas eliminar la certificación <strong>{{ item?.titulo || "seleccionada" }}</strong>?
    </template>
  </DossierSectionCrud>
</template>

<script setup>
import DossierSectionCrud from "@/modules/perfil/components/sections/DossierSectionCrud.vue";
import AgregarCertificacion from "@/modules/perfil/components/AgregarCertificacion.vue";
import DossierService from "@/modules/dossier/services/DossierService";
import { formatDossierDate } from "@/modules/perfil/utils/dossierDate.js";

const descriptor = {
  dossierKey: "certificaciones",
  docType: "certificacion",
  deleteRecord: (id) => DossierService.deleteCertificacion(id),
  uploadDocument: (id, file) => DossierService.uploadCertificacionDocument(id, file),
  filenameFor: (row) => `${row.titulo || "certificacion"}.pdf`
  // sin subsections: la seccion no tiene subpestanas
};

const tableFields = [
  { name: "sera", label: "" },
  { name: "titulo", label: "CERTIFICACIÓN" },
  { name: "institution", label: "INSTITUCIÓN" },
  { name: "horas", label: "HORAS" },
  { name: "fecha", label: "FECHA" },
  { name: "tipo", label: "ÁMBITO" },
  { name: "descripcion", label: "DESCRIPCIÓN" }
];
</script>
