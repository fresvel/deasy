<template>

    <div class="row align-items-center g-3 mb-4">
    
      <div class="col-lg-6">
        <h1>Informe de Logros Académicos</h1>
      </div>
    
      <div class="col-lg-6 text-lg-end">
          
        <button class="btn btn-primary me-2" @click="generarReporte()">Revisar</button>
        <button class="btn btn-outline-primary me-2">Guardar</button>
        <button class="btn btn-primary" @click="obtenerReporte()">Enviar</button>
        
    
      </div>
    
      
      
      <div class="col-12">
        <div class="row g-3">
          <div class="col-lg-5">
            <div class="input-group">
              <span class="input-group-text">Carrera</span>
              <input type="text" class="form-control" placeholder="mysite.com" v-model="informe.header.programa">
           </div>
          </div>
          <div class="col-lg-5">
            <div class="input-group">
              <span class="input-group-text">Ciclo Académico</span>
              <select class="form-select" v-model="informe.header.periodo.ciclo">
                <option selected="" value="" ></option>
                <option value="I">Primer Periodo</option>
                <option value="II">Segundo Periodo</option>
              </select>
           </div>
          </div>
          <div class="col-lg-2">
            <div class="input-group">
              <span class="input-group-text">Año</span>
              <input type="number" class="form-control" placeholder="Año" v-model="informe.header.periodo.anio">
           </div>
          </div>
          <div class="col-lg-3">
            <input type="file" id="file_grades" class="file-input-hidden" v-on:change="onfileChange('grades')" name="file" ref="file_grades">
            <label for="file_grades" class="btn btn-outline-primary w-100">{{csv_grades}}</label>
           <div class="mt-2">
              <input type="file" id="file_tutorias" class="file-input-hidden" v-on:change="onfileChange('tutorias')" name="file_t" ref="file_tutorias">
              <label for="file_tutorias" class="btn btn-outline-primary w-100">{{csv_tutorias}}</label>
           </div>
          </div>
        </div>
      </div>
    </div>
    
    
    <div v-for="(table, level) in levels" :key="level" class="row g-3 mb-4">
    
        <div class="col-12">
          <div class="alert alert-info mb-3">
            <strong>Nivel {{ level }}</strong>
          </div>
        
          <table class="table table-institutional table-striped table-hover align-middle">
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
                        class="btn btn-outline-danger btn-sm">
                            Eliminar {{ index }}-{{ level }}
                        </button>
                      </td>
                  </tr>
                  </tbody>
          </table>
        
        </div>
    
        <div class="col-lg-8">
          <textarea v-model="surveys[level]" rows="10" class="form-control summary-textarea"></textarea>
        </div>
        <div class="col-lg-4">
    
        <textarea v-model="surveys[`promt${level}`]" placeholder="Ingrese un promt personalizado" rows="7" class="form-control summary-textarea"></textarea>
        <button @click="removeRow(index, level)" class="btn btn-primary w-100 action-button">
            Analizar Promt
        </button>
        <button @click="removeRow(index, level)" class="btn btn-outline-primary w-100 action-button">
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
    .file-input-hidden {
      display: none;
    }

    .summary-textarea {
      font-size: 1.25em;
      text-align: justify;
    }

    .action-button {
      margin: 2%;
    }
    </style>
