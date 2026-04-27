<template>
  <div class="flex flex-col gap-4">
    <div v-if="title" class="flex items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-bold text-slate-800 m-0">{{ title }}</h3>
        <p v-if="description" class="text-sm text-slate-500 m-0 mt-1">{{ description }}</p>
      </div>
      <AdminButton
        v-if="refreshable"
        variant="secondary"
        size="sm"
        :disabled="isLoading"
        @click="loadCertificates"
      >
        Actualizar
      </AdminButton>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4">
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div v-if="errorMessage" class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ successMessage }}
        </div>

        <div v-if="isLoading" class="py-8 text-center text-sm text-slate-500 font-medium">
          Cargando certificados...
        </div>

        <div v-else-if="!certificates.length" class="py-8 text-center text-sm text-slate-500 font-medium">
          No hay certificados cargados.
        </div>

        <div v-else class="flex flex-col gap-3">
          <button
            v-for="certificate in certificates"
            :key="certificate.id"
            type="button"
            class="w-full rounded-2xl border px-4 py-4 text-left transition shadow-sm"
            :class="isSelected(certificate.id) ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
            @click="selectCertificate(certificate)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-bold text-slate-800 truncate">{{ certificate.label }}</span>
                  <AppTag v-if="certificate.is_default" variant="info">Predeterminado</AppTag>
                </div>
                <div class="mt-1 text-xs text-slate-500 break-all">{{ certificate.original_filename }}</div>
                <div class="mt-1 text-xs text-slate-400">
                  {{ formatDate(certificate.created_at) }}
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0" @click.stop>
                <AdminButton
                  v-if="!certificate.is_default"
                  variant="outlinePrimary"
                  size="sm"
                  @click="markDefault(certificate)"
                >
                  Usar por defecto
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  size="sm"
                  @click="downloadCertificate(certificate)"
                >
                  Descargar
                </AdminButton>
                <BtnDelete message="Eliminar" @onpress="deleteCertificate(certificate)" />
              </div>
            </div>
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-4">
        <div>
          <h4 class="text-sm font-bold text-slate-800 m-0">Subir certificado</h4>
          <p class="text-xs text-slate-500 m-0 mt-1">
            El archivo `.p12` ya está protegido por contraseña. Solo los endpoints autenticados pueden descargarlo.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-700">Nombre visible</label>
          <input
            v-model="uploadLabel"
            type="text"
            class="block w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Ej: Token personal 2026"
          />
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

        <label class="inline-flex items-center gap-2 text-sm text-slate-600">
          <input v-model="uploadAsDefault" type="checkbox" class="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
          Marcar como predeterminado
        </label>

        <AdminButton
          variant="primary"
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
import { computed, onMounted, ref, watch } from "vue";
import { IconCertificate } from "@tabler/icons-vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import PdfDropField from "@/modules/firmas/components/PdfDropField.vue";
import BtnDelete from "@/shared/components/buttons/BtnDelete.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import { API_ROUTES } from "@/core/config/apiConfig";

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
