<template>


<div v-if="1==1" class="ui segment">
    
    <h4 class="ui horizontal divider">
        Tareas Pendientes
    </h4>
      

    <div class="ui grid">
    
    <div class="sixteen wide column">
    
      <table class="ui compact celled definition table">
              <thead>
              <tr>
                  <th class="text-left">
                  Número
                  </th>
                  <th class="text-left">
                  Informe
                  </th>
                  <th class="text-left">
                  Estado
                  </th>
                  <th class="text-left">
                  Acción
                  </th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="(item, index) in filteredInformes" :key="index">
                  <td>{{ index }}</td>
                  <td>{{ item.desc }}</td>
                  <td>{{ item.status }}</td>
                  <td>
                    <button 
                    @click="removeRow(index, level)"
                    class="ui negative button">
                        Eliminar {{ index }}-{{ level }}
                    </button>
                  </td>
              </tr>
              </tbody>
          </table>
    
    </div>
    </div>

</div>

<div v-if="1==1" class="ui segment">

    <h4 class="ui horizontal divider">
        Revisar Informes
    </h4>          
      
<ObtenerInformes class="row" process="ac_cca_logros" url=""></ObtenerInformes>
</div>




</template>

<script setup>
import ObtenerInformes from '@/components/easym/ObtenerInformes.vue';
import {ref, computed} from 'vue'
const informes = ref([
  { desc: 'Logros académicos 2024 II', status: 'Aprobado' },
  { desc: 'Informe 2', status: 'Elaborado' },
  { desc: 'Informe 3', status: 'Aprobado' },
  { desc: 'Informe 4', status: 'Guardado' },])

const filteredInformes = computed(()=>{
    return informes.value.filter((informe)=>informe.status!='Aprobado')
})

</script>

<style scoped>

</style>