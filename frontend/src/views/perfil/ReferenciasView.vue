<template>
<div class="w-full animate-fade-in">
  <ProfileSectionShell
    title="Referencias"
    subtitle="Agrega referencias laborales, familiares y personales."
    @add="openModal"
  >
                
  
  <!-- Referencias Laborales -->
  <ProfileTableBlock title="Referencias laborales">
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REFERENCIA</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CARGO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CORREO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TELÉFONO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="referenciasLaborales.length === 0" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
                <p class="my-3">No hay referencias laborales registradas</p>
              </td>
            </tr>
            <tr v-for="ref in referenciasLaborales" :key="ref._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(ref.sera)" @onpress="() => clickBtnsera(ref)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ ref.nombre }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.cargo_parentesco }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.email }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.telefono }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.institution }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <button v-if="ref.url_documento" @click="openDocument(ref)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(ref._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="deleteReferencia(ref._id)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                    <IconTrash :size="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  <!-- Referencias Familiares -->
  <ProfileTableBlock title="Referencias familiares">
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REFERENCIA</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PARENTESCO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CORREO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TELÉFONO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="referenciasFamiliares.length === 0" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="6" class="px-4 py-8 text-center text-slate-500 italic">
                <p class="my-3">No hay referencias familiares registradas</p>
              </td>
            </tr>
            <tr v-for="ref in referenciasFamiliares" :key="ref._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(ref.sera)" @onpress="() => clickBtnsera(ref)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ ref.nombre }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.cargo_parentesco }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.email }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.telefono }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <button v-if="ref.url_documento" @click="openDocument(ref)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(ref._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="deleteReferencia(ref._id)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                    <IconTrash :size="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </ProfileTableBlock>

  <!-- Referencias Personales -->
  <ProfileTableBlock title="Referencias personales">
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REFERENCIA</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CORREO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TELÉFONO</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="referenciasPersonales.length === 0" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="5" class="px-4 py-8 text-center text-slate-500 italic">
                <p class="my-3">No hay referencias personales registradas</p>
              </td>
            </tr>
            <tr v-for="ref in referenciasPersonales" :key="ref._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(ref.sera)" @onpress="() => clickBtnsera(ref)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ ref.nombre }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.email }}</td>
              <td class="px-4 py-3 text-slate-700">{{ ref.telefono }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <button v-if="ref.url_documento" @click="openDocument(ref)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(ref._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="deleteReferencia(ref._id)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
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
<div class="modal fade" id="referenciaModal" tabindex="-1" aria-labelledby="referenciaModalLabel" aria-hidden="true" ref="modal">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content border-0 shadow-lg rounded-2xl overflow-hidden p-0">
      <AgregarReferencia @referencia-added="handleReferenciaAdded" />
    </div>
  </div>
</div>

<input type="file" ref="fileInput" accept="application/pdf" class="hidden" @change="handleFileSelect" />
</template>

<script setup>
import {ref, computed, onMounted, onBeforeUnmount} from "vue"
import { Modal } from "@/utils/modalController";
import AgregarReferencia from "./components/AgregarReferencia.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import DossierService from "@/services/dossier/DossierService";
import { IconFile, IconUpload, IconTrash } from '@tabler/icons-vue';

const modal = ref(null);
const fileInput = ref(null);
const selectedItemId = ref(null);
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
        
        const data = await DossierService.getDossier();
        
        if (data.success) {
            dossier.value = data.data;
            currentUser.value = { cedula: DossierService.getCedula() };
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
        await DossierService.deleteReferencia(referenciaId);
        
        await loadDossier();
        alert('Referencia eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar referencia:', error);
        alert('Error al eliminar la referencia');
    }
};

const clickBtnedit = (ref) => {
    console.log('Editar referencia:', ref);
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

const openDocument = async (ref) => {
    try {
        const response = await DossierService.downloadDocument('referencia', ref._id);
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
        console.error('Error al abrir documento:', error);
        alert('Error al abrir el documento');
    }
};

const triggerFileUpload = (itemId) => {
    selectedItemId.value = itemId;
    fileInput.value.click();
};

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
        const response = await DossierService.uploadReferenciaDocument(selectedItemId.value, file);
        if (response.success) {
            alert('Documento subido correctamente');
            await loadDossier();
        }
    } catch (error) {
        console.error('Error al subir documento:', error);
        alert('Error al subir el documento');
    }
    
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
