<template>
  <div class="flex flex-col gap-4">
    <div v-if="title" class="flex items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-bold text-strong m-0">{{ title }}</h3>
        <p v-if="description" class="text-sm text-muted m-0 mt-1">{{ description }}</p>
      </div>
      <AdminButton
        v-if="refreshable"
        variant="neutral-outline"
        :disabled="isLoading"
        @click="loadCertificates"
      >
        Actualizar
      </AdminButton>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4">
      <div class="bg-white rounded-2xl border border-line p-4">
        <AppAlert v-if="errorMessage">
          {{ errorMessage }}
        </AppAlert>
        <AppAlert variant="success" class="mb-3" v-if="successMessage">
          {{ successMessage }}
        </AppAlert>

        <div v-if="isLoading" class="py-8 text-center text-sm text-muted font-medium">
          Cargando certificados...
        </div>

        <div v-else-if="!certificates.length" class="py-8 text-center text-sm text-muted font-medium">
          No hay certificados cargados.
        </div>

        <div v-else class="flex flex-col gap-3">
          <button
            v-for="certificate in certificates"
            :key="certificate.id"
            type="button"
            class="deasy-picker deasy-picker--flat"
            :class="isSelected(certificate.id) ? 'border-blue-light-500 bg-blue-light-50' : 'border-line bg-white hover:bg-surface'"
            @click="selectCertificate(certificate)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-bold text-strong truncate">{{ certificate.label }}</span>
                  <AppTag v-if="certificate.is_default" variant="info">Predeterminado</AppTag>
                </div>
                <div class="mt-1 text-xs text-muted break-all">{{ certificate.original_filename }}</div>
                <div class="mt-1 text-xs text-muted">
                  {{ formatDate(certificate.created_at) }}
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0" @click.stop>
                <AdminButton
                  v-if="!certificate.is_default"
                  variant="primary-outline"
                  @click="markDefault(certificate)"
                >
                  Usar por defecto
                </AdminButton>
                <AdminButton
                  variant="neutral-outline"
                  @click="downloadCertificate(certificate)"
                >
                  Descargar
                </AdminButton>
                <AppDeleteButton label="Eliminar" @click="deleteCertificate(certificate)" />
              </div>
            </div>
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-line p-4 flex flex-col gap-4">
        <div>
          <h4 class="text-sm font-bold text-strong m-0">Subir certificado</h4>
          <p class="text-xs text-muted m-0 mt-1">
            El archivo `.p12` ya está protegido por contraseña. Solo los endpoints autenticados pueden descargarlo.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <label :for="fieldId('uploadlabel')" class="text-sm font-semibold text-body">Nombre visible</label>
          <input :id="fieldId('uploadlabel')" v-model="uploadLabel" type="text" class="deasy-control" placeholder="Ej: Token personal 2026" />
        </div>

        <PdfDropField
          variant="compact"
          title="Archivo .p12"
          action-text="Seleccionar certificado"
          help-text="Arrastra o selecciona un archivo .p12"
          accept=".p12,application/x-pkcs12,application/octet-stream"
          :icon="IconCertificate"
          :selected-file="selectedFile"
          @files-selected="onFilesSelected"
          @clear="clearSelectedFile"
 />

        <SToggle v-model="uploadAsDefault" label="Marcar como predeterminado" label-position="end" />

        <AdminButton
          variant="primary-outline"
          :disabled="isUploading || !selectedFile"
          @click="uploadCertificate"
        >
          {{ isUploading ? "Subiendo..." : "Guardar certificado" }}
        </AdminButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch, useId } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import { IconCertificate } from "@tabler/icons-vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";
import AppDeleteButton from "@/shared/components/buttons/AppDeleteButton.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import { API_ROUTES } from "@/core/config/apiConfig";


// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;
const props = defineProps({
  title: {
    type: String,
    default: "Certificados de firma"
  },
  description: {
    type: String,
    default: "Gestiona los certificados digitales asociados a tu perfil."
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selectedId: {
    type: [Number, String, null],
    default: null
  },
  refreshable: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(["select", "loaded"]);

const certificates = ref([]);
const isLoading = ref(false);
const isUploading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const selectedFile = ref(null);
const uploadLabel = ref("");
const uploadAsDefault = ref(false);
const internalSelectedId = ref(props.selectedId ? Number(props.selectedId) : null);

watch(
  () => props.selectedId,
  (value) => {
    internalSelectedId.value = value ? Number(value) : null;
  }
);

const token = computed(() => localStorage.getItem("token") || "");

const authHeaders = () => ({
  Authorization: `Bearer ${token.value}`
});

const clearMessages = () => {
  errorMessage.value = "";
  successMessage.value = "";
};

const loadCertificates = async () => {
  clearMessages();
  isLoading.value = true;
  try {
    const response = await fetch(API_ROUTES.USERS_MY_CERTIFICATES, {
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "No se pudieron cargar los certificados.");
    }
    certificates.value = Array.isArray(data?.certificates) ? data.certificates : [];
    emit("loaded", certificates.value);
    if (props.selectable && !internalSelectedId.value) {
      const defaultItem = certificates.value.find((item) => item.is_default) || certificates.value[0];
      if (defaultItem) {
        selectCertificate(defaultItem);
      }
    }
  } catch (error) {
    errorMessage.value = error.message || "No se pudieron cargar los certificados.";
  } finally {
    isLoading.value = false;
  }
};

const onFilesSelected = (files) => {
  selectedFile.value = files?.[0] || null;
  if (!uploadLabel.value && selectedFile.value) {
    uploadLabel.value = selectedFile.value.name.replace(/\.p12$/i, "");
  }
};

const clearSelectedFile = () => {
  selectedFile.value = null;
};

const uploadCertificate = async () => {
  if (!selectedFile.value) return;
  clearMessages();
  isUploading.value = true;
  try {
    const formData = new FormData();
    formData.append("certificate", selectedFile.value);
    formData.append("label", uploadLabel.value.trim() || selectedFile.value.name.replace(/\.p12$/i, ""));
    formData.append("is_default", uploadAsDefault.value ? "1" : "0");

    const response = await fetch(API_ROUTES.USERS_MY_CERTIFICATES, {
      method: "POST",
      headers: authHeaders(),
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "No se pudo guardar el certificado.");
    }
    successMessage.value = "Certificado guardado correctamente.";
    selectedFile.value = null;
    uploadLabel.value = "";
    uploadAsDefault.value = false;
    await loadCertificates();
  } catch (error) {
    errorMessage.value = error.message || "No se pudo guardar el certificado.";
  } finally {
    isUploading.value = false;
  }
};

const deleteCertificate = async (certificate) => {
  clearMessages();
  try {
    const response = await fetch(`${API_ROUTES.USERS_MY_CERTIFICATES}/${certificate.id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || "No se pudo eliminar el certificado.");
    }
    if (internalSelectedId.value === certificate.id) {
      internalSelectedId.value = null;
      emit("select", null);
    }
    successMessage.value = "Certificado eliminado.";
    await loadCertificates();
  } catch (error) {
    errorMessage.value = error.message || "No se pudo eliminar el certificado.";
  }
};

const downloadCertificate = async (certificate) => {
  clearMessages();
  try {
    const response = await fetch(API_ROUTES.USERS_MY_CERTIFICATE_DOWNLOAD(certificate.id), {
      headers: authHeaders()
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message || "No se pudo descargar el certificado.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = certificate.original_filename || "certificate.p12";
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    errorMessage.value = error.message || "No se pudo descargar el certificado.";
  }
};

const markDefault = async (certificate) => {
  clearMessages();
  try {
    const response = await fetch(API_ROUTES.USERS_MY_CERTIFICATE_DEFAULT(certificate.id), {
      method: "PUT",
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "No se pudo actualizar el certificado.");
    }
    successMessage.value = "Certificado predeterminado actualizado.";
    await loadCertificates();
    selectCertificate(data?.certificate || certificate);
  } catch (error) {
    errorMessage.value = error.message || "No se pudo actualizar el certificado.";
  }
};

const selectCertificate = (certificate) => {
  if (!props.selectable || !certificate) return;
  internalSelectedId.value = Number(certificate.id);
  emit("select", certificate);
};

const isSelected = (certificateId) =>
  props.selectable && Number(internalSelectedId.value) === Number(certificateId);

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-EC", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

onMounted(() => {
  loadCertificates();
});

defineExpose({
  loadCertificates
});
</script>
