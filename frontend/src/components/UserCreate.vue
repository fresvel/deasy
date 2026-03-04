<template>

<nav id="hmenu" class="navbar navbar-expand-lg">
  <div class="container-fluid">
    <div class="navbar-nav gap-2">
      <button class="nav-link text-white" type="button" @click="toggleVmenu">
        Menu
      </button>
      <button class="nav-link text-white" type="button" @click="toggleNotify">
        Notify
      </button>
      <span class="nav-link text-white">Friends</span>
    </div>
  </div>
</nav>
  
  
<div class="row g-3">
      <div class="col-lg-3 mainmenu" v-show="vmenu">
        <div class="d-flex flex-column" id="mainmenu" >
          <button class="btn btn-link text-white text-start">
            Bio
          </button>
          <button class="btn btn-link text-white text-start">
            Pics
          </button>
          <button class="btn btn-link text-white text-start active">
            Companies
          </button>
          <button class="btn btn-link text-white text-start active">
            Links
          </button>
        </div>
      </div>
    
      <div :class="contentClass">
          <div class="card shadow-sm">
            <div class="card-body">

            <div class="col-12">
                <h2>Regístrate</h2>
                <p class="subtitle">Usario Pucese</p>
                

            </div>
            
            <div class="row g-3">
                <div class="col-lg-6">
                    <se-input
                        label="Nombre"
                        placeholder="Nombres completos"
                        v-model="newuser.first_name"
                    />
                </div>
                <div class="col-lg-6">
                    <se-input
                        label="Apellidos"
                        placeholder="Apellidos completos"
                        v-model="newuser.last_name"
                    />
                </div>

                <div class="col-lg-6">
                    <se-input
                        label="Contraseña"
                        placeholder="Ingrese la contraseña"
                        v-model="newuser.password"
                    />
                </div>
                <div class="col-lg-6">
                    <se-input
                        label="Contraseña"
                        placeholder="Repita la contraseña"
                        v-model="newuser.password"
                    />
                </div>

                <div class="col-lg-6">
                    <se-input
                        label="Número de Cédula o Pasaporte"
                        placeholder="Ingrese su número de Identificación"
                        v-model="newuser.cedula"
                    />
                </div>
                <div class="col-lg-6">
                    <se-input
                        label="Correo"
                        placeholder="correo_personal@ejemplo.com"
                        v-model="newuser.email"
                    />
                </div>

                <div class="col-lg-6">
                    <se-input
                        label="whatsapp"
                        placeholder="+593987654321" 
                        v-model="newuser.whatsapp"
                    />
                </div>
                <div class="col-lg-6">
                    <se-input
                        label="Dirección"
                        placeholder="Coordenadas geográficas"
                        v-model="newuser.direccion"
                    />
                </div>
                <div class="col-lg-6">
                    <div class="theme-info-panel p-3">
                        <label class="form-label">País de Nacimiento</label>
                        <select class="form-select" v-model="newuser.pais">
                            <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                        </select>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="theme-info-panel p-3">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="termsCheck">
                            <label class="form-check-label" for="termsCheck">
                                Aceptar los <a href="" class="theme-link">términos y condiciones</a> 
                            </label>
                        </div>
                    </div>
                </div>

                <div class="col-12 text-center">
                    <button class="btn btn-primary me-2" @click="createnewUser()">Registrarse</button>
                    <button class="btn btn-outline-primary" @click="createnewUser()">Iniciar Sesión</button>
                </div>
            </div>





          </div>
      </div>
    
      <div class="col-lg-2" v-if="vnotify" >
        <div class="notify">
          This is an stretched grid column. This segment will always match the tab height
        </div>
      </div>
      
</div>
  










</template>

<script setup>

import SeInput from '@/components/SInput.vue';
import { escountries } from '@/composable/countries';
import axios from 'axios';
import { ref, computed } from 'vue';
import { API_ROUTES } from '@/services/apiConfig';
  
  const vmenu = ref(true);
  const vnotify = ref(true);

  
  const toggleVmenu = () => {
        vmenu.value = !vmenu.value;
  };
  
  const toggleNotify = () => {
    vnotify.value = !vnotify.value;
    };

const contentClass = computed(() => {
    if (vmenu.value && vnotify.value) {
        return "col-lg-7 col-md-6 col-12";
    }
    if (!vmenu.value && !vnotify.value) {
        return "col-12";
    }
    if (vmenu.value && !vnotify.value) {
        return "col-lg-9 col-md-8 col-12";
    }
    return "col-lg-10 col-md-9 col-12";
});


const newuser= ref({
    cedula:"",
    password:"",
    first_name:"",
    last_name:"",
    email:"",
    correo:"",
    direccion:"",
    whatsapp: "",
    pais:"Ecuador"
})

const createnewUser=async()=>{
    
    try {
        const ret=await axios.post(API_ROUTES.USERS, newuser.value)
        alert(ret.data)
    } catch (error) {
        alert(error.message)
    }

}


</script>

<style scoped>

#mainmenu {
      height: 100vh;
      margin-top: 10px;
      background-color: rgba(var(--brand-primary-rgb), 0.92);
  }
  
  .mainmenu {
      margin-top: 13px;
      background-color: rgba(var(--brand-primary-rgb), 0.92);
  }
  
.notify{
      background-color: rgba(var(--brand-accent-rgb), 0.2);
      border-radius: var(--radius-md);
      padding: 0.75rem;
  }
  
  #hmenu{
      background: var(--brand-gradient);
  }
  
.subtitle {
    margin-top: -15px;
}
</style>
