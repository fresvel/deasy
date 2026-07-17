<template>
  <DossierSectionCrud :descriptor="descriptor" :fields="tableFields" tabs-label="Tipos de experiencia laboral">
    <template #form="{ editingItem, onUpdated, reload, close }">
      <AgregarExperiencia
        :editing-item="editingItem"
        @experiencia-added="reload"
        @experiencia-updated="onUpdated"
        @close="close"
      />
    </template>
    <template #cell="{ row, field }">
      <span v-if="field.name === 'funciones'">{{ row.funcion_catedra?.join(', ') || '—' }}</span>
      <span v-else-if="field.name === 'fecha_inicio'">{{ formatDossierDate(row.fecha_inicio) }}</span>
      <span v-else-if="field.name === 'fecha_fin'">{{ row.fecha_fin ? formatDossierDate(row.fecha_fin) : 'Actualidad' }}</span>
    </template>
    <template #delete-question="{ item }">
      ¿Deseas eliminar la experiencia en <strong>{{ item?.institucion || "seleccionada" }}</strong>?
    </template>
  </DossierSectionCrud>
</template>

<script setup>
import DossierSectionCrud from "@/modules/perfil/components/sections/DossierSectionCrud.vue";
import AgregarExperiencia from "@/modules/perfil/components/AgregarExperiencia.vue";
import DossierService from "@/modules/dossier/services/DossierService";
import { formatDossierDate } from "@/modules/perfil/utils/dossierDate.js";

const descriptor = {
  dossierKey: "experiencia",
  docType: "experiencia",
  deleteRecord: (id) => DossierService.deleteExperiencia(id),
  uploadDocument: (id, file) => DossierService.uploadExperienciaDocument(id, file),
  filenameFor: (row) => `${row.institucion || "experiencia"}.pdf`,
  subsections: [
    { key: "profesional", label: "Profesional", filter: (e) => e.tipo === "Profesional" },
    { key: "docente", label: "Docente", filter: (e) => e.tipo === "Docencia" }
  ]
};

// Funcion, no array: la columna "funciones" se llama FUNCIONES en Profesional y CÁTEDRAS en Docente.
const tableFields = (activeTab) => [
  { name: "sera", label: "" },
  { name: "institucion", label: "INSTITUCIÓN" },
  { name: "funciones", label: activeTab === "profesional" ? "FUNCIONES" : "CÁTEDRAS" },
  { name: "modalidad", label: "MODALIDAD" },
  { name: "fecha_inicio", label: "DESDE" },
  { name: "fecha_fin", label: "HASTA" }
];
</script>
