<template>
  <DossierSectionCrud :descriptor="descriptor" :fields="tableFields" tabs-label="Tipos de formación profesional">
    <template #form="{ editingItem, onUpdated, reload, close }">
      <AgregarTitulo
        :editing-item="editingItem"
        @title-added="reload"
        @title-updated="onUpdated"
        @close="close"
      />
    </template>
    <template #cell="{ row, field }">
      <span v-if="field.name === 'sreg'">{{ row.sreg || '—' }}</span>
    </template>
    <template #delete-question="{ item }">
      ¿Deseas eliminar el título <strong>{{ item?.titulo || "seleccionado" }}</strong>?
    </template>
  </DossierSectionCrud>
</template>

<script setup>
import DossierSectionCrud from "@/modules/perfil/components/sections/DossierSectionCrud.vue";
import AgregarTitulo from "@/modules/perfil/components/AgregarTitulo.vue";
import DossierService from "@/modules/dossier/services/DossierService";

// Cuarto Nivel agrupa los posgrados; se lista aqui para que el filtro de esa subpestana no se disperse.
const CUARTO_NIVEL = ["Maestría", "Maestría Tecnológica", "Diplomado", "Doctorado", "Posdoctorado"];

const descriptor = {
  dossierKey: "titulos",
  docType: "titulo",
  deleteRecord: (id) => DossierService.deleteTitulo(id),
  uploadDocument: (id, file) => DossierService.uploadTituloDocument(id, file),
  filenameFor: (row) => `${row.titulo || "titulo"}.pdf`,
  subsections: [
    { key: "cuarto-nivel", label: "Cuarto Nivel", filter: (t) => CUARTO_NIVEL.includes(t.nivel) },
    { key: "grado", label: "Grado", filter: (t) => t.nivel === "Grado" },
    { key: "tecnicos", label: "Técnicos y Tecnológicos", filter: (t) => t.nivel === "Técnico" || t.nivel === "Tecnólogo" }
  ]
};

const tableFields = [
  { name: "sera", label: "" },
  { name: "titulo", label: "TÍTULO" },
  { name: "ies", label: "INSTITUCIÓN" },
  { name: "tipo", label: "TIPO" },
  { name: "sreg", label: "N.° SENESCYT" },
  { name: "campo_amplio", label: "CAMPO" },
  { name: "pais", label: "PAÍS" }
];
</script>
