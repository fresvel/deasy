<template>
<div class="container-fluid py-4">
  <div class="profile-section-header">
    <div>
      <h2 class="text-start profile-section-title">Formación Profesional</h2>
    </div>
    <div class="profile-section-actions">
      <button class="btn btn-primary btn-lg profile-add-btn" @click="openModal()">
        <font-awesome-icon icon="plus" class="me-2"/>
        Agregar
      </button>
    </div>
  </div>
                
  
  <!-- Títulos Técnicos y Tecnológicos -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Títulos Técnicos y Tecnológicos</h3>
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
                  <BtnDelete @onpress="() => deleteTitulo(titulo._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(titulo)"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  
  <!-- Títulos de Grado -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Títulos de Grado</h3>
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
                  <BtnDelete @onpress="() => deleteTitulo(titulo._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(titulo)"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  
  <!-- Títulos de Cuarto Nivel -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Títulos de Cuarto Nivel</h3>
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
                  <BtnDelete @onpress="() => deleteTitulo(titulo._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(titulo)"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>


<!-- Modal Bootstrap -->
<div class="modal fade" id="tituloModal" tabindex="-1" aria-labelledby="tituloModalLabel" aria-hidden="true" ref="modal">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="tituloModalLabel">Agregar Título</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <AgregarTitulo @title-added="handleTituloAdded" />
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import {ref, computed, onMounted, onBeforeUnmount} from "vue"
import axios from 'axios';
import AgregarTitulo from "./AgregarTitulo.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import { Modal } from "bootstrap";

const modal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let bootstrapModal = null;

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
        const url = `http://localhost:3000/easym/v1/dossier/${currentUser.value.cedula}`;
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
        const url = `http://localhost:3000/easym/v1/dossier/${currentUser.value.cedula}/titulos/${tituloId}`;
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
    bootstrapModal = Modal.getOrCreateInstance(modal.value);
    bootstrapModal.show();
};

const handleTituloAdded = () => {
    loadDossier();
};

// Cargar datos al montar el componente
onMounted(() => {
    loadDossier();
    window.addEventListener('dossier-updated', loadDossier);
});

onBeforeUnmount(() => {
    if (bootstrapModal) {
        bootstrapModal.hide();
        bootstrapModal.dispose();
        bootstrapModal = null;
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
