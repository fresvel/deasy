<template>
  <div class="w-full">
    <ProfileSectionShell
      :add-disabled="!canCreateDossier"
      add-disabled-title="No tienes permiso para agregar registros del dossier."
      @add="openModal"
    >
      <ProfileSubsectionTabs
        v-if="subsectionTabs.length"
        v-model="activeTab"
        :aria-label="tabsLabel"
        :tabs="subsectionTabs"
      />

      <AppDataTable
        :fields="fields"
        :rows="tableRows"
        :row-key="(row) => row._id"
        empty-text="No hay registros."
        actions-label="ACCIÓN"
      >
        <template #cell="{ row, field }">
          <BtnSera v-if="field.name === 'sera'" :type="getSeraType(row.sera)" />
          <!-- Cada seccion pinta sus columnas especiales aqui; las que no cubra caen al genérico. -->
          <slot v-else name="cell" :row="row" :field="field">
            <span>{{ row[field.name] ?? '—' }}</span>
          </slot>
        </template>
        <template #actions="{ row }">
          <DossierDocumentActions
            :has-document="Boolean(row.url_documento)"
            :can-edit="canUpdateDossier"
            :can-upload="canUpdateDossier"
            :can-delete-document="canDeleteDossier"
            :can-delete="canDeleteDossier"
            @edit="editRecord(row)"
            @preview="previewDocument(row)"
            @download="downloadDocument(row)"
            @upload="triggerFileUpload(row._id)"
            @delete-document="deletePdfOnly(row)"
            @delete="openDelete(row)"
          />
        </template>
      </AppDataTable>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar. El formulario concreto lo inyecta la seccion por el slot #form. -->
    <AppModalShell
      ref="modal"
      :labelled-by="`${docType}-modal-title`"
      size="lg"
      :show-header="false"
      body-class="p-0"
    >
      <slot name="form" :editing-item="pendingEdit" :on-updated="onUpdated" :reload="loadDossier" :close="hideModal" :active-tab="activeTab" />
    </AppModalShell>

    <!-- Modal Eliminar -->
    <AppModalShell
      controlled
      :open="showDeleteModal"
      title="Confirmar eliminación"
      :labelled-by="`${docType}-delete-modal-title`"
      size="md"
      @close="showDeleteModal = false"
    >
      <p class="text-sm text-body">
        <slot name="delete-question" :item="pendingDelete">
          ¿Deseas eliminar el registro seleccionado?
        </slot>
      </p>
      <template #footer>
        <AppButton variant="danger" @click="showDeleteModal = false">Cancelar</AppButton>
        <AppButton variant="danger" @click="confirmDelete">Eliminar</AppButton>
      </template>
    </AppModalShell>

    <!-- Oculto y disparado desde JS (triggerFileUpload): no tiene rotulo visible, asi que su nombre accesible va en aria-label. -->
    <input type="file" ref="fileInput" accept="application/pdf" aria-label="Seleccionar archivo PDF" class="hidden" @change="handleFileSelect" />
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
/**
 * CRUD de una seccion del dossier. Absorbe lo que los cinco *Section.vue clasicos repetian: el shell, las
 * subpestanas, la tabla, los dos modales, el input de fichero y el visor de PDF.
 *
 * Cada seccion queda como un wrapper que le pasa su `descriptor` (datos: clave del dossier, docType,
 * borrado/subida, subpestanas) y rellena tres slots con lo que de verdad es suyo:
 *   #form            -> su formulario Agregar*, con editing-item/on-updated/close ya cableados
 *   #cell            -> sus columnas especiales (fechas, listas...); el resto cae al generico
 *   #delete-question -> el texto del modal de borrado
 *
 * Investigacion NO usa esto: su modelo es de cinco sub-listas con columnas por pestana, otra bestia.
 */
import { computed } from "vue";
import ProfileSectionShell from "@/modules/perfil/components/ProfileSectionShell.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
import DossierDocumentActions from "@/modules/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/modules/perfil/components/DossierPdfPreviewModal.vue";
import BtnSera from "@/shared/components/buttons/BtnSera.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import { mapDossierStatusToSeraType } from "@/modules/perfil/utils/dossierStatus";
import { useDossierSection } from "@/modules/perfil/composables/useDossierSection.js";

const props = defineProps({
  descriptor: { type: Object, required: true },
  /**
   * Columnas. Array, o funcion (activeTab) => array cuando alguna etiqueta depende de la subpestana
   * (Experiencia: "FUNCIONES" vs "CÁTEDRAS"). Siempre incluye la columna 'sera'.
   */
  fields: { type: [Array, Function], required: true },
  tabsLabel: { type: String, default: "Subsecciones" }
});

const s = useDossierSection(props.descriptor);
const {
  canCreateDossier, canUpdateDossier, canDeleteDossier,
  modal, pdfPreviewModal, fileInput,
  pendingEdit, pendingDelete, showDeleteModal, activeTab,
  subsectionTabs, tableRows,
  loadDossier, hideModal, openModal, editRecord, onUpdated,
  openDelete, confirmDelete, deletePdfOnly, previewDocument, downloadDocument,
  triggerFileUpload, handleFileSelect
} = s;

const docType = props.descriptor.docType;
const getSeraType = (sera) => mapDossierStatusToSeraType(sera);
const fields = computed(() => (typeof props.fields === "function" ? props.fields(activeTab.value) : props.fields));
</script>
