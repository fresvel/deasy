<template>
  <div class="w-full animate-fade-in flex flex-col gap-6">
    
    <!-- Tareas Pendientes -->
    <div v-if="1==1" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h4 class="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span>Tareas Pendientes</span>
      </h4>
      
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200">
        <table class="w-full text-sm text-left border-collapse">
          <thead class="text-xs text-sky-800 uppercase bg-sky-50 border-b border-sky-100">
            <tr>
              <th class="px-4 py-3 font-bold whitespace-nowrap text-left">Número</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap text-left">Actividad</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap text-left">Vencimiento</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap text-left">Estado</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap text-left">Periodo</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!props.tareas || props.tareas.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-slate-500 italic">No hay tareas pendientes asignadas.</td>
            </tr>
            <tr v-for="(item, index) in props.tareas" :key="index" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 font-medium text-slate-700">{{ index }}</td>
              <td class="px-4 py-3 text-slate-600">{{ item.process_name || item.process_slug || 'Proceso' }}</td>
              <td class="px-4 py-3 text-slate-600">{{ formatDate(item.start_date || item.end_date) }}</td>
              <td class="px-4 py-3 text-slate-600">
                <span class="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold">
                  {{ item.assignment_status || item.task_status }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ item.term_id ?? '' }}</td>
              <td class="px-4 py-3 text-right">
                <button 
                  @click="removeRow(index, level)"
                  class="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors border border-red-100 whitespace-nowrap">
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Revisar Informes -->
    <div v-if="1==1" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h4 class="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span>Revisar Informes</span>
      </h4>
      <div class="w-full">
        <ObtenerInformes process="ac_cca_logros" url=""></ObtenerInformes>
      </div>
    </div>

  </div>
</template>

<script setup>
import ObtenerInformes from '@/components/ObtenerInformes.vue';
import { defineProps, onMounted } from 'vue'

const props = defineProps({
  tareas: {
    type: Array,
    required: true
  }
})

const formatDate = (value) => {
  if (!value) return "";
  return String(value).substring(0, 10);
};

onMounted(()=>{
  console.log('mounted', props.tareas)
})
</script>
