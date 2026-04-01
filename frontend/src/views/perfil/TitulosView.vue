<template>
<div class="profile-admin-skin w-full animate-fade-in">
  <ProfileSectionShell
    title="Formación Profesional"
    subtitle="Registra tu formación académica y títulos obtenidos."
    @add="openModal"
  >
                
  
  <!-- Títulos de Cuarto Nivel -->
  <ProfileTableBlock title="Títulos de Cuarto Nivel">
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">N.° DE REGISTRO SENESCYT</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CAMPO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PAÍS</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="titulosCuartoNivel.length === 0" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">
                <p class="my-3">No hay títulos de cuarto nivel registrados</p>
              </td>
            </tr>
            <tr v-for="titulo in titulosCuartoNivel" :key="titulo._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(titulo.sera)" @onpress="() => clickBtnsera(titulo)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.titulo }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.ies }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.tipo }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.sreg || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.campo_amplio }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.pais }}</td>
              <td class="px-4 py-3">
                <DossierDocumentActions
                  :has-document="Boolean(titulo.url_documento)"
                  @preview="previewDocument(titulo)"
                  @download="openDocument(titulo)"
                  @upload="triggerFileUpload(titulo._id)"
                  @delete="deleteTitulo(titulo._id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  
  <!-- Títulos de Grado -->
  <ProfileTableBlock title="Títulos de Grado">
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">N.° DE REGISTRO SENESCYT</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CAMPO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PAÍS</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="titulosGrado.length === 0" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">
                <p class="my-3">No hay títulos de grado registrados</p>
              </td>
            </tr>
            <tr v-for="titulo in titulosGrado" :key="titulo._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(titulo.sera)" @onpress="() => clickBtnsera(titulo)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.titulo }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.ies }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.tipo }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.sreg || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.campo_amplio }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.pais }}</td>
              <td class="px-4 py-3">
                <DossierDocumentActions
                  :has-document="Boolean(titulo.url_documento)"
                  @preview="previewDocument(titulo)"
                  @download="openDocument(titulo)"
                  @upload="triggerFileUpload(titulo._id)"
                  @delete="deleteTitulo(titulo._id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  
  <!-- Títulos Técnicos y Tecnológicos -->
  <ProfileTableBlock title="Títulos Técnicos y Tecnológicos">
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">N.° DE REGISTRO SENESCYT</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CAMPO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PAÍS</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="titulosTecnicos.length === 0" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">
                <p class="my-3">No hay títulos técnicos/tecnológicos registrados</p>
              </td>
            </tr>
            <tr v-for="titulo in titulosTecnicos" :key="titulo._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(titulo.sera)" @onpress="() => clickBtnsera(titulo)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.titulo }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.ies }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.tipo }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.sreg || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.campo_amplio }}</td>
              <td class="px-4 py-3 text-slate-700">{{ titulo.pais }}</td>
              <td class="px-4 py-3">
                <DossierDocumentActions
                  :has-document="Boolean(titulo.url_documento)"
                  @preview="previewDocument(titulo)"
                  @download="openDocument(titulo)"
                  @upload="triggerFileUpload(titulo._id)"
                  @delete="deleteTitulo(titulo._id)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>
  </ProfileSectionShell>
</div>


<!-- Modal -->
<AppModalShell
  ref="modal"
  id="tituloModal"
  labelled-by="tituloModalLabel"
  size="md"
  :show-header="false"
  body-class="p-0"
  content-class="profile-admin-skin"
>
  <AgregarTitulo @title-added="handleTituloAdded" />
</AppModalShell>

<!-- Input file oculto para subir documentos -->
<input 
  type="file" 
  ref="fileInput" 
  accept="application/pdf" 
  style="display: none" 
  @change="handleFileSelect"
>
<DossierPdfPreviewModal ref="pdfPreviewModal" />
</template>

<script setup>
import {ref, computed, onMounted, onBeforeUnmount} from "vue"
import AgregarTitulo from "./components/AgregarTitulo.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import DossierDocumentActions from "@/views/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/views/perfil/components/DossierPdfPreviewModal.vue";
import AppModalShell from "@/components/AppModalShell.vue";
import { mapDossierStatusToSeraType } from "@/views/perfil/utils/dossierStatus";
import { Modal } from "@/utils/modalController";
import DossierService from "@/services/dossier/DossierService";

const modal = ref(null);
const fileInput = ref(null);
const pdfPreviewModal = ref(null);
const selectedTituloId = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let modalInstance = null;

// Computed properties para agrupar títulos por nivel
const titulosTecnicos = computed(() => {
    if (!dossier.value || !dossier.value.titulos) return [];
    return dossier.value.titulos.filter(t => 
        t.nivel === 'Técnico' || t.nivel === 'Tecnólogo'
    );
});

const titulosGrado = computed(() => {
    if (!dossier.value || !dossier.value.titulos) return [];
    return dossier.value.titulos.filter(t => t.nivel === 'Grado');
});

const titulosCuartoNivel = computed(() => {
    if (!dossier.value || !dossier.value.titulos) return [];
    return dossier.value.titulos.filter(t => 
        t.nivel === 'Maestría' || 
        t.nivel === 'Maestría Tecnológica' || 
        t.nivel === 'Diplomado' || 
        t.nivel === 'Doctorado' || 
        t.nivel === 'Posdoctorado'
    );
});

// Cargar datos del usuario y su dossier
const loadDossier = async () => {
    try {
        loading.value = true;
        
        const data = await DossierService.getDossier();
        
        if (data.success) {
            dossier.value = data.data;
            currentUser.value = { cedula: DossierService.getCedula() };
            console.log('📋 Dossier cargado:', dossier.value);
        }
        
    } catch (error) {
        console.error('Error al cargar dossier:', error);
    } finally {
        loading.value = false;
    }
};

// Función para obtener el tipo de estado SERA
const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

// Función para eliminar título
const deleteTitulo = async (tituloId) => {
    if (!confirm('¿Estás seguro de eliminar este título?')) return;
    
    try {
        await DossierService.deleteTitulo(tituloId);
        
        // Recargar dossier
        await loadDossier();
        alert('Título eliminado correctamente');
    } catch (error) {
        console.error('Error al eliminar título:', error);
        alert('Error al eliminar el título');
    }
};

// Funciones placeholder (implementar después)
const clickBtnedit = (titulo) => {
    console.log('Editar título:', titulo);
    // TODO: Implementar edición
};

const clickBtnsera = (titulo) => {
    console.log('Ver estado SERA:', titulo);
    // TODO: Implementar visualización de estado
};

const openModal = () => {
    if (!modal.value?.el) {
        return;
    }
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const handleTituloAdded = () => {
    loadDossier();
};

const getDocumentBlob = async (tipoDocumento, registroId) => {
    const response = await DossierService.downloadDocument(tipoDocumento, registroId);
    return new Blob([response.data], { type: "application/pdf" });
};

const previewDocument = async (titulo) => {
    try {
        const blob = await getDocumentBlob("titulo", titulo._id);
        pdfPreviewModal.value?.openFromBlob(blob);
    } catch (error) {
        console.error("Error al previsualizar documento:", error);
        alert("Error al visualizar el documento");
    }
};

// Función para abrir el documento 
const openDocument = async (titulo) => {
    try {
        const blob = await getDocumentBlob("titulo", titulo._id);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${titulo.titulo || 'titulo'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
        }, 1000);
    } catch (error) {
        console.error('Error al abrir documento:', error);
        alert('Error al abrir el documento');
    }
};

// Función para activar el input file
const triggerFileUpload = (tituloId) => {
    selectedTituloId.value = tituloId;
    fileInput.value.click();
};

// Función para manejar la selección del archivo
const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        alert('Solo se permiten archivos PDF');
        event.target.value = '';
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('El archivo no puede superar los 10MB');
        event.target.value = '';
        return;
    }
    
    try {
        const response = await DossierService.uploadTituloDocument(selectedTituloId.value, file);
        
        if (response.success) {
            alert('Documento subido correctamente');
            await loadDossier();
        } else {
            alert('Error al subir documento: ' + response.message);
        }
        
    } catch (error) {
        console.error('Error al subir documento:', error);
        alert('Error al subir el documento');
    }
    
    // Limpiar el input
    event.target.value = '';
};

// Cargar datos al montar el componente
onMounted(() => {
    loadDossier();
    window.addEventListener('dossier-updated', loadDossier);
});

onBeforeUnmount(() => {
    if (modalInstance) {
        modalInstance.hide();
        modalInstance.dispose();
        modalInstance = null;
    }
    window.removeEventListener('dossier-updated', loadDossier);
});


/*
titulo:{type: Striewg,},
    ies:{type: String,},
    nivel:{type: String,required: true,
        enum:["Técnico","Tecnólogo","Grado", "Maestría", "Maestría Tecnológica", "Diplomado","Doctorado", "Posdoctorado"]
    },
    sreg:{type: String},//Número de registro en senescyt
    campo_amplio:{type: String},
    tipo:{type: String, required: true,
        enum:["Presencial","Semipresencial","Virtual", "Híbrido"]
    },
    pais:{type: String, default:"Ecuador"},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"], default: "Enviado"
    }

*/
</script>
