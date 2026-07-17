<template>
  <DossierSectionCrud :descriptor="descriptor" :fields="tableFields" tabs-label="Tipos de capacitación">
    <template #form="{ editingItem, onUpdated, reload, close }">
      <AgregarCapacitacion
        :editing-item="editingItem"
        @capacitacion-added="reload"
        @capacitacion-updated="onUpdated"
        @close="close"
      />
    </template>
    <template #cell="{ row, field }">
      <span v-if="field.name === 'horas'">{{ row.horas || '—' }}</span>
      <span v-else-if="field.name === 'pais'">{{ row.pais || '—' }}</span>
      <span v-else-if="field.name === 'rol'">{{ row.rol || '—' }}</span>
      <span v-else-if="field.name === 'fecha_inicio'">{{ formatDossierDate(row.fecha_inicio) }}</span>
      <span v-else-if="field.name === 'fecha_fin'">{{ formatDossierDate(row.fecha_fin) }}</span>
    </template>
    <template #delete-question="{ item }">
      ¿Deseas eliminar la capacitación <strong>{{ item?.tema || "seleccionada" }}</strong>?
    </template>
  </DossierSectionCrud>
</template>

<script setup>
import DossierSectionCrud from "@/modules/perfil/components/sections/DossierSectionCrud.vue";
import AgregarCapacitacion from "@/modules/perfil/components/AgregarCapacitacion.vue";
import DossierService from "@/modules/dossier/services/DossierService";
import { formatDossierDate } from "@/modules/perfil/utils/dossierDate.js";

const descriptor = {
  // La seccion "Capacitación" vive bajo la clave `formacion` del dossier (deuda de nombres heredada).
  dossierKey: "formacion",
  docType: "formacion",
  deleteRecord: (id) => DossierService.deleteCapacitacion(id),
  uploadDocument: (id, file) => DossierService.uploadCapacitacionDocument(id, file),
  filenameFor: (row) => `${row.tema || "capacitacion"}.pdf`,
  subsections: [
    { key: "docente", label: "Docente", filter: (c) => c.tipo === "Docente" },
    { key: "profesional", label: "Profesional", filter: (c) => c.tipo === "Profesional" }
  ]
};

const tableFields = [
  { name: "sera", label: "" },
  { name: "tema", label: "TEMA" },
  { name: "institution", label: "INSTITUCIÓN" },
  { name: "horas", label: "HORAS" },
  { name: "pais", label: "PAÍS" },
  { name: "fecha_inicio", label: "INICIO" },
  { name: "fecha_fin", label: "FIN" },
  { name: "rol", label: "ROL" }
];
</script>
