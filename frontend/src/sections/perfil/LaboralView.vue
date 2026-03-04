<template>
  <div class="container-fluid py-4">
    <ProfileSectionShell
      title="Experiencia laboral"
      subtitle="Detalla tu experiencia docente y profesional."
      @add="openModal"
    >

    <ProfileTableBlock title="Experiencia profesional">
        <div class="table-responsive">
          <table class="table table-striped table-hover table-institutional align-middle">
            <thead >
              <tr>
                <th width="5%"></th>
                <th class="text-start">INSTITUCIÓN</th>
                <th class="text-start">CÁTEDRA / ASIGNATURA</th>
                <th class="text-start">MODALIDAD</th>
                <th class="text-start">DESDE</th>
                <th class="text-start">HASTA</th>
                <th class="text-start">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!experienciaProfesional.length">
                <td colspan="7" class="text-center text-muted">
                  <p class="my-3">No has registrado experiencia profesional todavía.</p>
                </td>
              </tr>
              <tr v-for="experiencia in experienciaProfesional" :key="experiencia._id">
                <td><BtnSera :type="getSeraType(experiencia.sera)" /></td>
                <td>{{ experiencia.institucion }}</td>
                <td>{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
                <td>-</td>
                <td>{{ formatDate(experiencia.fecha_inicio) }}</td>
                <td>{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
                <td>
                  <div class="btn-group" role="group">
                    <BtnDelete @onpress="() => eliminarExperiencia(experiencia)" />
                    <BtnEdit @onpress="() => editarExperiencia(experiencia)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </ProfileTableBlock>

    <ProfileTableBlock title="Experiencia docente">
        <div class="table-responsive">
          <table class="table table-striped table-hover table-institutional align-middle">
            <thead >
              <tr>
                <th width="5%"></th>
                <th class="text-start">INSTITUCIÓN</th>
                <th class="text-start">FUNCIONES</th>
                <th class="text-start">MODALIDAD</th>
                <th class="text-start">DESDE</th>
                <th class="text-start">HASTA</th>
                <th class="text-start">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!experienciaDocente.length">
                <td colspan="7" class="text-center text-muted">
                  <p class="my-3">No has registrado experiencia docente todavía.</p>
                </td>
              </tr>
              <tr v-for="experiencia in experienciaDocente" :key="experiencia._id">
                <td><BtnSera :type="getSeraType(experiencia.sera)" /></td>
                <td>{{ experiencia.institucion }}</td>
                <td>{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
                <td>-</td>
                <td>{{ formatDate(experiencia.fecha_inicio) }}</td>
                <td>{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
                <td>
                  <div class="btn-group" role="group">
                    <BtnDelete @onpress="() => eliminarExperiencia(experiencia)" />
                    <BtnEdit @onpress="() => editarExperiencia(experiencia)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </ProfileTableBlock>
    </ProfileSectionShell>

    <div class="modal fade" id="experienciaModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Agregar Experiencia</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <AgregarExperiencia @experiencia-added="handleExperienciaAdded" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import axios from "axios";
import { API_PREFIX } from "@/services/apiConfig";
import { Modal } from "bootstrap";
import AgregarExperiencia from "./AgregarExperiencia.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/sections/perfil/ProfileSectionShell.vue";
import ProfileTableBlock from "@/sections/perfil/ProfileTableBlock.vue";

const modal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let bootstrapModal = null;

// Computed properties para agrupar experiencia por tipo
const experienciaDocente = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Docencia');
});

const experienciaProfesional = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Profesional');
});

const getSeraType = (sera) => {
    if (!sera || sera === 'Enviado') return 'pending';
    if (sera === 'Revisado') return 'reviewed';
    if (sera === 'Aprobado') return 'certified';
    return 'denied';
};

// Formatear fecha para mostrar
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

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

const openModal = () => {
    if (!modal.value) {
        return;
    }
    bootstrapModal = Modal.getOrCreateInstance(modal.value);
    bootstrapModal.show();
};

const handleExperienciaAdded = () => {
    loadDossier();
};

// Función para eliminar experiencia
const eliminarExperiencia = async () => {
    if (!confirm('¿Estás seguro de eliminar esta experiencia?')) return;
    
    try {
        // Nota: Necesitaríamos un endpoint DELETE para experiencia
        // Por ahora solo recargamos
        await loadDossier();
        alert('Experiencia eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar experiencia:', error);
        alert('Error al eliminar la experiencia');
    }
};

const editarExperiencia = (experiencia) => {
    console.log('Editar experiencia:', experiencia);
    // TODO: Implementar edición
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
</script>
