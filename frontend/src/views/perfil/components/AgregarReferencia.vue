<template>
<ProfileModalLayout title="Agregar referencia" description="Danos información de una referencia que pueda certificar tu desempeño." :errorMessage="errorMessage" :isSubmitting="isSubmitting" submitText="Guardar" @submit="onSubmit" @cancel="onCancel">
      <div class="w-full">
        <label class="form-label">Tipo de referencia</label>
        <SSelect
          :options="['laboral', 'personal', 'familiar']"
          v-model="form.tipo"
        />
      </div>

      <div class="w-full" v-if="form.tipo === 'laboral'">
        <label class="form-label">Institución</label>
        <input
          type="text"
          class="form-control "
          placeholder="Nombre de la institución o empresa"
          v-model="form.institution"
        />
      </div>

      <div class="w-full">
        <label class="form-label">Nombres</label>
        <input
          type="text"
          class="form-control "
          placeholder="Nombres completos"
          v-model="form.nombre"
        />
      </div>

      <div class="w-full">
        <label class="form-label">{{ form.tipo === 'laboral' ? 'Cargo' : form.tipo === 'familiar' ? 'Parentesco' : 'Cargo/Parentesco' }}</label>
        <input
          type="text"
          class="form-control "
          :placeholder="form.tipo === 'laboral' ? 'Cargo en la institución' : form.tipo === 'familiar' ? 'Ej: Padre, Madre, Hermano' : 'Cargo o parentesco'"
          v-model="form.cargo_parentesco"
        />
      </div>

      <div class="w-full">
        <label class="form-label">Correo electrónico</label>
        <input
          type="email"
          class="form-control "
          placeholder="usuario@dominio.com"
          v-model="form.email"
        />
      </div>

      <div class="w-full">
        <label class="form-label">Teléfono</label>
        <input
          type="text"
          class="form-control "
          placeholder="+593987654321"
          v-model="form.telefono"
        />
      </div>

      <div class="w-full">
        <label for="documento" class="form-label">Documento PDF (opcional)</label>
        <input
          type="file"
          id="documento"
          ref="fileInput"
          class="form-control"
          accept="application/pdf"
          @change="handleFileSelect"
        />
        <small class="text-muted d-block">Máximo 10MB. Solo archivos PDF.</small>
        <div v-if="selectedFile" class="mt-2">
          <span class="badge bg-success d-inline-flex align-items-center gap-1">
            <IconFile :size="14" />
            {{ selectedFile.name }}
          </span>
          <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2" @click="clearFile">
            Eliminar
          </button>
        </div>
      </div>

      </ProfileModalLayout>
</template>

<script setup>
import ProfileModalLayout from "@/components/ProfileModalLayout.vue";
import { reactive, ref, onMounted, defineEmits } from "vue";
import { Modal } from "@/utils/modalController";
import DossierService from "@/services/dossier/DossierService";
import { IconFile } from '@tabler/icons-vue';
import SSelect from "@/components/SSelect.vue";

const emit = defineEmits(["referencia-added"]);

const form = reactive({
  tipo: "laboral",
  nombre: "",
  cargo_parentesco: "",
  email: "",
  telefono: "",
  institution: ""
});

const isSubmitting = ref(false);
const errorMessage = ref("");
const fileInput = ref(null);
const selectedFile = ref(null);

onMounted(() => {
});

const closeModal = () => {
  const modalElement = document.getElementById("referenciaModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

const resetForm = () => {
  form.tipo = "laboral";
  form.nombre = "";
  form.cargo_parentesco = "";
  form.email = "";
  form.telefono = "";
  form.institution = "";
  errorMessage.value = "";
  selectedFile.value = null;
};

const onCancel = () => {
  resetForm();
  closeModal();
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.type !== 'application/pdf') {
    alert('Solo se permiten archivos PDF');
    event.target.value = '';
    selectedFile.value = null;
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo no puede superar los 10MB');
    event.target.value = '';
    selectedFile.value = null;
    return;
  }
  
  selectedFile.value = file;
};

const clearFile = () => {
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const uploadDocument = async (registroId) => {
  if (!selectedFile.value) return;
  
  try {
    await DossierService.uploadReferenciaDocument(registroId, selectedFile.value);
  } catch (error) {
    console.error('Error al subir documento:', error);
    throw error;
  }
};

const buildPayload = () => {
  const payload = {
    tipo: form.tipo,
    nombre: form.nombre.trim(),
    email: form.email.trim(),
    telefono: form.telefono.trim(),
    cargo_parentesco: form.cargo_parentesco.trim() || "",
    institution: form.institution.trim() || "",
    sera: "Enviado"
  };

  return payload;
};

const validatePayload = (payload) => {
  if (!payload.nombre || payload.nombre.trim() === '') {
    return "Debe indicar el nombre de la referencia.";
  }
  if (!payload.email || payload.email.trim() === '') {
    return "Debe indicar el correo electrónico.";
  }
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(payload.email)) {
    return "El correo electrónico no es válido.";
  }
  if (payload.tipo !== 'personal' && (!payload.cargo_parentesco || payload.cargo_parentesco.trim() === '')) {
    return `Debe indicar ${payload.tipo === 'laboral' ? 'el cargo' : 'el parentesco'}.`;
  }
  if (payload.tipo === 'laboral' && (!payload.institution || payload.institution.trim() === '')) {
    return "Debe indicar la institución para referencias laborales.";
  }
  return "";
};

const onSubmit = async () => {
  if (isSubmitting.value) {
    return;
  }

  const payload = buildPayload();
  const validationError = validatePayload(payload);
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  try {
    isSubmitting.value = true;
    errorMessage.value = "";

    const response = await DossierService.createReferencia(payload);

    const refCreada = response.data?.referencias?.slice(-1)[0];

    if (selectedFile.value && refCreada?._id) {
      await DossierService.uploadReferenciaDocument(refCreada._id, selectedFile.value);
    }

    emit("referencia-added", payload);
    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar la referencia:", error);
    errorMessage.value =
      error?.response?.data?.message || "No se pudo guardar la referencia.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.modal-title {
  color: var(--brand-navy);
}

.form-label {
  font-weight: 600;
  color: var(--brand-ink);
}

.btn-primary {
  border-radius: 0.75rem;
  padding: 0.6rem 1.8rem;
  font-weight: 600;
  background: var(--brand-gradient);
  border: none;
}

.btn-primary:hover {
  opacity: 0.92;
}
</style>
