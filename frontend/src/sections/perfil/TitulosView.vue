<template>
<div class="container-fluid py-4">
  <ProfileSectionShell
    title="Formación Profesional"
    subtitle="Registra tu formación académica y títulos obtenidos."
    @add="openModal"
  >
                
  
  <!-- Títulos de Cuarto Nivel -->
  <ProfileTableBlock title="Títulos de Cuarto Nivel">
      <div class="table-responsive">
        <table class="table table-striped table-hover align-middle table-institutional">
          <thead >
            <tr>
              <th width="5%"></th>
              <th class="text-start">TÍTULO</th>
              <th class="text-start">INSTITUCIÓN</th>
              <th class="text-start">TIPO</th>
              <th class="text-start">N.° DE REGISTRO SENESCYT</th>
              <th class="text-start">CAMPO</th>
              <th class="text-start">PAÍS</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="titulosCuartoNivel.length === 0">
              <td colspan="8" class="text-center text-muted">
                <p class="my-3">No hay títulos de cuarto nivel registrados</p>
              </td>
            </tr>
            <tr v-for="titulo in titulosCuartoNivel" :key="titulo._id">
              <td><BtnSera :type="getSeraType(titulo.sera)" @onpress="() => clickBtnsera(titulo)"/></td>
              <td>{{ titulo.titulo }}</td>
              <td>{{ titulo.ies }}</td>
              <td>{{ titulo.tipo }}</td>
              <td>{{ titulo.sreg || 'N/A' }}</td>
              <td>{{ titulo.campo_amplio }}</td>
              <td>{{ titulo.pais }}</td>
              <td>
                <div class="btn-group" role="group">
                  <button v-if="titulo.url_documento" class="btn btn-sm btn-outline-success" title="Ver documento" @click="openDocument(titulo)">
                    <IconFile size="16" />
                  </button>
                  <button class="btn btn-sm btn-outline-primary" title="Subir documento" @click="triggerFileUpload(titulo._id)">
                    <IconUpload size="16" />
                  </button>
                  <BtnDelete @onpress="() => deleteTitulo(titulo._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(titulo)"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  
  <!-- Títulos de Grado -->
  <ProfileTableBlock title="Títulos de Grado">
      <div class="table-responsive">
        <table class="table table-striped table-hover align-middle table-institutional">
          <thead >
            <tr>
              <th width="5%"></th>
              <th class="text-start">TÍTULO</th>
              <th class="text-start">INSTITUCIÓN</th>
              <th class="text-start">TIPO</th>
              <th class="text-start">N.° DE REGISTRO SENESCYT</th>
              <th class="text-start">CAMPO</th>
              <th class="text-start">PAÍS</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="titulosGrado.length === 0">
              <td colspan="8" class="text-center text-muted">
                <p class="my-3">No hay títulos de grado registrados</p>
              </td>
            </tr>
            <tr v-for="titulo in titulosGrado" :key="titulo._id">
              <td><BtnSera :type="getSeraType(titulo.sera)" @onpress="() => clickBtnsera(titulo)"/></td>
              <td>{{ titulo.titulo }}</td>
              <td>{{ titulo.ies }}</td>
              <td>{{ titulo.tipo }}</td>
              <td>{{ titulo.sreg || 'N/A' }}</td>
              <td>{{ titulo.campo_amplio }}</td>
              <td>{{ titulo.pais }}</td>
              <td>
                <div class="btn-group" role="group">
                  <button v-if="titulo.url_documento" class="btn btn-sm btn-outline-success" title="Ver documento" @click="openDocument(titulo)">
                    <IconFile size="16" />
                  </button>
                  <button class="btn btn-sm btn-outline-primary" title="Subir documento" @click="triggerFileUpload(titulo._id)">
                    <IconUpload size="16" />
                  </button>
                  <BtnDelete @onpress="() => deleteTitulo(titulo._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(titulo)"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  
  <!-- Títulos Técnicos y Tecnológicos -->
  <ProfileTableBlock title="Títulos Técnicos y Tecnológicos">
      <div class="table-responsive">
        <table class="table table-striped table-hover align-middle table-institutional">
          <thead >
            <tr>
              <th width="5%"></th>
              <th class="text-start">TÍTULO</th>
              <th class="text-start">INSTITUCIÓN</th>
              <th class="text-start">TIPO</th>
              <th class="text-start">N.° DE REGISTRO SENESCYT</th>
              <th class="text-start">CAMPO</th>
              <th class="text-start">PAÍS</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="titulosTecnicos.length === 0">
              <td colspan="8" class="text-center text-muted">
                <p class="my-3">No hay títulos técnicos/tecnológicos registrados</p>
              </td>
            </tr>
            <tr v-for="titulo in titulosTecnicos" :key="titulo._id">
              <td><BtnSera :type="getSeraType(titulo.sera)" @onpress="() => clickBtnsera(titulo)"/></td>
              <td>{{ titulo.titulo }}</td>
              <td>{{ titulo.ies }}</td>
              <td>{{ titulo.tipo }}</td>
              <td>{{ titulo.sreg || 'N/A' }}</td>
              <td>{{ titulo.campo_amplio }}</td>
              <td>{{ titulo.pais }}</td>
              <td>
                <div class="btn-group" role="group">
                  <button v-if="titulo.url_documento" class="btn btn-sm btn-outline-success" title="Ver documento" @click="openDocument(titulo)">
                    <IconFile size="16" />
                  </button>
                  <button class="btn btn-sm btn-outline-primary" title="Subir documento" @click="triggerFileUpload(titulo._id)">
                    <IconUpload size="16" />
                  </button>
                  <BtnDelete @onpress="() => deleteTitulo(titulo._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(titulo)"/>
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
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="tituloModalLabel">Agregar Título</h5>
        <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <AgregarTitulo @title-added="handleTituloAdded" />
      </div>
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
import AgregarTitulo from "./AgregarTitulo.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/sections/perfil/ProfileSectionShell.vue";
import ProfileTableBlock from "@/sections/perfil/ProfileTableBlock.vue";
import { Modal } from "@/utils/modalController";
import { API_PREFIX } from "@/services/apiConfig";
import { IconUpload, IconFile } from '@tabler/icons-vue';

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
        
        // Obtener usuario del localStorage
        const userDataString = localStorage.getItem('user');
        if (!userDataString) {
            console.error('No hay usuario logueado');
            return;
        }
        
        currentUser.value = JSON.parse(userDataString);
        console.log('👤 Usuario cargado:', currentUser.value);
        
        // Obtener dossier del backend
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}`;
        const response = await axios.get(url);
        
        if (response.data.success) {
            dossier.value = response.data.data;
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
