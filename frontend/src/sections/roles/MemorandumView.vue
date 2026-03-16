<template>
  <div class="container-fluid py-4">
    <div class="profile-section-header">
      <div>
        <h2 class="text-start profile-section-title">Memorándum</h2>
        <p class="profile-section-subtitle">Gestiona y crea memorándums con editor dinámico.</p>
      </div>
      <div class="profile-section-actions">
        <button class="btn btn-primary btn-lg profile-add-btn" @click="setActiveMenu('Nuevo')">
          <font-awesome-icon icon="plus" class="me-2" />
          Nuevo Memorándum
        </button>
      </div>
    </div>

    <!-- Menú de opciones -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="btn-group w-100" role="group">
              <button
                v-for="option in menuOptions"
                :key="option"
                type="button"
                class="btn"
                :class="activeMenu === option ? 'btn-primary' : 'btn-outline-primary'"
                @click="setActiveMenu(option)"
              >
                {{ option }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Búsqueda -->
    <div class="row mb-4" v-if="activeMenu !== 'Nuevo'">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Buscar por destinatario</label>
                <input
                  v-model="searchDestinatario"
                  type="text"
                  class="form-control"
                  placeholder="Nombre del destinatario..."
                  @input="filterMemorandums"
                />
              </div>
              <div class="col-md-6">
                <label class="form-label">Buscar por remitente</label>
                <input
                  v-model="searchRemitente"
                  type="text"
                  class="form-control"
                  placeholder="Nombre del remitente..."
                  @input="filterMemorandums"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Editor de nuevo memorándum -->
    <div v-if="activeMenu === 'Nuevo'" class="row">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0">Nuevo Memorándum</h5>
          </div>
          <div class="card-body">
            <form @submit.prevent="saveMemorandum">
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">Fecha</label>
                  <input
                    v-model="newMemorandum.fecha"
                    type="date"
                    class="form-control"
                    required
                  />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Título</label>
                  <input
                    v-model="newMemorandum.titulo"
                    type="text"
                    class="form-control"
                    placeholder="Título del memorándum"
                    required
                  />
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Cuerpo del Memorándum</label>
                <p class="text-muted small mb-2">
                  Usa el editor tipo Colab para crear el contenido. Haz doble clic en cualquier celda para editar.
                </p>
                <ColabEditor v-model="newMemorandum.celdas" />
              </div>

              <!-- Campos personalizados dinámicos -->
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <label class="form-label mb-0">Campos Personalizados</label>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    @click="addCustomField"
                  >
                    <font-awesome-icon icon="plus" class="me-1" />
                    Agregar Campo
                  </button>
                </div>
                <div
                  v-for="(field, index) in newMemorandum.camposPersonalizados"
                  :key="index"
                  class="row mb-2"
                >
                  <div class="col-md-4">
                    <input
                      v-model="field.nombre"
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Nombre del campo"
                    />
                  </div>
                  <div class="col-md-7">
                    <input
                      v-model="field.valor"
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Valor"
                    />
                  </div>
                  <div class="col-md-1">
                    <button
                      type="button"
                      class="btn btn-sm btn-danger"
                      @click="removeCustomField(index)"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Destinatario</label>
                <input
                  v-model="newMemorandum.destinatario"
                  type="text"
                  class="form-control"
                  placeholder="Nombre del destinatario"
                  required
                />
              </div>

              <div class="d-flex gap-2">
                <button type="submit" class="btn btn-primary">
                  <font-awesome-icon icon="save" class="me-2" />
                  Guardar
                </button>
                <button type="button" class="btn btn-secondary" @click="resetForm">
                  Cancelar
                </button>
                <button type="button" class="btn btn-success" @click="exportToJSON">
                  <font-awesome-icon icon="download" class="me-2" />
                  Exportar JSON
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Listado de memorándums -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <div v-if="filteredMemorandums.length === 0" class="text-center py-5">
              <p class="text-muted">No hay memorándums en esta sección</p>
            </div>
            <div v-else class="table-responsive">
              <table class="table table-striped table-hover align-middle">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Fecha</th>
                    <th>Remitente</th>
                    <th>Destinatario</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="memorandum in filteredMemorandums" :key="memorandum.id">
                    <td>{{ memorandum.titulo }}</td>
                    <td>{{ formatDate(memorandum.fecha) }}</td>
                    <td>{{ memorandum.remitente }}</td>
                    <td>{{ memorandum.destinatario }}</td>
                    <td>
                      <span class="badge" :class="getStatusBadgeClass(memorandum.estado)">
                        {{ memorandum.estado }}
                      </span>
                    </td>
                    <td>
                      <button
                        class="btn btn-sm btn-primary me-1"
                        @click="viewMemorandum(memorandum)"
                        title="Ver"
                      >
                        <font-awesome-icon icon="eye" />
                      </button>
                      <button
                        v-if="canEdit(memorandum)"
                        class="btn btn-sm btn-warning me-1"
                        @click="editMemorandum(memorandum)"
                        title="Editar"
                      >
                        <font-awesome-icon icon="edit" />
                      </button>
                      <button
                        class="btn btn-sm btn-info"
                        @click="exportMemorandumJSON(memorandum)"
                        title="Exportar JSON"
                      >
                        <font-awesome-icon icon="download" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para ver/editar memorándum -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h5 class="text-lg font-semibold text-slate-800">
            {{ editingMemorandum ? 'Editar' : 'Ver' }} Memorándum
          </h5>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100"
            @click="closeModal"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div class="px-5 py-4">
          <div v-if="viewingMemorandum">
            <div class="mb-3">
              <strong>Fecha:</strong> {{ formatDate(viewingMemorandum.fecha) }}
            </div>
            <div class="mb-3">
              <strong>Título:</strong> {{ viewingMemorandum.titulo }}
            </div>
            <div class="mb-3">
              <strong>Cuerpo:</strong>
              <div class="mt-2">
                <ColabEditor 
                  v-if="editingMemorandum && viewingMemorandum.celdas"
                  v-model="viewingMemorandum.celdas"
                />
                <div v-else class="min-h-52 whitespace-pre-wrap rounded-xl border border-slate-200 p-3">
                  {{ viewingMemorandum.cuerpo || (viewingMemorandum.celdas ? viewingMemorandum.celdas.join('\n\n') : '') }}
                </div>
              </div>
            </div>
            <div v-if="viewingMemorandum.camposPersonalizados?.length" class="mb-3">
              <strong>Campos Personalizados:</strong>
              <ul class="mt-2 overflow-hidden rounded-xl border border-slate-200">
                <li
                  v-for="(field, index) in viewingMemorandum.camposPersonalizados"
                  :key="index"
                  class="border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
                >
                  <strong>{{ field.nombre }}:</strong> {{ field.valor }}
                </li>
              </ul>
            </div>
            <div v-if="editingMemorandum" class="mb-3">
              <label class="form-label">Observaciones</label>
              <textarea
                v-model="viewingMemorandum.observaciones"
                class="form-control"
                rows="4"
                placeholder="Agregar observaciones..."
              ></textarea>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" class="btn bg-slate-600 text-white hover:bg-slate-700" @click="closeModal">
            Cerrar
          </button>
          <button
            v-if="editingMemorandum"
            type="button"
            class="btn btn-primary"
            @click="saveObservations"
          >
            Guardar Observaciones
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import ColabEditor from '@/components/ColabEditor.vue';

const activeMenu = ref('Nuevo');
const menuOptions = ['Nuevo', 'Guardados', 'Enviar', 'Enviados firmados'];
const searchDestinatario = ref('');
const searchRemitente = ref('');
const memorandums = ref([]);
const isModalOpen = ref(false);

const newMemorandum = ref({
  fecha: new Date().toISOString().split('T')[0],
  titulo: '',
  cuerpo: '',
  celdas: [],
  destinatario: '',
  remitente: '',
  camposPersonalizados: [],
  estado: 'Borrador'
});

const viewingMemorandum = ref(null);
const editingMemorandum = ref(false);

// Obtener usuario actual
const currentUser = ref(null);
onMounted(() => {
  const userDataString = localStorage.getItem('user');
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
      newMemorandum.value.remitente = `${currentUser.value.nombre} ${currentUser.value.apellido}`;
    } catch (error) {
      console.error('Error al cargar usuario:', error);
    }
  }

});

const addCustomField = () => {
  newMemorandum.value.camposPersonalizados.push({ nombre: '', valor: '' });
};

const removeCustomField = (index) => {
  newMemorandum.value.camposPersonalizados.splice(index, 1);
};

const setActiveMenu = (option) => {
  activeMenu.value = option;
  loadMemorandums();
};

const loadMemorandums = async () => {
  try {
    // TODO: Implementar llamada al backend
    // Por ahora usar datos de ejemplo desde localStorage
    const storedMemorandums = JSON.parse(localStorage.getItem('memorandums') || '[]');
    memorandums.value = storedMemorandums;
  } catch (error) {
    console.error('Error al cargar memorándums:', error);
  }
};

const filteredMemorandums = computed(() => {
  let filtered = memorandums.value;

  if (activeMenu.value === 'Guardados') {
    filtered = filtered.filter(m => m.estado === 'Borrador');
  } else if (activeMenu.value === 'Enviar') {
    filtered = filtered.filter(m => m.estado === 'Enviado');
  } else if (activeMenu.value === 'Enviados firmados') {
    filtered = filtered.filter(m => m.estado === 'Firmado');
  }

  if (searchDestinatario.value) {
    filtered = filtered.filter(m =>
      m.destinatario.toLowerCase().includes(searchDestinatario.value.toLowerCase())
    );
  }

  if (searchRemitente.value) {
    filtered = filtered.filter(m =>
      m.remitente.toLowerCase().includes(searchRemitente.value.toLowerCase())
    );
  }

  return filtered;
});

const filterMemorandums = () => {
  // El computed se actualiza automáticamente
};

const saveMemorandum = async () => {
  try {
    // Convertir celdas a cuerpo para compatibilidad
    newMemorandum.value.cuerpo = newMemorandum.value.celdas.join('\n\n');
    
    const memorandumData = {
      ...newMemorandum.value,
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString()
    };

    // TODO: Implementar guardado en backend
    // Por ahora guardar en localStorage
    const saved = JSON.parse(localStorage.getItem('memorandums') || '[]');
    saved.push(memorandumData);
    localStorage.setItem('memorandums', JSON.stringify(saved));

    memorandums.value = saved;
    resetForm();
    setActiveMenu('Guardados');
    alert('Memorándum guardado exitosamente');
  } catch (error) {
    console.error('Error al guardar memorándum:', error);
    alert('Error al guardar el memorándum');
  }
};

const resetForm = () => {
  newMemorandum.value = {
    fecha: new Date().toISOString().split('T')[0],
    titulo: '',
    cuerpo: '',
    celdas: [],
    destinatario: '',
    remitente: currentUser.value
      ? `${currentUser.value.nombre} ${currentUser.value.apellido}`
      : '',
    camposPersonalizados: [],
    estado: 'Borrador'
  };
};

const viewMemorandum = (memorandum) => {
  viewingMemorandum.value = { 
    ...memorandum,
    celdas: memorandum.celdas || (memorandum.cuerpo ? [memorandum.cuerpo] : [])
  };
  editingMemorandum.value = false;
  isModalOpen.value = true;
};

const editMemorandum = (memorandum) => {
  viewingMemorandum.value = { 
    ...memorandum,
    celdas: memorandum.celdas || (memorandum.cuerpo ? [memorandum.cuerpo] : [])
  };
  editingMemorandum.value = true;
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const canEdit = (memorandum) => {
  // El destinatario puede editar
  return (
    currentUser.value &&
    memorandum.destinatario ===
      `${currentUser.value.nombre} ${currentUser.value.apellido}`
  );
};

const saveObservations = async () => {
  try {
    // TODO: Implementar guardado de observaciones en backend
    const saved = JSON.parse(localStorage.getItem('memorandums') || '[]');
    const index = saved.findIndex(m => m.id === viewingMemorandum.value.id);
    if (index !== -1) {
      saved[index].observaciones = viewingMemorandum.value.observaciones;
      localStorage.setItem('memorandums', JSON.stringify(saved));
      memorandums.value = saved;
    }
    closeModal();
    alert('Observaciones guardadas exitosamente');
  } catch (error) {
    console.error('Error al guardar observaciones:', error);
  }
};

const exportToJSON = () => {
  const dataStr = JSON.stringify(newMemorandum.value, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `memorandum-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportMemorandumJSON = (memorandum) => {
  const dataStr = JSON.stringify(memorandum, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `memorandum-${memorandum.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-ES');
};

const getStatusBadgeClass = (estado) => {
  const classes = {
    Borrador: 'inline-flex rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700',
    Enviado: 'inline-flex rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700',
    Firmado: 'inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700'
  };
  return classes[estado] || classes.Borrador;
};
</script>

<style scoped>
.profile-section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.profile-section-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--brand-primary);
  margin-bottom: 0.5rem;
}

.profile-section-subtitle {
  color: #6c757d;
  margin-bottom: 0;
}

.profile-add-btn {
  white-space: nowrap;
}
</style>
