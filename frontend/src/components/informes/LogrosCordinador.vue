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
          <input type="file" id="file_grades" style="display: none;" v-on:change="onfileChange('grades')" name="file" ref="file_grades">
          <label for="file_grades" class="ui teal large fluid button">{{csv_grades}}</label>
       </div>
       <br>
       <div class="ui labeled large fluid  input">
          <input type="file" id="file_tutorias" style="display: none;" v-on:change="onfileChange('tutorias')" name="file_t" ref="file_tutorias">
          <label for="file_tutorias" class="ui teal large fluid button">{{csv_tutorias}}</label>
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

    <textarea v-model="surveys[`promt${level}`]" placeholder="Ingrese un promt personalizado" rows="7" class="large" style="font-size: 1.25em; text-align: justify"></textarea>
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
import EasymServices from '@/services/EasymServices';

const service= new EasymServices()
const levels=service.getEasymdata().levels;
const surveys=service.getEasymdata().surveys;
const file_grades = service.getEasymdata().file_grades;
const file_tutorias = service.getEasymdata().file_tutorias;


const csv_grades = ref("Calificaciones");
const csv_tutorias = ref("Tutorías");

const informe=ref({
  header:{
    programa:"Ingeniería en Tecnologı́as de la Información",
    periodo:{anio:2024, ciclo:""},
  },
  content:{},
  footer:{}
})



const onfileChange =(type) => {
  
  console.log(type);
  if(type == 'grades'){
   console.log(file_grades);
    csv_grades.value = file_grades.value.files[0].name;
    console.log("2");
  } else if(type == 'tutorias'){
    console.log("3");
    csv_tutorias.value = file_tutorias.value.files[0].name;
    console.log("4");
  }
  console.log("5");

  
}


const generarReporte = async()=>{
await service.informeparcialTutorias()
console.log(surveys)
}

const obtenerReporte = async()=>{
await service.obtenerReporte()
console.log(surveys)
}

const removeRow=(index,level)=>{
    levels.value[level].splice(index,1)
}

</script>

<style scoped>

</style>