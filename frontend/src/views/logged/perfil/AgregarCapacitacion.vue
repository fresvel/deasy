<template>
 <i class="close icon"></i>
  <div class="header" style="background-color: rgba(0, 110, 220, 0.1);" >
    Agregar Evento de Formación Continua
  </div>



  <div class="image content segment">  

      <div class="grid ui container">
          <div class="eight wide column">
              <STextarea
                  label="Tema"
                  placeholder="Título o tema del evento"
                  v-model="newuser.nombre"
              />
          </div>
          <div class="eight wide column">
              <STextarea
                  label="Institución"
                  placeholder="Universidad o Instituto"
                  v-model="newuser.nombre"
              />
          </div>
          <div class="five wide column">
            <s-select
            label="Tipo"
            :options="['Docente','Profesional']"
            />
          </div>
          <div class="five wide column">
            <s-select
            label="Enfoque"
            :options="['Asistencia','Aprobación','Instructor']"
            />
          </div>
          <div class="five wide column">
            <s-select
            label="País"
            :options="escountries"
            />
          </div>
          <div class="five wide column">
              <SDate
                  label="Inicio"
                  placeholder="Número de Registro de Senescyt"
                  v-model="newuser.direccion"
              />
          </div>
          <div class="five wide column">
              <SDate
                  label="Fin"
                  placeholder="Número de Registro de Senescyt"
                  v-model="newuser.direccion"
              />
          </div>
          <div class="five wide column">
              <SInput
                  label="Duración"
                  placeholder="Horas"
                  v-model="newuser.nombre"
                  type="number"
              />
          </div>
      </div>      

  </div>
  
  
  <div class="actions">
    <div class="ui black deny button">
      Nope
    </div>
    <div class="ui positive right labeled icon button">
      Yep, that's me
      <i class="checkmark icon"></i>
    </div>
  </div>



</template>

<script setup>
import {ref} from "vue"
import SInput from '@/components/semantic/elements/SInput.vue';
import STextarea from '@/components/semantic/elements/STextarea.vue'
import { escountries } from '@/composable/countries';
import SSelect from "@/components/semantic/elements/SSelect.vue";
//import Datepicker from 'vuejs3-datepicker'
import SDate from "@/components/semantic/elements/SDate.vue";
//const sdate=ref(new Date())

const newuser= ref({
            cedula:"",
            password:"",
            repassword:"",
            nombre:"",
            apellido:"",
            email:"",
            correo:"",
            direccion:"",
            whatsapp: "",
            pais:"Ecuador"
        })

</script>

<style scoped>

</style>