<template>


<div v-if="1==1" class="card shadow-sm mb-4">
  <div class="card-body">
    
    <h4 class="text-center text-uppercase fw-semibold mb-4">
        Tareas Pendientes
    </h4>
      

    <div class="row">
    
    <div class="col-12">
    
      <table class="table table-institutional table-striped table-hover align-middle">
              <thead>
              <tr>
                  <th class="text-left">
                  Número
                  </th>
                  <th class="text-left">
                  Actividad
                  </th>
                  <th class="text-left">
                  Vencimiento
                  </th>
                  <th class="text-left">
                  Estado
                  </th>
                  <th>
                  Periodo
                  </th>
                  <th class="text-left">
                  Acción
                  </th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="(item, index) in props.tareas" :key="index">
                  <td>{{ index }}</td>
                  <td>{{ item.process_name || item.process_slug || 'Proceso' }}</td>
                  <td>{{ formatDate(item.start_date || item.end_date) }}</td>
                  <td>{{ item.assignment_status || item.task_status }}</td>
                  <td>{{ item.term_id ?? '' }}</td>
                  <td>
                    <button 
                    @click="removeRow(index, level)"
                    class="btn btn-outline-danger btn-sm">
                        Eliminar {{ index }}-{{ level }}
                    </button>
                  </td>
              </tr>
              </tbody>
          </table>
    
    </div>
    </div>

</div>
</div>

<div v-if="1==1" class="card shadow-sm mb-4">
  <div class="card-body">

    <h4 class="text-center text-uppercase fw-semibold mb-4">
        Revisar Informes
    </h4>          
      
<ObtenerInformes class="row" process="ac_cca_logros" url=""></ObtenerInformes>
</div>
</div>




</template>

<script setup>
import ObtenerInformes from '@/components/ObtenerInformes.vue';
import {defineProps, onMounted} from 'vue'


/*const informes = ref([
  { desc: 'Logros académicos 2024 II', status: 'Aprobado' },
  { desc: 'Informe 2', status: 'Elaborado' },
  { desc: 'Informe 3', status: 'Aprobado' },
  { desc: 'Informe 4', status: 'Guardado' },])

const filteredInformes = computed(()=>{
    return informes.value.filter((informe)=>informe.status!='Aprobado')
})*/

const props= defineProps({
    tareas:{
        type:Array,
        required:true
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
