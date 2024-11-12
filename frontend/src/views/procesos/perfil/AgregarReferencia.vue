<template>

<ModalHeader>Agregar Referencia</ModalHeader>

  <div class="image content segment">  

      <div class="grid ui container">
          <div class="five wide column">
            <s-select
            label="Tipo"
            :options="['Personal','Laboral', 'Familiar']"
            />
          </div>
          <div class="eleven wide column"></div>
          <div class="eight wide column">
              <SInput
                  label="Apellidos"
                  placeholder="Universidad o Instituto"
                  v-model="newuser.nombre"
              />
          </div>
          <div class="eight wide column">
              <SInput
                  label="Nombres"
                  placeholder="Universidad o Instituto"
                  v-model="newuser.nombre"
              />
          </div>
          <div class="eight wide column">
              <SInput
                  :label="label_cargo"
                  placeholder="Número de Registro de Senescyt"
                  v-model="newuser.direccion"
              />
          </div>
          <div class="eight wide column">
              <SInput
                  label="Correo"
                  placeholder="usuario@domain.com"
                  v-model="newuser.direccion"
                  type="email"
              />
          </div>
          <div class="eight wide column">
              <SInput
                  label="Teléfono"
                  placeholder="+593123456789"
                  v-model="newuser.nombre"
              />
          </div>

          <div class="eight wide column">
              <STextarea
                  label="Institución"
                  placeholder="Nombre de la institución o empresa" 
                  v-model="newuser.nombre"
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
import ModalHeader from "@/components/general/ModalHeader.vue";
import SSelect from "@/components/semantic/elements/SSelect.vue";

const label_cargo="Cargo";

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