<template>
  <DossierSectionCrud :descriptor="descriptor" :fields="tableFields" tabs-label="Tipos de producción académica">
    <template #form="{ editingItem, onUpdated, reload, close, activeTab }">
      <AgregarInvestigacion
        :editing-item="editingItem"
        :initial-type="editingItem ? activeTab : 'articulos'"
        @investigacion-added="reload"
        @investigacion-updated="onUpdated"
        @close="close"
      />
    </template>
    <template #cell="{ row, field }">
      <span v-if="field.name === 'fecha'">{{ formatDossierDate(row.fecha) || '—' }}</span>
      <span v-else-if="field.name === 'inicio'">{{ formatDossierDate(row.inicio) || '—' }}</span>
      <span v-else-if="field.name === 'fin'">{{ formatDossierDate(row.fin) || '—' }}</span>
      <span v-else-if="field.name === 'presupuesto'">{{ row.presupuesto ? '$' + row.presupuesto : '—' }}</span>
      <span v-else-if="field.name === 'avance'">{{ row.avance !== undefined ? row.avance + '%' : '—' }}</span>
      <span v-else-if="field.name === 'año'">{{ row['año'] || '—' }}</span>
    </template>
    <template #delete-question>
      ¿Deseas eliminar este registro de investigación?
    </template>
  </DossierSectionCrud>
</template>

<script setup>
/**
 * Investigacion: la variacion real del dossier.
 *
 * A diferencia de las otras cinco secciones, sus datos NO son un array plano sino un objeto de cinco
 * sub-listas (articulos, libros, ponencias, tesis, proyectos), y cada una tiene su propio tipo de
 * documento y sus propias columnas. Encaja en DossierSectionCrud gracias a los campos generales que el
 * composable admite para esto: `rowsFor`/`countFor` (de donde salen las filas) y `docType` como funcion
 * de la pestana. No hay ni una rama "if investigacion" en el codigo comun.
 *
 * Cuidado con dos tipos que conviven, heredado del original:
 *   - la CLAVE de la sub-lista, en plural: "articulos" (la usa deleteInvestigacion y el arbol del dossier);
 *   - el TIPO DE DOCUMENTO, en singular: "articulo" (lo usan download/delete/uploadDocument).
 * TIPO_DOC mapea de una a otro; deleteRecord usa la clave, el resto el docType.
 */
import DossierSectionCrud from "@/modules/perfil/components/sections/DossierSectionCrud.vue";
import AgregarInvestigacion from "@/modules/perfil/components/AgregarInvestigacion.vue";
import DossierService from "@/modules/dossier/services/DossierService";
import { formatDossierDate } from "@/modules/perfil/utils/dossierDate.js";

const TIPO_DOC = { articulos: "articulo", libros: "libro", ponencias: "ponencia", tesis: "tesis", proyectos: "proyecto" };

const descriptor = {
  dossierKey: "investigacion",
  docType: (tab) => TIPO_DOC[tab] || tab,
  // deleteInvestigacion espera la CLAVE en plural (la pestana); el resto de operaciones, el docType.
  deleteRecord: (id, tab) => DossierService.deleteInvestigacion(tab, id),
  uploadDocument: (id, file, tab) => DossierService.uploadInvestigacionDocument(TIPO_DOC[tab] || tab, id, file),
  filenameFor: (row) => `${row.titulo || row.tema || "investigacion"}.pdf`,
  rowsFor: (records, tab) => records?.[tab] ?? [],
  countFor: (records, key) => (records?.[key] ?? []).length,
  subsections: [
    { key: "articulos", label: "Artículos" },
    { key: "libros", label: "Libros y capítulos" },
    { key: "ponencias", label: "Ponencias" },
    { key: "tesis", label: "Tesis" },
    { key: "proyectos", label: "Proyectos" }
  ]
};

// Las columnas cambian por pestana, no solo su etiqueta: cada tipo de produccion tiene su ficha.
const tableFields = (activeTab) => {
  switch (activeTab) {
    case "articulos":
      return [
        { name: "sera", label: "" }, { name: "titulo", label: "TÍTULO" }, { name: "revista", label: "REVISTA" },
        { name: "base_indexada", label: "BASE INDEXADA" }, { name: "issn", label: "ISSN" },
        { name: "sjr", label: "SJR" }, { name: "fecha", label: "FECHA" }, { name: "estado", label: "ESTADO" }
      ];
    case "libros":
      return [
        { name: "sera", label: "" }, { name: "titulo", label: "TÍTULO" }, { name: "editorial", label: "EDITORIAL" },
        { name: "isbn", label: "ISBN" }, { name: "isnn", label: "ISNN" }, { name: "año", label: "AÑO" },
        { name: "tipo", label: "TIPO" }
      ];
    case "ponencias":
      return [
        { name: "sera", label: "" }, { name: "titulo", label: "TÍTULO" }, { name: "evento", label: "EVENTO" },
        { name: "año", label: "AÑO" }, { name: "pais", label: "PAÍS" }
      ];
    case "tesis":
      return [
        { name: "sera", label: "" }, { name: "ies", label: "IES" }, { name: "tema", label: "TEMA" },
        { name: "programa", label: "PROGRAMA" }, { name: "nivel", label: "NIVEL" }, { name: "año", label: "AÑO" },
        { name: "rol", label: "ROL" }
      ];
    default:
      return [
        { name: "sera", label: "" }, { name: "tema", label: "TEMA" }, { name: "institucion", label: "INSTITUCIÓN" },
        { name: "programa_group", label: "PROGRAMA / GRUPO" }, { name: "inicio", label: "INICIO" },
        { name: "fin", label: "FIN" }, { name: "presupuesto", label: "PRESUPUESTO" }, { name: "avance", label: "AVANCE" }
      ];
  }
};
</script>
