<template>

<div class="ui grid">

  <div class="eight wide column">
    <h1>Informe de Logros Académicos</h1>
  </div>

  <div class="eight wide right aligned column">
      
    <button class="ui blue button large" @click="generarReporte()">Revisar</button>
    <button class="ui blue button large">Guardar</button>
    <button class="ui blue button large" @click="obtenerReporte()">Enviar</button>
    

  </div>

  
  
  <div class="sixteen wide column">
    <div class="ui grid">
      <div class="five wide column">
        <div class="ui labeled large fluid input">
          <div class="ui label">
            Carrera
          </div>
          <input type="text" placeholder="mysite.com" v-model="informe.header.programa">
       </div>
      </div>
      <div class="five wide column">
        <div class="ui labeled large fluid input">
          <div class="ui label">
            Ciclo Académico
          </div>
          <select class="ui compact selection dropdown" v-model="informe.header.periodo.ciclo">
            <option selected="" value="" ></option>
            <option value="I">Primer Periodo</option>
            <option value="II">Segundo Periodo</option>
          </select>
       </div>
      </div>
      <div class="three wide column">
        <div class="ui labeled large fluid  input">
          <div class="ui label">
            Año
          </div>
          <input type="number" placeholder="Año" v-model="informe.header.periodo.anio">
       </div>
      </div>
      <div class="three wide column">
        <div class="ui labeled large fluid  input">
          <input type="file" id="fileInput" style="display: none;" v-on:change="onfileChange()" name="file" ref="csv_input">
          <label for="fileInput" class="ui teal large fluid button">{{csv_filename}}</label>
       </div>
      </div>
    </div>


  </div>
</div>


<div v-for="(table, level) in levels" :key="level" class="ui grid">

    <div class="sixteen wide column">
      <div class="ui info message">
        <div class="header">
          Nivel {{ level }}
        </div>
      </div>
    
      <table class="ui compact celled definition table">
              <thead>
              <tr>
                  <th class="text-left">
                  Materia
                  </th>
                  <th class="text-left">
                  Docente
                  </th>
                  <th class="text-left">
                  Estudiantes
                  </th>
                  <th class="text-left">
                  Aprobados
                  </th>
                  <th class="text-left">
                  Promedio
                  </th>
                  <th class="text-left">
                  % Supera el Promedio
                  </th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="(item, index) in table" :key="index">
                  <td>{{ item.Asignatura }}</td>
                  <td>{{ item.Docente }}</td>
                  <td>{{ item.Total_estudiantes }}</td>
                  <td>{{ item.Aprobados }}</td>
                  <td>{{ item.Calificación_promedio }}</td>
                  <td>{{ item.Porcentaje_supera_promedio }}</td>
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

    <div class="ten wide column ui form">
      <textarea v-model="surveys[level]" rows="10" class="large" style="font-size: 1.25em; text-align: justify"></textarea>
    </div>
    <div class="six wide column ui form">

    <textarea v-model="surveys['promt']" placeholder="Ingrese un promt personalizado" rows="7" class="large" style="font-size: 1.25em; text-align: justify"></textarea>
    <button @click="removeRow(index, level)" class="ui blue button large" style="margin: 2%;">
        Analizar Promt
    </button>
    <button @click="removeRow(index, level)" class="ui blue button large" style="margin: 2%;">
        Analizar Tabla
    </button>
    </div>

</div>


</template>





<script setup>

import { ref } from 'vue';
import axios from 'axios';

const csv_input = ref(null);
const levels = ref({})
const surveys = ref({})
const csv_filename = ref("Subir CSV");

const informe=ref({
  header:{
    programa:"Ingeniería en Tecnologı́as de la Información",
    periodo:{anio:2024, ciclo:""},
  },
  content:{},
  footer:{}
})



const onfileChange =() => {
  
  csv_filename.value = csv_input.value.files[0].name;  
  console.log(csv_input.value.files);


}


const generarReporte=async()=>{
    try {
        const url="http://localhost:3000/easym/v1/report/logrosc.web"
        const formdata= new FormData();
        formdata.append('file',csv_input.value.files[0]);

        const res=await axios.post(url,formdata, {headers: {'Content-Type': 'multipart/form-data'}})
        


        //informe.value.content=res.data
        levels.value=res.data.table_logros
        surveys.value=res.data.logros_survey

    } catch (error) {
        console.log(error.message)
    }    
}

const obtenerReporte=async()=>{
  try {
        const url="http://localhost:3000/easym/v1/report/logrosc.pdf"
        
        informe.value.content={tables:levels, surveys}
        const res=await axios.post(url,informe.value)
        console.log(res)
        window.open(res.data, '_blank');

    } catch (error) {
        console.log(error.message)
    }
}

const removeRow=(index,level)=>{
    levels.value[level].splice(index,1)
}

</script>

<style scoped>

</style>