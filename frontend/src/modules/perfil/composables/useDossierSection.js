import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Modal } from "@/shared/utils/modalController";
import DossierService from "@/modules/dossier/services/DossierService";
import { useDossierAccess } from "@/modules/perfil/composables/useDossierAccess";

/**
 * El CRUD comun de una seccion del dossier.
 *
 * Los cinco *Section.vue "clasicos" (titulos, experiencia, referencias, capacitacion, certificacion)
 * repetian ~180 lineas de script byte a byte: cargar el dossier, borrar registro, subir/descargar/
 * previsualizar PDF, seleccionar fichero, y el ciclo de vida del modal. Lo unico que cambiaba eran datos:
 * la clave del dossier, el tipo de documento, dos metodos de servicio, y las subpestanas. Eso es un
 * descriptor, no codigo.
 *
 * El composable POSEE su estado (crea los refs de modal/preview/fileInput y los devuelve); el componente
 * que lo monta los ata con ref="...". Es el patron de useDeliverableFilePreview, no el de useDeliverableView.
 *
 * Casi todas las secciones son un array plano filtrado por subpestana. Investigacion NO: sus datos son un
 * objeto de sub-listas ({articulos, libros...}) y su tipo de documento cambia con la pestana. Para eso el
 * descriptor admite `rowsFor`/`countFor` (de donde salen las filas) y `docType` como funcion de la pestana.
 * Las secciones clasicas omiten esos campos y todo sigue como antes. La pestana activa se pasa SIEMPRE a
 * deleteRecord/uploadDocument; quien no la necesita la ignora.
 *
 * @param {object} descriptor
 * @param {string} descriptor.dossierKey   Clave dentro del arbol del dossier: dossier[dossierKey].
 * @param {string|((tab:string)=>string)} descriptor.docType  Tipo de documento; fijo, o funcion de la pestana.
 * @param {(id:string,tab:string)=>Promise} descriptor.deleteRecord     Borra el registro.
 * @param {(id:string,file:File,tab:string)=>Promise} descriptor.uploadDocument  Sube su PDF.
 * @param {Array<{key,label,filter?}>} [descriptor.subsections]  Subpestanas; [] = sin pestanas.
 * @param {(records:any,tab:string)=>Array} [descriptor.rowsFor]   Filas de la pestana; default: filtra el array.
 * @param {(records:any,key:string)=>number} [descriptor.countFor]  Conteo de una subpestana; default: idem.
 * @param {(row:object)=>string} [descriptor.filenameFor]     Nombre del PDF al descargar.
 */
export function useDossierSection(descriptor) {
  const {
    dossierKey,
    docType,
    deleteRecord,
    uploadDocument,
    subsections = [],
    rowsFor,
    countFor,
    filenameFor = (row) => `${row?.[typeof docType === "string" ? docType : "documento"] || "documento"}.pdf`
  } = descriptor;

  /** El tipo de documento de la pestana: fijo para las clasicas, por-pestana para Investigacion. */
  const resolveDocType = (tab) => (typeof docType === "function" ? docType(tab) : docType);

  const { canCreateDossier, canUpdateDossier, canDeleteDossier } = useDossierAccess();

  const modal = ref(null);
  const pdfPreviewModal = ref(null);
  const fileInput = ref(null);
  const dossier = ref(null);
  const pendingEdit = ref(null);
  const pendingDelete = ref(null);
  const showDeleteModal = ref(false);
  const activeTab = ref(subsections[0]?.key ?? "");
  const selectedRecordId = ref(null);
  let modalInstance = null;

  /** Datos crudos de la seccion: un array (clasicas) o un objeto de sub-listas (Investigacion). */
  const allRecords = computed(() => dossier.value?.[dossierKey]);

  /** Subpestanas con su contador. Vacio si la seccion no tiene subpestanas. */
  const subsectionTabs = computed(() =>
    subsections.map((s) => ({
      key: s.key,
      label: s.label,
      count: countFor ? countFor(allRecords.value, s.key) : (allRecords.value ?? []).filter(s.filter).length
    }))
  );

  /** Filas visibles: las de la subpestana activa, o todas si no hay subpestanas. */
  const tableRows = computed(() => {
    if (rowsFor) return rowsFor(allRecords.value, activeTab.value);
    const records = allRecords.value ?? [];
    if (!subsections.length) return records;
    const active = subsections.find((s) => s.key === activeTab.value) ?? subsections[0];
    return records.filter(active.filter);
  });

  const loadDossier = async () => {
    try {
      const data = await DossierService.getDossier();
      if (data.success) dossier.value = data.data;
    } catch (error) {
      console.error("Error al cargar dossier:", error);
    }
  };

  const hideModal = () => {
    if (!modal.value?.el) return;
    Modal.getOrCreateInstance(modal.value.el).hide();
  };

  const showModal = () => {
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
  };

  const openModal = () => {
    if (!canCreateDossier.value) return;
    pendingEdit.value = null; // imprescindible: agregar y editar comparten modal (ver fase 4.1).
    showModal();
  };

  const editRecord = (record) => {
    if (!canUpdateDossier.value) return;
    pendingEdit.value = { ...record };
    showModal();
  };

  const onUpdated = () => {
    pendingEdit.value = null;
    loadDossier();
  };

  const openDelete = (record) => {
    if (!canDeleteDossier.value) return;
    pendingDelete.value = record;
    showDeleteModal.value = true;
  };

  const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    try {
      // El borrado se dispara desde la fila de la pestana activa, asi que activeTab ES su tipo
      // (lo unico que Investigacion necesita ademas del _id). Las clasicas ignoran el segundo arg.
      await deleteRecord(pendingDelete.value._id, activeTab.value);
      await loadDossier();
      showDeleteModal.value = false;
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  const deletePdfOnly = async (record) => {
    if (!canDeleteDossier.value) return;
    if (!confirm("¿Estás seguro de eliminar solo el documento PDF?")) return;
    try {
      await DossierService.deleteDocument(resolveDocType(activeTab.value), record._id);
      await loadDossier();
    } catch (error) {
      console.error("Error al eliminar PDF:", error);
    }
  };

  const getBlob = async (recordId) => {
    const response = await DossierService.downloadDocument(resolveDocType(activeTab.value), recordId);
    return new Blob([response.data], { type: "application/pdf" });
  };

  const previewDocument = async (record) => {
    try {
      pdfPreviewModal.value?.openFromBlob(await getBlob(record._id));
    } catch (error) {
      console.error("Error al previsualizar:", error);
    }
  };

  const downloadDocument = async (record) => {
    try {
      const blobUrl = window.URL.createObjectURL(await getBlob(record._id));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filenameFor(record);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error("Error al descargar:", error);
    }
  };

  const triggerFileUpload = (recordId) => {
    if (!canUpdateDossier.value) return;
    selectedRecordId.value = recordId;
    fileInput.value?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await uploadDocument(selectedRecordId.value, file, activeTab.value);
      await loadDossier();
    } catch (error) {
      console.error("Error al subir:", error);
    }
    event.target.value = "";
  };

  onMounted(() => {
    loadDossier();
    window.addEventListener("dossier-updated", loadDossier);
  });

  onBeforeUnmount(() => {
    modalInstance?.dispose();
    window.removeEventListener("dossier-updated", loadDossier);
  });

  return {
    canCreateDossier, canUpdateDossier, canDeleteDossier,
    modal, pdfPreviewModal, fileInput,
    dossier, pendingEdit, pendingDelete, showDeleteModal, activeTab,
    subsectionTabs, tableRows,
    loadDossier, hideModal, openModal, editRecord, onUpdated,
    openDelete, confirmDelete, deletePdfOnly, previewDocument, downloadDocument,
    triggerFileUpload, handleFileSelect
  };
}
