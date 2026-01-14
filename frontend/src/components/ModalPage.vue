<template>
 <button type="button" class="btn-close" aria-label="Close"></button>
  <div class="header modal-header">
    Profile Picture
  </div>



  <div class="modal-body">  
      <div class="row g-3">
          <div class="col-md-6">
              <STextarea
                  label="Título"
                  placeholder="Título Obtenido"
                  v-model="newuser.nombre"
              />
          </div>
          <div class="col-md-6">
              <STextarea
                  label="Institución"
                  placeholder="Universidad o Instituto"
                  v-model="newuser.nombre"
              />
          </div>
          <div class="col-md-6">
            <div class="modal-panel p-3">
              <div class="input-group">
                <span class="input-group-text">País de Emisión</span>
                <select class="form-select dropdown-full" v-model="newuser.pais">
                  <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="col-md-6">
              <SInput
                  label="Número de Registro"
                  placeholder="Número de Registro de Senescyt"
                  v-model="newuser.direccion"
              />
          </div>
          <div class="col-md-6">
            <div class="modal-panel p-3">
              <div class="input-group">
                <span class="input-group-text">Tipo</span>
                <select class="form-select" v-model="newuser.pais">
                  <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="modal-panel p-3">
              <div class="input-group">
                <span class="input-group-text">Nivel</span>
                <select class="form-select" v-model="newuser.pais">
                  <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                </select>
              </div>
            </div>
          </div>

          <div class="col-md-6">
              <STextarea
                  label="Campo Amplio"
                  placeholder="Campo Amplio de Conocimiento" 
                  v-model="newuser.nombre"
              />
          </div>
          <div class="col-md-6">
            <s-select
            label="Ejemplo"
            :options="['A', 'B', 'C', 'D', 'E', 'F']"
            />

          </div>
      </div>      

  </div>
  
  
  <div class="d-flex justify-content-end gap-2 mt-3">
    <button type="button" class="btn btn-outline-secondary">Nope</button>
    <button type="button" class="btn btn-primary">Yep, that's me</button>
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
.modal-header {
  background-color: var(--brand-info-soft);
}

.modal-panel {
  background-color: var(--brand-info-soft);
  border-radius: var(--radius-md);
}

.dropdown-full {
  width: 100%;
}
</style>
