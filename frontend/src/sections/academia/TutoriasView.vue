<template>
  <div class="w-full animate-fade-in p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
      <h1 class="text-2xl font-bold text-slate-800">Informe de Logros Académicos</h1>
      <div class="flex flex-wrap items-center gap-3">
        <button class="px-4 py-2 bg-sky-100 text-sky-700 font-medium rounded-xl hover:bg-sky-200 transition-colors" @click="generarReporte()">Revisar</button>
        <button class="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">Guardar</button>
        <button class="px-4 py-2 bg-sky-600 text-white font-medium rounded-xl hover:bg-sky-700 shadow-sm transition-colors" @click="obtenerReporte()">Enviar</button>
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-12 gap-5 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
      <div class="md:col-span-5 lg:col-span-3 flex flex-col gap-1.5">
        <label class="text-sm font-semibold text-slate-700">Carrera</label>
        <input type="text" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all bg-white" placeholder="Ej. Ingeniería" v-model="informe.header.programa">
      </div>
      <div class="md:col-span-4 lg:col-span-3 flex flex-col gap-1.5">
        <label class="text-sm font-semibold text-slate-700">Ciclo Académico</label>
        <select class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all bg-white" v-model="informe.header.periodo.ciclo">
          <option value="" disabled>Seleccione...</option>
          <option value="I">Primer Periodo</option>
          <option value="II">Segundo Periodo</option>
        </select>
      </div>
      <div class="md:col-span-3 lg:col-span-2 flex flex-col gap-1.5">
        <label class="text-sm font-semibold text-slate-700">Año</label>
        <input type="number" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all bg-white" placeholder="2024" v-model="informe.header.periodo.anio">
      </div>
      <div class="md:col-span-12 lg:col-span-4 flex flex-col xl:flex-row gap-3 pt-6 lg:pt-0 items-end">
        <div class="w-full flex-1">
          <input type="file" id="file_grades" class="hidden" v-on:change="onfileChange('grades')" name="file" ref="file_grades">
          <label for="file_grades" class="w-full h-full min-h-[46px] px-4 py-2.5 bg-white border-2 border-dashed border-sky-300 text-sky-700 hover:bg-sky-50 hover:border-sky-500 rounded-xl text-center font-medium cursor-pointer transition-all flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-upload shrink-0"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
            <span class="truncate text-sm">{{csv_grades}}</span>
          </label>
        </div>
        <div class="w-full flex-1">
          <input type="file" id="file_tutorias" class="hidden" v-on:change="onfileChange('tutorias')" name="file_t" ref="file_tutorias">
          <label for="file_tutorias" class="w-full h-full min-h-[46px] px-4 py-2.5 bg-white border-2 border-dashed border-sky-300 text-sky-700 hover:bg-sky-50 hover:border-sky-500 rounded-xl text-center font-medium cursor-pointer transition-all flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-upload shrink-0"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
            <span class="truncate text-sm">{{csv_tutorias}}</span>
          </label>
        </div>
      </div>
    </div>
    
    <div v-for="(table, level) in levels" :key="level" class="flex flex-col gap-6 mb-8">
      <div class="bg-sky-50 text-sky-800 px-4 py-3 rounded-xl border border-sky-100 font-semibold shadow-sm">
        Nivel {{ level }}
      </div>
      
      <div class="overflow-x-auto w-full rounded-xl border border-slate-200 shadow-sm">
        <table class="w-full text-sm text-left border-collapse">
          <thead class="text-xs text-sky-800 uppercase bg-sky-50 border-b border-sky-100">
            <tr>
              <th class="px-4 py-3 font-bold whitespace-nowrap">Materia</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap">Docente</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap">Estudiantes</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap">Aprobados</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap">Promedio</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap">% Supera el Promedio</th>
              <th class="px-4 py-3 font-bold whitespace-nowrap text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in table" :key="index" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700 font-medium">{{ item.Asignatura }}</td>
              <td class="px-4 py-3 text-slate-600">{{ item.Docente }}</td>
              <td class="px-4 py-3 text-slate-600">{{ item.Total_estudiantes }}</td>
              <td class="px-4 py-3 text-slate-600">{{ item.Aprobados }}</td>
              <td class="px-4 py-3 text-slate-600">{{ item.Calificación_promedio }}</td>
              <td class="px-4 py-3 text-slate-600">{{ item.Porcentaje_supera_promedio }}</td>
              <td class="px-4 py-3 text-right">
                <button @click="removeRow(index, level)" class="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors border border-red-100 whitespace-nowrap">
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-8">
          <textarea v-model="surveys[level]" rows="8" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all text-slate-700 leading-relaxed resize-y min-h-[200px] shadow-sm" placeholder="Resumen..."></textarea>
        </div>
        <div class="lg:col-span-4 flex flex-col gap-3">
          <textarea v-model="surveys[`promt${level}`]" placeholder="Ingrese un prompt personalizado" rows="5" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all text-slate-700 leading-relaxed resize-y shadow-sm"></textarea>
          <div class="grid grid-cols-2 gap-3 mt-auto">
            <button @click="removeRow(index, level)" class="w-full px-4 py-2.5 bg-sky-600 text-white font-medium rounded-xl hover:bg-sky-700 shadow-sm transition-colors text-sm">
              Analizar Prompt
            </button>
            <button @click="removeRow(index, level)" class="w-full px-4 py-2.5 bg-white text-sky-700 border border-sky-300 font-medium rounded-xl hover:bg-sky-50 shadow-sm transition-colors text-sm">
              Analizar Tabla
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import EasymServices from '@/services/EasymServices';

const service = new EasymServices();
const levels = service.getEasymdata().levels;
const surveys = service.getEasymdata().surveys;
const file_grades = service.getEasymdata().file_grades;
const file_tutorias = service.getEasymdata().file_tutorias;

const csv_grades = ref("Calificaciones");
const csv_tutorias = ref("Tutorías");

const informe = ref({
  header: {
    programa: "Ingeniería en Tecnologías de la Información",
    periodo: { anio: 2024, ciclo: "" },
  },
  content: {},
  footer: {}
});

const onfileChange = (type) => {
  if (type == 'grades' && file_grades.value?.files?.length > 0) {
    csv_grades.value = file_grades.value.files[0].name;
  } else if (type == 'tutorias' && file_tutorias.value?.files?.length > 0) {
    csv_tutorias.value = file_tutorias.value.files[0].name;
  }
}

const generarReporte = async () => {
  await service.informeparcialTutorias();
  console.log(surveys);
}

const obtenerReporte = async () => {
  await service.obtenerReporte();
  console.log(surveys);
}

const removeRow = (index, level) => {
  levels.value[level].splice(index, 1);
}
</script>
