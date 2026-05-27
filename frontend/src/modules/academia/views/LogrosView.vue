<template>
  <div class="w-full animate-fade-in flex flex-col gap-6">
    
    <!-- Tareas Pendientes -->
    <div v-if="1==1" class="deasy-table-shell p-6">
      <h4 class="deasy-table-title mb-6 flex items-center gap-2 text-xl normal-case tracking-tight text-slate-800">
        <span>Tareas Pendientes</span>
      </h4>
      
      <div class="deasy-table-responsive w-full">
        <table class="deasy-table min-w-full">
          <thead>
            <tr>
              <th class="whitespace-nowrap text-left">Número</th>
              <th class="whitespace-nowrap text-left">Actividad</th>
              <th class="whitespace-nowrap text-left">Vencimiento</th>
              <th class="whitespace-nowrap text-left">Estado</th>
              <th class="whitespace-nowrap text-left">Periodo</th>
              <th class="whitespace-nowrap text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!props.tareas || props.tareas.length === 0">
              <td colspan="6" class="px-4 py-8 text-center italic text-slate-500">No hay tareas pendientes asignadas.</td>
            </tr>
            <tr v-for="(item, index) in props.tareas" :key="index">
              <td class="font-medium text-slate-700">{{ index }}</td>
              <td class="text-slate-600">{{ item.process_name || item.process_slug || 'Proceso' }}</td>
              <td class="text-slate-600">{{ formatDate(item.start_date || item.end_date) }}</td>
              <td class="text-slate-600">
                <span class="inline-flex rounded-md border border-[#d7d3ff] bg-[#f7f5ff] px-2.5 py-1 text-xs font-medium text-[#5e4eff]">
                  {{ item.assignment_status || item.task_status }}
                </span>
              </td>
              <td class="text-slate-600">{{ item.term_id ?? '' }}</td>
              <td class="text-right">
                <button 
                  @click="removeRow(index, level)"
                  class="inline-flex min-h-8 items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900">
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
import ObtenerInformes from '@/modules/academia/components/ObtenerInformes.vue';
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
