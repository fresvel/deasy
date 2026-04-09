<template>
  <ProfileModalLayout 
    :title="isEditing ? 'Editar título académico' : 'Agregar título académico'" 
    description="Completa los campos con los datos oficiales del título registrado." 
    :errorMessage="errorMessage" 
    :isSubmitting="isSubmitting" 
    :submitText="isEditing ? 'Actualizar' : 'Guardar'" 
    @submit="onSubmit" 
    @cancel="onCancel"
  >
    <div class="w-full space-y-2">
      <label class="profile-field-label">Título</label>
      <s-select
        :options="carreras"
        v-model="form.titulo"
        class="w-full mb-2"
      />
      <input
        v-if="form.titulo === 'Otro'"
        type="text"
        class="profile-text-input"
        placeholder="Especifique el título"
        v-model="form.tituloPersonalizado"
      />
    </div>

    <div class="w-full space-y-2">
      <label class="profile-field-label">Institución</label>
      <s-select
        :options="universidades"
        v-model="form.ies"
        class="w-full mb-2"
      />
      <input
        v-if="form.ies === 'Otra'"
        type="text"
        class="profile-text-input"
        placeholder="Especifique la institución"
        v-model="form.iesPersonalizada"
      />
    </div>

    <div class="w-full space-y-2">
      <label for="pais" class="profile-field-label">País de emisión</label>
      <s-select
        id="pais"
        :options="escountries"
        v-model="form.pais"
        class="w-full"
      />
    </div>

    <div class="w-full">
      <s-input label="Número de registro" v-model="form.sreg" placeholder="Registro SENESCYT" />
    </div>

    <div class="w-full">
      <label for="tipo" class="profile-field-label">Modalidad</label>
      <s-select
        id="tipo"
        :options="modalidades"
        v-model="form.tipo"
        class="w-full"
      />
    </div>

    <div class="w-full">
      <label for="nivel" class="profile-field-label">Nivel</label>
      <s-select
        id="nivel"
        :options="niveles"
        v-model="form.nivel"
        class="w-full"
      />
    </div>

    <div class="w-full space-y-2">
      <label for="campo" class="profile-field-label">Campo de conocimiento</label>
      <textarea
        id="campo"
        v-model="form.campo_amplio"
        class="profile-textarea"
        rows="2"
        placeholder="Ej. Ingeniería, Ciencias Sociales, Educación..."
      ></textarea>
    </div>

    <div class="w-full">
      <PdfDropField
        variant="compact"
        :title="hasExistingDocument ? 'Actualizar documento PDF' : 'Documento PDF (opcional)'"
        action-text="Seleccionar PDF"
        help-text="Máximo 10MB. Solo archivos PDF."
        input-id="titulo-documento"
        :selected-file="selectedFile"
        @files-selected="handleFileSelect"
        @clear="clearFile"
      />
      <div v-if="hasExistingDocument && !selectedFile" class="mt-2 p-2 theme-info-panel flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs font-medium">Ya existe un documento cargado</span>
      </div>
    </div>

  </ProfileModalLayout>
</template>

<script setup>
import ProfileModalLayout from "@/shared/components/forms/AppFormModalLayout.vue";
import { reactive, ref, onMounted, defineEmits, watch, computed } from "vue";
import { Modal } from "@/shared/utils/modalController";
import DossierService from "@/modules/dossier/services/DossierService";
import SInput from "@/shared/components/forms/SInput.vue";
import SSelect from "@/shared/components/forms/SSelect.vue";
import { escountries } from "@/core/constants/countries";
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";

const props = defineProps({
  editingItem: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["title-added", "title-updated"]);

const isEditing = computed(() => !!props.editingItem);
const hasExistingDocument = computed(() => !!props.editingItem?.url_documento);

const form = reactive({
  titulo: "",
  tituloPersonalizado: "",
  ies: "",
  iesPersonalizada: "",
  pais: "Ecuador",
  sreg: "",
  tipo: "Presencial",
  nivel: "Grado",
  campo_amplio: ""
});

const carreras = [
  "Administración de Empresas", "Arquitectura", "Contabilidad y Auditoría", "Derecho", "Educación Básica",
  "Enfermería", "Ingeniería Civil", "Ingeniería Industrial", "Ingeniería en Sistemas", "Medicina",
  "Psicología", "Turismo", "Otro"
];

const universidades = [
  "Pontificia Universidad Católica del Ecuador", "Escuela Politécnica Nacional", "Universidad de Guayaquil",
  "Universidad Central del Ecuador", "Escuela Superior Politécnica del Litoral", "Universidad San Francisco de Quito",
  "Universidad Técnica Particular de Loja", "Universidad de las Américas", "Universidad de Cuenca", "Otra"
];

const modalidades = ["Presencial", "Semipresencial", "Virtual", "Híbrido"];
const niveles = [
  "Grado", "Maestría", "Maestría Tecnológica", "Diplomado", "Doctorado", "Posdoctorado",
  "Técnico", "Tecnólogo"
];

const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedFile = ref(null);

const resetForm = () => {
  form.titulo = "";
  form.tituloPersonalizado = "";
  form.ies = "";
  form.iesPersonalizada = "";
  form.pais = "Ecuador";
  form.sreg = "";
  form.tipo = "Presencial";
  form.nivel = "Grado";
  form.campo_amplio = "";
  errorMessage.value = "";
  selectedFile.value = null;
};

const closeModal = () => {
  const modalElement = document.getElementById("tituloModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

watch(() => props.editingItem, (newVal) => {
  if (newVal) {
    if (carreras.includes(newVal.titulo)) {
      form.titulo = newVal.titulo;
      form.tituloPersonalizado = "";
    } else {
      form.titulo = "Otro";
      form.tituloPersonalizado = newVal.titulo || "";
    }

    if (universidades.includes(newVal.ies)) {
      form.ies = newVal.ies;
      form.iesPersonalizada = "";
    } else {
      form.ies = "Otra";
      form.iesPersonalizada = newVal.ies || "";
    }

    form.pais = newVal.pais || "Ecuador";
    form.sreg = newVal.sreg || "";
    form.tipo = newVal.tipo || "Presencial";
    form.nivel = newVal.nivel || "Grado";
    form.campo_amplio = newVal.campo_amplio || "";
  } else {
    resetForm();
  }
}, { immediate: true });

const handleFileSelect = (files) => {
  const file = files?.[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    alert('Solo se permiten archivos PDF');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo no puede superar los 10MB');
    return;
  }
  selectedFile.value = file;
};

const clearFile = () => {
  selectedFile.value = null;
};

const onCancel = () => {
  resetForm();
  closeModal();
};

const buildPayload = () => {
  return {
    titulo: form.titulo === "Otro" ? form.tituloPersonalizado.trim() : form.titulo,
    ies: form.ies === "Otra" ? form.iesPersonalizada.trim() : form.ies,
    pais: form.pais,
    sreg: form.sreg,
    tipo: form.tipo,
    nivel: form.nivel,
    campo_amplio: form.campo_amplio,
    sera: "Enviado"
  };
};

const validate = () => {
  const payload = buildPayload();
  if (!payload.titulo) return "Debe indicar el título obtenido.";
  if (!payload.ies) return "Debe indicar la institución.";
  return "";
};

const onSubmit = async () => {
  const error = validate();
  if (error) {
    errorMessage.value = error;
    return;
  }

  try {
    isSubmitting.value = true;
    errorMessage.value = "";
    const payload = buildPayload();

    let recordId = null;
    if (isEditing.value) {
      const response = await DossierService.updateTitulo(props.editingItem._id, payload);
      recordId = props.editingItem._id;
      emit("title-updated", response.data);
    } else {
      const response = await DossierService.createTitulo(payload);
      const list = response.data?.titulos || [];
      recordId = list[list.length - 1]?._id;
      emit("title-added", response.data);
    }

    if (selectedFile.value && recordId) {
      await DossierService.uploadTituloDocument(recordId, selectedFile.value);
    }

    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar título:", error);
    errorMessage.value = error?.response?.data?.message || "No se pudo guardar el título.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
