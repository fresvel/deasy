<template>
 <i class="close icon"></i>
  <div class="header" style="background-color: rgba(0, 110, 220, 0.1);" >
    Profile Picture
  </div>



  <div class="image content segment">  

      <div class="grid ui container">
          <div class="eight wide column">
              <STextarea
                  label="Título"
                  placeholder="Título Obtenido"
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
          <div class="eight wide column">
            <div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
              <div class="ui labeled large fluid input">
                  <div class="ui label">
                  País de Emisión
                  </div>
                  <select class="ui compact selection dropdown" v-model="newuser.pais" style="width: 100%;">
                      <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                  </select>
              </div>
            </div>
          </div>
          <div class="eight wide column">
              <SInput
                  label="Número de Registro"
                  placeholder="Número de Registro de Senescyt"
                  v-model="newuser.direccion"
              />
          </div>
          <div class="eight wide column">
            <div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
              <div class="ui labeled large fluid input">
                  <div class="ui label">
                  Tipo
                  </div>
                  <select class="ui compact selection dropdown" v-model="newuser.pais">
                      <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                  </select>
              </div>
            </div>
          </div>

          <div class="eight wide column">
            <div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
              <div class="ui labeled large fluid input">
                  <div class="ui label">
                  Nivel
                  </div>
                  <select class="ui compact selection dropdown" v-model="newuser.pais">
                      <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                  </select>
              </div>
            </div>
          </div>

          <div class="eight wide column">
              <STextarea
                  label="Campo Amplio"
                  placeholder="Campo Amplio de Conocimiento" 
                  v-model="newuser.nombre"
              />
          </div>
          <div class="eight wide column">
            <s-select
            label="Ejemplo"
            :options="['A', 'B', 'C', 'D', 'E', 'F']"
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
import SInput from '@/components/SInput.vue';
import STextarea from '@/components/STextarea.vue'
import { escountries } from '@/composable/countries';
import SSelect from "@/components/SSelect.vue";

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
