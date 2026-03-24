<template>
<div class="w-full animate-fade-in">
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
                <div class="flex items-center gap-1">
                  <button v-if="titulo.url_documento" @click="openDocument(titulo)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(titulo._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="deleteTitulo(titulo._id)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                    <IconTrash :size="16" />
                  </button>
                </div>
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
                <div class="flex items-center gap-1">
                  <button v-if="titulo.url_documento" @click="openDocument(titulo)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(titulo._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="deleteTitulo(titulo._id)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                    <IconTrash :size="16" />
                  </button>
                </div>
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
                <div class="flex items-center gap-1">
                  <button v-if="titulo.url_documento" @click="openDocument(titulo)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(titulo._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="deleteTitulo(titulo._id)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                    <IconTrash :size="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>
  </ProfileSectionShell>
</div>


<!-- Modal -->
<div class="modal fade" id="tituloModal" tabindex="-1" aria-labelledby="tituloModalLabel" aria-hidden="true" ref="modal">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content border-0 shadow-lg rounded-2xl overflow-hidden p-0">
      <AgregarTitulo @title-added="handleTituloAdded" />
    </div>
  </div>
</div>

<!-- Input file oculto para subir documentos -->
<input 
  type="file" 
  ref="fileInput" 
  accept="application/pdf" 
  style="display: none" 
  @change="handleFileSelect"
>
</template>

<script setup>
import {ref, computed, onMounted, onBeforeUnmount} from "vue"
import axios from 'axios';
import AgregarTitulo from "./components/AgregarTitulo.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import { Modal } from "@/utils/modalController";
import { API_PREFIX } from "@/services/apiConfig";
import DossierService from "@/services/dossier/DossierService";
import { IconUpload, IconFile, IconTrash } from '@tabler/icons-vue';

const modal = ref(null);
const fileInput = ref(null);
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
const getSeraType = (sera) => {
    if (!sera || sera === 'Enviado') return 'pending';
    if (sera === 'Revisado') return 'reviewed';
    if (sera === 'Aprobado') return 'certified';
    return 'denied';
};

// Función para eliminar título
const deleteTitulo = async (tituloId) => {
    if (!confirm('¿Estás seguro de eliminar este título?')) return;
    
    try {
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/titulos/${tituloId}`;
        await axios.delete(url);
        
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
    if (!modal.value) {
        return;
    }
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
};

const handleTituloAdded = () => {
    loadDossier();
};

// Función para abrir el documento 
const openDocument = async (titulo) => {
    try {
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/documentos/titulo/${titulo._id}`;
        
        const response = await axios.get(url, {
            responseType: 'blob'
        });
        
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        
        window.open(blobUrl, '_blank');
        
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
        const formData = new FormData();
        formData.append('archivo', file);
        
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/documentos/titulo/${selectedTituloId.value}`;
        
        const response = await axios.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        if (response.data.success) {
            alert('Documento subido correctamente');
            await loadDossier();
        } else {
            alert('Error al subir documento: ' + response.data.message);
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
