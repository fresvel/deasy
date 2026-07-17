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
    <div class="titulo-modal">
      <div class="titulo-grid titulo-grid--2">
        <div class="w-full space-y-2">
          <label class="profile-field-label">Título</label>
          <s-select
            :options="carreras"
            v-model="form.titulo"
            class="w-full"
          />
          <Transition name="titulo-fade">
            <input
              v-if="form.titulo === 'Otro'"
              type="text"
              class="profile-text-input mt-2"
              placeholder="Especifique el título"
              v-model="form.tituloPersonalizado"
            />
          </Transition>
        </div>

        <div class="w-full space-y-2">
          <label class="profile-field-label">Institución</label>
          <s-select
            :options="universidades"
            v-model="form.ies"
            class="w-full"
          />
          <Transition name="titulo-fade">
            <input
              v-if="form.ies === 'Otra'"
              type="text"
              class="profile-text-input mt-2"
              placeholder="Especifique la institución"
              v-model="form.iesPersonalizada"
            />
          </Transition>
        </div>
      </div>

      <div class="titulo-grid titulo-grid--2">
        <div class="w-full space-y-2">
          <label for="tipo" class="profile-field-label">Modalidad</label>
          <s-select
            id="tipo"
            :options="modalidades"
            v-model="form.tipo"
            class="w-full"
          />
        </div>

        <div class="w-full space-y-2">
          <label for="nivel" class="profile-field-label">Nivel</label>
          <s-select
            id="nivel"
            :options="niveles"
            v-model="form.nivel"
            class="w-full"
          />
        </div>
      </div>

      <div class="titulo-grid titulo-grid--2">
        <div class="w-full space-y-2">
          <label for="pais" class="profile-field-label">País de emisión</label>
          <s-select
            id="pais"
            :options="escountries"
            v-model="form.pais"
            class="w-full"
          />
        </div>

        <div class="w-full space-y-2">
          <label class="profile-field-label">Registro SENESCYT</label>
          <s-input label="" v-model="form.sreg" placeholder="Ej. 1020-2023-001" />
        </div>
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

      <div class="w-full space-y-2">
        <label class="profile-field-label">Documento <span class="titulo-label-hint">(opcional)</span></label>
        <div class="titulo-doc-field">
          <PdfDropField
            variant="compact"
            :title="hasExistingDocument ? 'Actualizar documento PDF' : ''"
            action-text="Seleccionar PDF"
            help-text="Máximo 10MB. Solo archivos PDF."
            input-id="titulo-documento"
            :icon="IconFileUpload"
            :selected-file="selectedFile"
            @files-selected="handleFileSelect"
            @clear="clearFile"
          />
        </div>

        <Transition name="titulo-fade">
          <div v-if="selectedFile" class="titulo-file-chip">
            <span class="titulo-file-chip__icon">
              <IconFileTypePdf :size="18" stroke-width="1.8" />
            </span>
            <span class="titulo-file-chip__info">
              <span class="titulo-file-chip__name">{{ selectedFile.name }}</span>
              <span class="titulo-file-chip__size">{{ selectedFileSize }}</span>
            </span>
            <button type="button" class="titulo-file-chip__remove" aria-label="Eliminar archivo" @click="clearFile">
              <IconX :size="15" stroke-width="2" />
            </button>
          </div>
        </Transition>

        <div v-if="hasExistingDocument && !selectedFile" class="mt-1 p-2 theme-info-panel flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs font-medium">Ya existe un documento cargado</span>
        </div>
      </div>
    </div>

  </ProfileModalLayout>
</template>

<script setup>
import ProfileModalLayout from "@/modules/perfil/components/dossier-preview/DossierModalLayout.vue";
import { reactive, ref, onMounted, defineEmits, watch, computed } from "vue";
import { Modal } from "@/shared/utils/modalController";
import DossierService from "@/modules/dossier/services/DossierService";
import SInput from "@/shared/components/forms/SInput.vue";
import SSelect from "@/shared/components/forms/SSelect.vue";
import { escountries } from "@/core/constants/countries";
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";
import { IconFileUpload, IconFileTypePdf, IconX } from "@tabler/icons-vue";

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
  "Escuela Politécnica Nacional", "Universidad de Guayaquil",
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

const selectedFileSize = computed(() => {
  const bytes = selectedFile.value?.size;
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

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

<style scoped>
.titulo-modal {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.titulo-modal .profile-field-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--brand-muted, #64748b);
}

.titulo-label-hint {
  text-transform: none;
  font-weight: 500;
  letter-spacing: normal;
  color: #94a3b8;
}

.titulo-modal :deep(.deasy-field-wrapper .deasy-field-label) {
  display: none;
}

.titulo-modal :deep(.deasy-field-wrapper) {
  width: 100%;
  padding: 0;
  margin-bottom: 0;
}

.titulo-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .titulo-grid--2 {
    grid-template-columns: 1fr 1fr;
  }
}

.titulo-doc-field :deep(.deasy-dropzone__selected) {
  display: none;
}

.titulo-doc-field :deep(.deasy-dropzone__surface--compact) {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0.85rem;
  padding: 0.85rem 1rem;
  text-align: left;
}

.titulo-doc-field :deep(.deasy-dropzone__icon--compact) {
  box-sizing: border-box;
  width: 2.15rem;
  height: 2.15rem;
  flex-shrink: 0;
  padding: 0.4rem;
  border-radius: 0.65rem;
  background: rgba(2, 132, 199, 0.1);
  color: var(--brand-primary, #0284c7);
}

.titulo-doc-field :deep(.deasy-dropzone__trigger--compact) {
  flex: 1;
  width: auto;
}

.titulo-file-chip {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(2, 132, 199, 0.18);
  background: rgba(2, 132, 199, 0.06);
  padding: 0.5rem 0.7rem;
}

.titulo-file-chip__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  flex-shrink: 0;
  border-radius: 0.6rem;
  background: #fff;
  color: var(--brand-primary, #0284c7);
}

.titulo-file-chip__info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  line-height: 1.25;
}

.titulo-file-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--brand-ink, #1e293b);
}

.titulo-file-chip__size {
  font-size: 0.72rem;
  color: var(--brand-muted, #94a3b8);
}

.titulo-file-chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  flex-shrink: 0;
  border-radius: 999px;
  color: #94a3b8;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.titulo-file-chip__remove:hover {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.titulo-fade-enter-active,
.titulo-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.titulo-fade-enter-from,
.titulo-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>