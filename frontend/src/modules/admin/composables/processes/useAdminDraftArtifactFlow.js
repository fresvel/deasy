import axios from "axios";
import { Modal } from "@/shared/utils/modalController";
import { API_ROUTES } from "@/core/config/apiConfig";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

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
      process_definition_id: "",
      template_scope: "official",
      schema_fields: [],
      fill_workflow: { required: true, steps: [] },
      signature_workflow: { required: true, anchors: [], steps: [] }
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
    // Si la instancia cacheada quedó apuntando a un elemento viejo (remontado), se descarta y recrea.
    if (draftArtifactInstance && draftArtifactInstance.element !== modalElement) {
      draftArtifactInstance = null;
    }
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

  const openDraftArtifactModal = async (row = null, { force = false, show = true, preselectDefinitionId = "", cloneFrom = null } = {}) => {
    if (!force && (!props.table || props.table.table !== "template_artifacts")) {
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
        storage_version: row.storage_version ? String(row.storage_version) : "",
        is_active: Number(row.is_active) === 1 ? 1 : 0,
        // Ciclo de vida de la versión (draft/published/retired): gobierna edición y acciones del strip.
        lifecycle_state: row.lifecycle_state ? String(row.lifecycle_state) : "published",
        // El tipo no se cambia al editar: define el almacenamiento y las opciones de autoría. Se muestra como tag.
        template_scope: row.template_scope === "ad_hoc" ? "ad_hoc" : "official",
        schema_fields: []
      };
      draftArtifactExistingFiles.value = {
        pdf: getFileNameFromObjectKey(availableFormats?.pdf?.entry_object_key),
        docx: getFileNameFromObjectKey(availableFormats?.docx?.entry_object_key),
        xlsx: getFileNameFromObjectKey(availableFormats?.xlsx?.entry_object_key),
        pptx: getFileNameFromObjectKey(availableFormats?.pptx?.entry_object_key)
      };
      // Carga los campos y flujos actuales (desde MinIO) para edición.
      try {
        const { data: schemaData } = await adminSqlService.getTemplateArtifactSchema(row.id);
        draftArtifactForm.value = {
          ...draftArtifactForm.value,
          schema_fields: Array.isArray(schemaData?.fields) ? schemaData.fields : [],
          fill_workflow: schemaData?.fill_workflow || { required: true, steps: [] },
          signature_workflow: schemaData?.signature_workflow || { required: true, anchors: [], steps: [] }
        };
      } catch {
        // Si falla la lectura, se continúa con campos/flujos vacíos.
      }
    } else if (cloneFrom) {
      // Crear A PARTIR DE otra plantilla: modo creación (editId vacío) con datos del origen precargados.
      // No copia los documentos de referencia (binarios en MinIO): el autor los vuelve a adjuntar.
      draftArtifactForm.value = {
        template_seed_id: cloneFrom.template_seed_id ? String(cloneFrom.template_seed_id) : "",
        display_name: cloneFrom.display_name ? `${cloneFrom.display_name} (copia)` : "",
        description: cloneFrom.description ? String(cloneFrom.description) : "",
        process_definition_id: preselectDefinitionId ? String(preselectDefinitionId) : "",
        template_scope: "official",
        schema_fields: [],
        fill_workflow: { required: true, steps: [] },
        signature_workflow: { required: true, anchors: [], steps: [] }
      };
      try {
        const { data: schemaData } = await adminSqlService.getTemplateArtifactSchema(cloneFrom.id);
        draftArtifactForm.value = {
          ...draftArtifactForm.value,
          schema_fields: Array.isArray(schemaData?.fields) ? schemaData.fields : [],
          fill_workflow: schemaData?.fill_workflow || { required: true, steps: [] },
          signature_workflow: schemaData?.signature_workflow || { required: true, anchors: [], steps: [] }
        };
      } catch {
        // Si falla la lectura del esquema de origen, se continúa con campos/flujos vacíos.
      }
    } else {
      draftArtifactForm.value = {
        template_seed_id: "",
        display_name: "",
        description: "",
        // Preselecciona la configuración de origen cuando la plantilla se crea desde la edición de una config
        // (el modo embebido del picker no dispara shown.bs.modal, así que se fija aquí al construir el form).
        process_definition_id: preselectDefinitionId ? String(preselectDefinitionId) : "",
        // En admin solo se CREAN plantillas oficiales (de proceso). Las ad_hoc nacen en runtime del usuario.
        template_scope: "official",
        schema_fields: [],
        fill_workflow: { required: true, steps: [] },
        signature_workflow: { required: true, anchors: [], steps: [] }
      };
    }
    await loadDraftArtifactSeedOptions();
    // En modo embebido (pestaña Crear dentro del picker) se prepara el form sin abrir el modal standalone.
    if (show) {
      ensureDraftArtifactInstance();
      draftArtifactInstance?.show();
    }
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
      form.append("template_scope", draftArtifactForm.value.template_scope || "official");
      if (Array.isArray(draftArtifactForm.value.schema_fields) && draftArtifactForm.value.schema_fields.length) {
        form.append("schema_fields", JSON.stringify(draftArtifactForm.value.schema_fields));
      }
      if (draftArtifactForm.value.fill_workflow?.steps?.length) {
        form.append("fill_workflow", JSON.stringify(draftArtifactForm.value.fill_workflow));
      }
      if (draftArtifactForm.value.signature_workflow?.steps?.length) {
        form.append("signature_workflow", JSON.stringify(draftArtifactForm.value.signature_workflow));
      }
      if (draftArtifactForm.value.process_definition_id) {
        form.append("process_definition_id", String(draftArtifactForm.value.process_definition_id));
      }
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
      const baseMessage = response.data?.__notice || (isEditingDraft
        ? "La plantilla de documento fue actualizada correctamente."
        : "La plantilla de documento fue creada correctamente.");
      // Avisos no bloqueantes (p. ej. cargo sin puesto hoy en la ubicación, resoluble por late-binding):
      // la plantilla se guardó, pero se informa al autor.
      const warning = response.data?.__warning;
      showFeedbackToast({
        kind: warning ? "warning" : "success",
        title: isEditingDraft ? "Plantilla actualizada" : "Plantilla creada",
        message: warning ? `${baseMessage} ${warning}`.trim() : baseMessage
      });
      return response?.data;
    } catch (err) {
      draftArtifactError.value = err?.response?.data?.message || (isEditingDraft
        ? "No se pudo actualizar la plantilla de documento."
        : "No se pudo crear la plantilla de documento.");
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
