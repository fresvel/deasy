<template>
  <div class="flex flex-col gap-6 max-w-350 w-full mx-auto px-4 py-8">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-extrabold tracking-tight text-slate-800">Memorándum</h2>
        <p class="text-sm text-slate-500 font-medium">Gestiona y crea memorándums con editor dinámico.</p>
      </div>
      <div class="flex items-center">
        <button class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-xl hover:bg-sky-700 transition-colors shadow-sm whitespace-nowrap" @click="setActiveMenu('Nuevo')">
          <IconPlus class="w-4 h-4" />
          Nuevo Memorándum
        </button>
      </div>
    </div>

    <!-- Menú de opciones -->
    <div class="flex border-b border-slate-200 overflow-x-auto hide-scrollbar">
      <div class="flex space-x-2">
        <button
          v-for="option in menuOptions"
          :key="option"
          type="button"
          class="px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2"
          :class="activeMenu === option ? 'text-sky-600 border-sky-600 bg-sky-50/50' : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'"
          @click="setActiveMenu(option)"
        >
          {{ option }}
        </button>
      </div>
    </div>

    <!-- Buscador -->
    <div v-if="activeMenu !== 'Nuevo'" class="flex justify-end w-full">
      <div class="relative w-full max-w-md">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <IconSearch class="h-4 w-4 text-slate-400" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          class="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-all"
          placeholder="Buscar por título, remitente o destinatario..."
        />
      </div>
    </div>

    <!-- Editor de nuevo memorándum -->
    <div v-if="activeMenu === 'Nuevo'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="bg-sky-600 px-5 py-4">
        <h3 class="text-lg font-semibold text-white">Nuevo Memorándum</h3>
      </div>
      <div class="p-5 sm:p-6">
        <form @submit.prevent="saveMemorandum" class="flex flex-col gap-6">
          <div class="flex flex-col sm:flex-row gap-5">
            <div class="flex-1 flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-slate-700">Fecha</label>
              <input v-model="newMemorandum.fecha" type="date" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-slate-50 focus:bg-white" />
            </div>
            <div class="flex-1 flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-slate-700">Título</label>
              <input v-model="newMemorandum.titulo" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-slate-50 focus:bg-white" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-slate-700">Cuerpo del Memorándum</label>
            <p class="text-xs text-slate-500 mb-1">
              Usa el editor tipo Colab para crear el contenido. Haz doble clic en cualquier celda para editar.
            </p>
            <div class="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <ColabEditor v-model="newMemorandum.cuerpo" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-slate-700">Destinatario</label>
            <input v-model="newMemorandum.destinatario" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-slate-50 focus:bg-white" />
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center bg-slate-50 p-3 border border-slate-100 rounded-lg">
              <label class="text-sm font-semibold text-slate-700 m-0">Campos Personalizados</label>
              <button type="button" class="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-sky-200 text-sky-700 text-xs font-semibold rounded-lg hover:bg-sky-50 transition-colors" @click="addCustomField">
                <IconPlus class="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
            <div class="flex flex-col gap-2">
              <div v-for="(field, index) in newMemorandum.camposPersonalizados" :key="index" class="flex flex-col sm:flex-row gap-2">
                <input v-model="field.nombre" type="text" class="flex-[0.4] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" placeholder="Nombre del campo" />
                <input v-model="field.valor" type="text" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" placeholder="Valor" />
                <button type="button" class="shrink-0 flex items-center justify-center w-10 h-10 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors border border-red-100" @click="removeCustomField(index)">
                  <IconX class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
            <button type="submit" class="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-xl hover:bg-sky-700 transition-colors shadow-sm">
              <IconDeviceFloppy class="w-4 h-4" />
              Guardar
            </button>
            <button type="button" class="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors" @click="resetForm">
              Cancelar
            </button>
            <button type="button" class="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm ml-auto" @click="exportToJSON">
              <IconDownload class="w-4 h-4" />
              Exportar JSON
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Listado de memorándums -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div v-if="filteredMemorandums.length === 0" class="flex flex-col items-center justify-center py-16 px-4">
        <div class="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
          <IconFileDescription class="w-8 h-8" />
        </div>
        <p class="text-slate-500 font-medium">No hay memorándums en esta sección</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
              <th class="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
              <th class="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Remitente</th>
              <th class="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Destinatario</th>
              <th class="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              <th class="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="memorandum in filteredMemorandums" :key="memorandum.id" class="hover:bg-slate-50/50 transition-colors group">
              <td class="py-3 px-4">
                <span class="text-sm font-semibold text-slate-800">{{ memorandum.titulo }}</span>
                <div class="flex flex-col md:hidden mt-1 gap-0.5">
                  <span class="text-xs text-slate-500 inline-block sm:hidden">Dest: {{ memorandum.destinatario }}</span>
                  <span class="text-xs text-slate-500 inline-block">Rem: {{ memorandum.remitente }}</span>
                </div>
              </td>
              <td class="py-3 px-4"><span class="text-sm text-slate-600 whitespace-nowrap">{{ formatDate(memorandum.fecha) }}</span></td>
              <td class="py-3 px-4 hidden md:table-cell"><span class="text-sm text-slate-600">{{ memorandum.remitente }}</span></td>
              <td class="py-3 px-4 hidden sm:table-cell"><span class="text-sm text-slate-600">{{ memorandum.destinatario }}</span></td>
              <td class="py-3 px-4">
                <span :class="getStatusBadgeClass(memorandum.estado)">
                  {{ memorandum.estado }}
                </span>
              </td>
              <td class="py-3 px-4 text-right whitespace-nowrap">
                <div class="flex justify-end gap-1.5 opacity-100 lg:opacity-60 group-hover:opacity-100 transition-opacity">
                  <button class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 transition-colors border border-sky-100" @click="viewMemorandum(memorandum)" title="Ver">
                    <IconEye class="w-4 h-4" />
                  </button>
                  <button v-if="canEdit(memorandum)" class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 transition-colors border border-amber-100" @click="editMemorandum(memorandum)" title="Editar">
                    <IconEdit class="w-4 h-4" />
                  </button>
                  <button class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors border border-emerald-100" @click="exportMemorandumJSON(memorandum)" title="Exportar JSON">
                    <IconDownload class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal para ver/editar memorándum -->
    <AppModalShell
      controlled
      :open="Boolean(selectedMemorandum)"
      labelled-by="memorandum-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
      @close="closeModal"
    >
      <div v-if="selectedMemorandum" class="bg-white rounded-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 id="memorandum-modal-title" class="text-lg font-bold text-slate-800 flex items-center gap-2">
             <IconFileDescription class="w-5 h-5 text-sky-600" />
            {{ isEditing ? 'Editar Memorándum' : 'Detalles del Memorándum' }}
          </h3>
          <button type="button" class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition-colors focus:outline-none" @click="closeModal">
            <IconX class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
          <template v-if="isEditing">
            <form @submit.prevent="updateMemorandum" class="flex flex-col gap-6">
              <div class="flex flex-col sm:flex-row gap-5">
                <div class="flex-1 flex flex-col gap-1.5">
                  <label class="text-sm font-semibold text-slate-700">Fecha</label>
                  <input v-model="editForm.fecha" type="date" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-slate-50 focus:bg-white" required />
                </div>
                <div class="flex-1 flex flex-col gap-1.5">
                  <label class="text-sm font-semibold text-slate-700">Título</label>
                  <input v-model="editForm.titulo" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-slate-50 focus:bg-white" required />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-slate-700">Cuerpo del Memorándum</label>
                <p class="text-xs text-slate-500 mb-1">
                  Usa el editor tipo Colab para editar el contenido. Haz doble clic en cualquier celda para modificarla.
                </p>
                <div class="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                   <ColabEditor v-model="editForm.cuerpo" />
                </div>
              </div>

               <div class="flex flex-col gap-1.5">
                <label class="text-sm font-semibold text-slate-700">Destinatario</label>
                <input v-model="editForm.destinatario" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-slate-50 focus:bg-white" required />
              </div>

              <!-- Campos Personalizados en Edición -->
              <div class="flex flex-col gap-3 pt-2">
                <div class="flex justify-between items-center bg-slate-50 p-3 border border-slate-100 rounded-lg">
                  <label class="text-sm font-semibold text-slate-700 m-0">Campos Personalizados</label>
                  <button type="button" class="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-sky-200 text-sky-700 text-xs font-semibold rounded-lg hover:bg-sky-50 transition-colors" @click="addEditCustomField">
                    <IconPlus class="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>
                
                <div v-if="editForm.camposPersonalizados && editForm.camposPersonalizados.length > 0" class="flex flex-col gap-2">
                  <div v-for="(field, index) in editForm.camposPersonalizados" :key="index" class="flex flex-col sm:flex-row gap-2">
                     <input v-model="field.nombre" type="text" class="flex-[0.4] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" placeholder="Nombre" />
                    <input v-model="field.valor" type="text" class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white" placeholder="Valor" />
                    <button type="button" class="shrink-0 flex items-center justify-center w-10 h-10 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors border border-red-100" @click="removeEditCustomField(index)">
                      <IconX class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div v-else class="text-sm text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  No hay campos personalizados configurados.
                </div>
              </div>

               <div class="flex flex-col gap-1.5" v-if="canDelete(selectedMemorandum)">
                <label class="text-sm font-semibold text-slate-700">Estado</label>
                <select v-model="editForm.estado" class="w-full sm:w-1/2 px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all bg-slate-50 focus:bg-white appearance-none">
                  <option value="Borrador">Borrador</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Archivado">Archivado</option>
                </select>
              </div>

              <!-- Action buttons edit -->
              <div class="flex flex-wrap gap-3 pt-6 border-t border-slate-100 justify-end">
                <button type="button" class="inline-flex items-center px-4 py-2 w-full sm:w-auto justify-center bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors" @click="cancelEdit">
                  Cancelar
                </button>
                <button type="submit" class="inline-flex items-center w-full sm:w-auto justify-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-xl hover:bg-sky-700 transition-colors shadow-sm">
                   <IconDeviceFloppy class="w-4 h-4" />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </template>

          <template v-else>
            <div class="flex flex-col gap-6">
              <!-- Meta Info -->
              <div class="flex flex-col gap-4">
                <h3 class="text-2xl font-bold text-slate-800 leading-tight">{{ selectedMemorandum.titulo }}</h3>
                <div class="bg-slate-50 rounded-xl p-5 border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="flex gap-3 items-start">
                    <IconCalendar class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Fecha</span>
                      <span class="text-sm text-slate-800 font-medium">{{ formatDate(selectedMemorandum.fecha) }}</span>
                    </div>
                  </div>
                  <div class="flex gap-3 items-start">
                     <IconUser class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                     <div>
                      <span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Remitente</span>
                      <span class="text-sm text-slate-800 font-medium">{{ selectedMemorandum.remitente }}</span>
                    </div>
                  </div>
                   <div class="flex gap-3 items-start">
                     <IconUsers class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                     <div>
                      <span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Destinatario</span>
                      <span class="text-sm text-slate-800 font-medium">{{ selectedMemorandum.destinatario }}</span>
                    </div>
                  </div>
                   <div class="flex gap-3 items-start">
                     <IconActivity class="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                     <div>
                      <span class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Estado</span>
                      <span :class="getStatusBadgeClass(selectedMemorandum.estado)">
                        {{ selectedMemorandum.estado }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Custom fields View -->
             <div v-if="selectedMemorandum.camposPersonalizados && selectedMemorandum.camposPersonalizados.length > 0" class="flex flex-col gap-3">
                <h4 class="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Información Adicional</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                  <div v-for="(field, idx) in selectedMemorandum.camposPersonalizados" :key="idx" class="flex flex-col gap-0.5">
                    <span class="text-xs font-semibold text-slate-500">{{ field.nombre }}</span>
                    <span class="text-sm text-slate-800">{{ field.valor }}</span>
                  </div>
                </div>
              </div>

               <!-- Colab readonly body -->
               <div class="flex flex-col gap-3">
                  <h4 class="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 text-left">Contenido</h4>
                  <div class="bg-white border border-slate-200 rounded-xl p-0 overflow-hidden shadow-sm">
                    <ColabEditor :modelValue="selectedMemorandum.cuerpo" :readOnly="true" />
                  </div>
               </div>
            </div>
          </template>
        </div>

        <!-- Footer Actions View Mode -->
        <div v-if="!isEditing" class="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-3 justify-end rounded-b-2xl">
           <button type="button" class="hidden text-slate-500">
             <!-- Placeholder -->
          </button>
           <button v-if="!isEditing && canEdit(selectedMemorandum)" type="button" class="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors shadow-sm order-first sm:order-0 mr-auto sm:mr-0" @click="startEditing">
            <IconEdit class="w-4 h-4" />
            Editar Documento
          </button>
          <button type="button" class="inline-flex items-center px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-900 transition-colors shadow-sm w-full sm:w-auto justify-center" @click="closeModal">
            Cerrar
          </button>
        </div>
      </div>
    </AppModalShell>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppModalShell from '@/components/AppModalShell.vue';
import ColabEditor from '@/components/ColabEditor.vue';
import {
  IconPlus, IconSearch, IconX, IconDeviceFloppy, IconDownload,
  IconFileDescription, IconEye, IconEdit, IconCalendar,
  IconUser, IconUsers, IconActivity
} from '@tabler/icons-vue';

// --- DATA MOCK / STATE ---
// En el futuro, useMemorandumStore manejaría la API
const memorandums = ref([
  {
    id: 1,
    fecha: '2023-10-15',
    titulo: 'Reunión de planificación',
    remitente: 'Juan Pérez',
    destinatario: 'Equipo de Desarrollo',
    estado: 'Borrador',
    autorId: 1, 
    cuerpo: ["Hola, nos reuniremos mañana a las 10am para discutir el sprint."],
    camposPersonalizados: [
      { nombre: 'Prioridad', valor: 'Alta' }
    ]
  },
  {
    id: 2,
    fecha: '2023-10-16',
    titulo: 'Actualización de políticas',
    remitente: 'Ana Gómez',
    destinatario: 'Toda la empresa',
    estado: 'Enviado',
    autorId: 2,
    cuerpo: ["Hemos actualizado las políticas de trabajo remoto."],
    camposPersonalizados: []
  },
]);

// Datos de usuario mockeados temporalmente
const currentUser = ref({ id: 1, name: 'Usuario Actual' });
const currentUserId = computed(() => currentUser.value.id);

const menuOptions = ['Todos', 'Borradores', 'Enviados', 'Archivados'];
const activeMenu = ref('Todos');
const searchQuery = ref('');

const setActiveMenu = (menu) => {
  activeMenu.value = menu;
};

// --- NUEVO MEMORÁNDUM ---
const newMemorandum = ref({
  fecha: new Date().toISOString().split('T')[0],
  titulo: '',
  destinatario: '',
  cuerpo: ["Agrega aquí el contenido del memorándum..."],
  camposPersonalizados: []
});

const resetForm = () => {
  newMemorandum.value = {
    fecha: new Date().toISOString().split('T')[0],
    titulo: '',
    destinatario: '',
    cuerpo: ["Agrega aquí el contenido del memorándum..."],
    camposPersonalizados: []
  };
};

const addCustomField = () => {
  newMemorandum.value.camposPersonalizados.push({ nombre: '', valor: '' });
};

const removeCustomField = (index) => {
  newMemorandum.value.camposPersonalizados.splice(index, 1);
};

const saveMemorandum = () => {
  // Simulamos guardado (aquí iría llamada a API)
  const nuevoId = memorandums.value.length ? Math.max(...memorandums.value.map(m => m.id)) + 1 : 1;
  const memorandumToSave = {
    ...newMemorandum.value,
    id: nuevoId,
    estado: 'Borrador',
    remitente: currentUser.value.name,
    autorId: currentUserId.value
  };
  
  memorandums.value.push(memorandumToSave);
  // Pequeña notificación o feedback podría ir aquí
  activeMenu.value = 'Borradores';
  resetForm();
};

const exportToJSON = () => {
  const dataStr = JSON.stringify(newMemorandum.value, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = 'nuevo_memorandum.json';
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

// --- LISTADO Y FILTROS ---
const filteredMemorandums = computed(() => {
  let filtered = memorandums.value;

  if (activeMenu.value !== 'Todos') {
    const statusMap = {
      'Borradores': 'Borrador',
      'Enviados': 'Enviado',
      'Archivados': 'Archivado'
    };
    const targetStatus = statusMap[activeMenu.value];
    if (targetStatus) {
      filtered = filtered.filter(m => m.estado === targetStatus);
    }
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    filtered = filtered.filter(m => 
      m.titulo.toLowerCase().includes(q) ||
      m.remitente.toLowerCase().includes(q) ||
      m.destinatario.toLowerCase().includes(q)
    );
  }

  return filtered;
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

// Modificación para Tailwind CSS
const getStatusBadgeClass = (status) => {
  return [
    'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider',
    status === 'Borrador' ? 'bg-amber-100 text-amber-800' :
    status === 'Enviado' ? 'bg-emerald-100 text-emerald-800' :
    'bg-slate-100 text-slate-800'
  ];
};


const canEdit = (memorandum) => {
  // Solo el autor puede editar si está en Borrador (ejemplo de regla de negocio)
  return memorandum.autorId === currentUserId.value && memorandum.estado === 'Borrador';
};

const canDelete = (memorandum) => {
  return memorandum.autorId === currentUserId.value; // O si es admin, etc.
};

const exportMemorandumJSON = (memorandum) => {
  const dataStr = JSON.stringify(memorandum, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const exportFileDefaultName = `memorandum_${memorandum.id}.json`;
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

// --- MODAL DE VER/EDITAR ---
const selectedMemorandum = ref(null);
const isEditing = ref(false);
const editForm = ref(null);

const viewMemorandum = (memorandum) => {
  selectedMemorandum.value = { ...memorandum };
  isEditing.value = false;
};

const editMemorandum = (memorandum) => {
  selectedMemorandum.value = { ...memorandum };
  editForm.value = JSON.parse(JSON.stringify(memorandum)); // Deep copy
  isEditing.value = true;
};

const closeModal = () => {
  selectedMemorandum.value = null;
  isEditing.value = false;
  editForm.value = null;
};

const startEditing = () => {
  editForm.value = JSON.parse(JSON.stringify(selectedMemorandum.value));
  isEditing.value = true;
};

const cancelEdit = () => {
  isEditing.value = false;
  editForm.value = null;
};

const addEditCustomField = () => {
  if (!editForm.value.camposPersonalizados) {
    editForm.value.camposPersonalizados = [];
  }
  editForm.value.camposPersonalizados.push({ nombre: '', valor: '' });
};

const removeEditCustomField = (index) => {
  editForm.value.camposPersonalizados.splice(index, 1);
};

const updateMemorandum = () => {
  const index = memorandums.value.findIndex(m => m.id === editForm.value.id);
  if (index !== -1) {
    memorandums.value[index] = { ...editForm.value };
    // Reflejar cambios en la vista activa
    selectedMemorandum.value = { ...editForm.value };
    isEditing.value = false;
  }
};
</script>

<style scoped>
/* Transiciones para las tarjetas */
.memorandum-row {
  transition: all 0.2s ease-in-out;
}
.memorandum-row:hover {
  background-color: #f8f9fa;
}
/* Utiliadades y scrollbars personalizadas */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Transiciones para modal y otros */
.fade-in {
  animation: fadeIn 0.2s ease-out;
}
.zoom-in-95 {
  animation: zoomIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes zoomIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
