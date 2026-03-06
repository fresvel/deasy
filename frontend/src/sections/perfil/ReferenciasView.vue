<template>
<div class="container-fluid py-4">
  <ProfileSectionShell
    title="Referencias"
    subtitle="Agrega referencias laborales, familiares y personales."
    @add="openModal"
  >
                
  
  <!-- Referencias Laborales -->
  <ProfileTableBlock title="Referencias laborales">
      <div class="table-responsive">
        <table class="table table-striped table-hover table-institutional align-middle">
          <thead >
            <tr>
              <th width="5%"></th>
              <th class="text-start">REFERENCIA</th>
              <th class="text-start">CARGO</th>
              <th class="text-start">CORREO</th>
              <th class="text-start">TELÉFONO</th>
              <th class="text-start">INSTITUCIÓN</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="referenciasLaborales.length === 0">
              <td colspan="7" class="text-center text-muted">
                <p class="my-3">No hay referencias laborales registradas</p>
              </td>
            </tr>
            <tr v-for="ref in referenciasLaborales" :key="ref._id">
              <td><BtnSera :type="getSeraType(ref.sera)" @onpress="() => clickBtnsera(ref)"/></td>
              <td>{{ ref.nombre }}</td>
              <td>{{ ref.cargo_parentesco }}</td>
              <td>{{ ref.email }}</td>
              <td>{{ ref.telefono }}</td>
              <td>{{ ref.institution }}</td>
              <td>
                <div class="btn-group" role="group">
                  <BtnDelete @onpress="() => deleteReferencia(ref._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(ref)"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  <!-- Referencias Familiares -->
  <ProfileTableBlock title="Referencias familiares">
      <div class="table-responsive">
        <table class="table table-striped table-hover table-institutional align-middle">
          <thead >
            <tr>
              <th width="5%"></th>
              <th class="text-start">REFERENCIA</th>
              <th class="text-start">PARENTESCO</th>
              <th class="text-start">CORREO</th>
              <th class="text-start">TELÉFONO</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="referenciasFamiliares.length === 0">
              <td colspan="6" class="text-center text-muted">
                <p class="my-3">No hay referencias familiares registradas</p>
              </td>
            </tr>
            <tr v-for="ref in referenciasFamiliares" :key="ref._id">
              <td><BtnSera :type="getSeraType(ref.sera)" @onpress="() => clickBtnsera(ref)"/></td>
              <td>{{ ref.nombre }}</td>
              <td>{{ ref.cargo_parentesco }}</td>
              <td>{{ ref.email }}</td>
              <td>{{ ref.telefono }}</td>
              <td>
                <div class="btn-group" role="group">
                  <BtnDelete @onpress="() => deleteReferencia(ref._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(ref)"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  <!-- Referencias Personales -->
  <ProfileTableBlock title="Referencias personales">
      <div class="table-responsive">
        <table class="table table-striped table-hover table-institutional align-middle">
          <thead >
            <tr>
              <th width="5%"></th>
              <th class="text-start">REFERENCIA</th>
              <th class="text-start">CORREO</th>
              <th class="text-start">TELÉFONO</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="referenciasPersonales.length === 0">
              <td colspan="5" class="text-center text-muted">
                <p class="my-3">No hay referencias personales registradas</p>
              </td>
            </tr>
            <tr v-for="ref in referenciasPersonales" :key="ref._id">
              <td><BtnSera :type="getSeraType(ref.sera)" @onpress="() => clickBtnsera(ref)"/></td>
              <td>{{ ref.nombre }}</td>
              <td>{{ ref.email }}</td>
              <td>{{ ref.telefono }}</td>
              <td>
                <div class="btn-group" role="group">
                  <BtnDelete @onpress="() => deleteReferencia(ref._id)"/>
                  <BtnEdit @onpress="() => clickBtnedit(ref)"/>
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
<div class="modal fade" id="referenciaModal" tabindex="-1" aria-labelledby="referenciaModalLabel" aria-hidden="true" ref="modal">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="referenciaModalLabel">Agregar Referencia</h5>
        <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
      </div>
          <div class="modal-body">
        <AgregarReferencia @referencia-added="handleReferenciaAdded" />
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import {ref, computed, onMounted, onBeforeUnmount} from "vue"
import axios from 'axios';
import { Modal } from "@/utils/modalController";
import AgregarReferencia from "./AgregarReferencia.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/sections/perfil/ProfileSectionShell.vue";
import ProfileTableBlock from "@/sections/perfil/ProfileTableBlock.vue";
import { API_PREFIX } from "@/services/apiConfig";

const modal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let modalInstance = null;

// Computed properties para agrupar referencias por tipo
const referenciasLaborales = computed(() => {
    if (!dossier.value || !dossier.value.referencias) return [];
    return dossier.value.referencias.filter(r => r.tipo === 'laboral');
});

const referenciasFamiliares = computed(() => {
    if (!dossier.value || !dossier.value.referencias) return [];
    return dossier.value.referencias.filter(r => r.tipo === 'familiar');
});

const referenciasPersonales = computed(() => {
    if (!dossier.value || !dossier.value.referencias) return [];
    return dossier.value.referencias.filter(r => r.tipo === 'personal');
});

// Cargar dossier del usuario
const loadDossier = async () => {
    try {
        loading.value = true;
        
        const userDataString = localStorage.getItem('user');
        if (!userDataString) {
            console.error('No hay usuario logueado');
            return;
        }
        
        currentUser.value = JSON.parse(userDataString);
        
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}`;
        const response = await axios.get(url);
        
        if (response.data.success) {
            dossier.value = response.data.data;
            console.log('📋 Referencias cargadas:', dossier.value.referencias);
        }
        
    } catch (error) {
        console.error('Error al cargar referencias:', error);
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

// Función para eliminar referencia
const deleteReferencia = async (referenciaId) => {
    if (!confirm('¿Estás seguro de eliminar esta referencia?')) return;
    
    try {
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/referencias/${referenciaId}`;
        await axios.delete(url);
        
        await loadDossier();
        alert('Referencia eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar referencia:', error);
        alert('Error al eliminar la referencia');
    }
};

const clickBtnedit = (ref) => {
    console.log('Editar referencia:', ref);
    // TODO: Implementar edición
};

const clickBtnsera = (ref) => {
    console.log('Ver estado SERA:', ref);
    // TODO: Implementar visualización de estado
};

const openModal = () => {
    if (!modal.value) {
        return;
    }
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
};

const handleReferenciaAdded = () => {
    loadDossier();
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
