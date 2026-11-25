<template>
  <DossierSectionCrud :descriptor="descriptor" :fields="tableFields" tabs-label="Tipos de referencia">
    <template #form="{ editingItem, onUpdated, reload, close }">
      <AgregarReferencia
        :editing-item="editingItem"
        @referencia-added="reload"
        @referencia-updated="onUpdated"
        @close="close"
      />
    </template>
    <template #delete-question="{ item }">
      ¿Deseas eliminar la referencia de <strong>{{ item?.nombre || "seleccionada" }}</strong>?
    </template>
  </DossierSectionCrud>
</template>

<script setup>
import DossierSectionCrud from "@/modules/perfil/components/sections/DossierSectionCrud.vue";
import AgregarReferencia from "@/modules/perfil/components/AgregarReferencia.vue";
import DossierService from "@/modules/dossier/services/DossierService";

const descriptor = {
  dossierKey: "referencias",
  docType: "referencia",
  deleteRecord: (id) => DossierService.deleteReferencia(id),
  uploadDocument: (id, file) => DossierService.uploadReferenciaDocument(id, file),
  filenameFor: (row) => `${row.nombre || "referencia"}.pdf`,
  subsections: [
    { key: "laborales", label: "Laborales", filter: (r) => r.tipo === "laboral" },
    { key: "familiares", label: "Familiares", filter: (r) => r.tipo === "familiar" },
    { key: "personales", label: "Personales", filter: (r) => r.tipo === "personal" }
  ]
};

const tableFields = [
  { name: "sera", label: "" },
  { name: "nombre", label: "REFERENCIA" },
  { name: "cargo_parentesco", label: "CARGO" },
  { name: "email", label: "CORREO" },
  { name: "telefono", label: "TELÉFONO" },
  { name: "institution", label: "INSTITUCIÓN" }
];
</script>
