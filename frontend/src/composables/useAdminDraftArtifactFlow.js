import axios from "axios";
import { Modal } from "@/utils/modalController";
import { API_ROUTES } from "@/services/apiConfig";
import { adminSqlService } from "@/services/admin/AdminSqlService";

export function useAdminDraftArtifactFlow({
  props,
  draftArtifactModalRef,
  draftArtifactEditId,
  draftArtifactError,
  draftArtifactLoading,
  draftArtifactForm,
  draftArtifactExistingFiles,
  draftArtifactFiles,
  draftArtifactSeedOptions,
  currentLoggedUser,
  fetchRows,
  showFeedbackToast,
  normalizeAvailableFormats,
  getFileNameFromObjectKey,
  resolveModalElement
}) {
  let draftArtifactInstance = null;

  const resetDraftArtifactState = () => {
    draftArtifactError.value = "";
    draftArtifactLoading.value = false;
    draftArtifactEditId.value = "";
    draftArtifactExistingFiles.value = {
      pdf: "",
      docx: "",
      xlsx: "",
      pptx: ""
    };
    draftArtifactForm.value = {
      template_seed_id: "",
      display_name: "",
      description: "",
      source_version: "1.0.0"
    };
    draftArtifactFiles.value = {
      pdf: null,
      docx: null,
      xlsx: null,
      pptx: null
    };
  };

  const ensureDraftArtifactInstance = () => {
    const modalElement = resolveModalElement(draftArtifactModalRef.value);
    if (!draftArtifactInstance && modalElement) {
      draftArtifactInstance = new Modal(modalElement);
      modalElement.addEventListener("hidden.bs.modal", () => {
        resetDraftArtifactState();
      });
    }
  };

  const getDraftArtifactInstance = () => draftArtifactInstance;

  const loadDraftArtifactSeedOptions = async () => {
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("template_seeds"), {
        params: {
          filter_is_active: 1,
          orderBy: "display_name",
          order: "asc",
          limit: 500
        }
      });
      draftArtifactSeedOptions.value = response.data || [];
    } catch {
      draftArtifactSeedOptions.value = [];
    }
  };

  const openDraftArtifactModal = async (row = null) => {
    if (!props.table || props.table.table !== "template_artifacts") {
      return;
    }
    draftArtifactError.value = "";
    draftArtifactEditId.value = row?.id ? String(row.id) : "";
    draftArtifactExistingFiles.value = {
      pdf: "",
      docx: "",
      xlsx: "",
      pptx: ""
    };
    if (row) {
      const availableFormats = normalizeAvailableFormats(row.available_formats) || {};
      draftArtifactForm.value = {
        template_seed_id: row.template_seed_id ? String(row.template_seed_id) : "",
        display_name: row.display_name ? String(row.display_name) : "",
        description: row.description ? String(row.description) : "",
        source_version: row.source_version ? String(row.source_version) : "1.0.0"
      };
      draftArtifactExistingFiles.value = {
        pdf: getFileNameFromObjectKey(availableFormats?.user?.pdf?.entry_object_key),
        docx: getFileNameFromObjectKey(availableFormats?.user?.docx?.entry_object_key),
        xlsx: getFileNameFromObjectKey(availableFormats?.user?.xlsx?.entry_object_key),
        pptx: getFileNameFromObjectKey(availableFormats?.user?.pptx?.entry_object_key)
      };
    } else {
      draftArtifactForm.value = {
        template_seed_id: "",
        display_name: "",
        description: "",
        source_version: "1.0.0"
      };
    }
    await loadDraftArtifactSeedOptions();
    ensureDraftArtifactInstance();
    draftArtifactInstance?.show();
  };

  const closeDraftArtifactModal = () => {
    draftArtifactInstance?.hide();
  };

  const handleDraftArtifactFileChange = (kind, event) => {
    draftArtifactFiles.value = {
      ...draftArtifactFiles.value,
      [kind]: event?.target?.files?.[0] || null
    };
  };

  const handleDraftArtifactDrop = (kind, event) => {
    const file = event?.dataTransfer?.files?.[0] || null;
    draftArtifactFiles.value = {
      ...draftArtifactFiles.value,
      [kind]: file
    };
  };

  const getDraftArtifactFileLabel = (kind) => {
    const file = draftArtifactFiles.value[kind];
    return file?.name || draftArtifactExistingFiles.value[kind] || "Sin archivo";
  };

  const submitDraftArtifact = async () => {
    draftArtifactLoading.value = true;
    draftArtifactError.value = "";
    const isEditingDraft = Boolean(draftArtifactEditId.value);
    try {
      const ownerCedula = currentLoggedUser.value?.cedula ? String(currentLoggedUser.value.cedula).trim() : "";
      const ownerPersonId = currentLoggedUser.value?.id ? String(currentLoggedUser.value.id).trim() : "";
      if (!ownerCedula) {
        throw new Error("No se pudo inferir la cedula del usuario logueado.");
      }
      const form = new FormData();
      form.append("template_seed_id", draftArtifactForm.value.template_seed_id || "");
      form.append("owner_cedula", ownerCedula);
      if (ownerPersonId) {
        form.append("owner_person_id", ownerPersonId);
      }
      form.append("display_name", draftArtifactForm.value.display_name || "");
      form.append("description", draftArtifactForm.value.description || "");
      form.append("source_version", draftArtifactForm.value.source_version || "1.0.0");
      if (draftArtifactFiles.value.pdf) {
        form.append("pdf_file", draftArtifactFiles.value.pdf);
      }
      if (draftArtifactFiles.value.docx) {
        form.append("docx_file", draftArtifactFiles.value.docx);
      }
      if (draftArtifactFiles.value.xlsx) {
        form.append("xlsx_file", draftArtifactFiles.value.xlsx);
      }
      if (draftArtifactFiles.value.pptx) {
        form.append("pptx_file", draftArtifactFiles.value.pptx);
      }

      const requestConfig = {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      };
      const response = await adminSqlService.saveDraftTemplateArtifact(
        form,
        draftArtifactEditId.value,
        requestConfig
      );
      await fetchRows();
      closeDraftArtifactModal();
      showFeedbackToast({
        kind: "success",
        title: isEditingDraft ? "Artifact actualizado" : "Artifact creado",
        message: response.data?.__notice || (isEditingDraft
          ? "El paquete de usuario fue actualizado correctamente."
          : "El paquete de usuario fue creado correctamente.")
      });
    } catch (err) {
      draftArtifactError.value = err?.response?.data?.message || (isEditingDraft
        ? "No se pudo actualizar el paquete de usuario."
        : "No se pudo crear el paquete de usuario.");
    } finally {
      draftArtifactLoading.value = false;
    }
  };

  return {
    ensureDraftArtifactInstance,
    getDraftArtifactInstance,
    loadDraftArtifactSeedOptions,
    openDraftArtifactModal,
    closeDraftArtifactModal,
    handleDraftArtifactFileChange,
    handleDraftArtifactDrop,
    getDraftArtifactFileLabel,
    submitDraftArtifact
  };
}
