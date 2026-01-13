<template>

<div class="ui grid" id="navbar">
      <div class="sixteen wide column">
        <div class="ui inverted segment" id="hmenu">
            <div class="ui inverted secondary menu">
                <a class="active item" @click="toggleVmenu">
                Menu
                </a>
                <a class="item" @click="toggleNotify">
                Notify
                </a>
                <a class="item">
                Friends
                </a>
            </div>
        </div>
      </div>
</div>
  
  
<div class="ui grid">
      <div class="three  wide column  mainmenu" v-show="vmenu">
        <div class="ui inverted vertical menu fluid" id="mainmenu" >
          <a class="item">
            Bio
          </a>
          <a class="item">
            Pics
          </a>
          <a class="item active">
            Companies
          </a>
          <a class="item active">
            Links
          </a>
        </div>
      </div>
    
      <div :class="contentClass">
          <div class="ui segment">

            <div class="sixteen wide column">
                <h2>Regístrate</h2>
                <p class="subtitle">Usario Pucese</p>
                

            </div>
            
            <div class="grid ui container">
                <div class="seven wide column center">
                    <se-input
                        label="Nombre"
                        placeholder="Nombres completos"
                        v-model="newuser.nombre"
                    />
                </div>
                <div class="seven wide column center">
                    <se-input
                        label="Apellidos"
                        placeholder="Apellidos completos"
                        v-model="newuser.apellido"
                    />
                </div>

                <div class="seven wide column center">
                    <se-input
                        label="Contraseña"
                        placeholder="Ingrese la contraseña"
                        v-model="newuser.password"
                    />
                </div>
                <div class="seven wide column center">
                    <se-input
                        label="Contraseña"
                        placeholder="Repita la contraseña"
                        v-model="newuser.password"
                    />
                </div>

                <div class="seven wide column center">
                    <se-input
                        label="Número de Cédula o Pasaporte"
                        placeholder="Ingrese su número de Identificación"
                        v-model="newuser.cedula"
                    />
                </div>
                <div class="seven wide column center">
                    <se-input
                        label="Correo"
                        placeholder="correo_personal@ejemplo.com"
                        v-model="newuser.email"
                    />
                </div>

                <div class="seven wide column center">
                    <se-input
                        label="whatsapp"
                        placeholder="+593987654321" 
                        v-model="newuser.whatsapp"
                    />
                </div>
                <div class="seven wide column center">
                    <se-input
                        label="Dirección"
                        placeholder="Coordenadas geográficas"
                        v-model="newuser.direccion"
                    />
                </div>
                <div class="seven wide column center">
                    <div class="five wide column segment ui theme-info-panel">
                        <div class="ui labeled large fluid input">
                            <div class="ui label">
                            País de Nacimiento
                            </div>
                            <select class="ui compact selection dropdown" v-model="newuser.pais">
                                <option v-for="(country, index) in escountries" :key="index" :value="country">{{ country }}</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="seven wide column center">
                    <div class="five wide column segment ui theme-info-panel">
                        <div class="ui labeled large fluid input">
                            <div class="ui label">
                                Aceptar los <a href="" class="theme-link">términos y condiciones</a> 
                            </div>
                            <input  type="checkbox">
                        </div>
                    </div>
                </div>

                <div class="fourteen wide center aligned column">
                    
                    <button class="ui blue button large" @click="createnewUser()">Registrarse</button>
                    
                    <button class="ui blue button large" @click="createnewUser()">Iniciar Sesión</button>
                </div>
            </div>





          </div>
      </div>
    
      <div class="two wide stretched column" v-if="vnotify" >
        <div class="ui segment notify">
          This is an stretched grid column. This segment will always match the tab height
        </div>
      </div>
      
</div>
  










</template>

<script setup>

import SeInput from '../semantic/elements/SInput.vue';
import { escountries } from '@/composable/countries';
import axios from 'axios';
import { ref, computed } from 'vue';
  
  const vmenu = ref(true);
  const vnotify = ref(true);

  
  const toggleVmenu = () => {
        vmenu.value = !vmenu.value;
  };
  
  const toggleNotify = () => {
    vnotify.value = !vnotify.value;
    };

const contentClass= computed(()=>{
    if (vmenu.value&&vnotify.value) {
        return "eleven wide stretched column"
    }else if (!vmenu.value&&!vnotify.value) {
        return "sixteen wide stretched column"
    }else if (vmenu.value&&!vnotify.value) {
        return "thirteen wide stretched column"
    }else{
        return "fourteen wide stretched column"
    }
})


const newuser= ref({
    cedula:"",
    password:"",
    nombre:"",
    apellido:"",
    email:"",
    correo:"",
    direccion:"",
    whatsapp: "",
    pais:"Ecuador"
})

const createnewUser=async()=>{
    
    try {
        const ulr="http://localhost:3000/easym/v1/users/register"
        const ret=await axios.post(ulr, newuser.value)
        alert(ret.data)
    } catch (error) {
        alert(error.message)
    }

}


</script>

<style scoped>

#navbar {
      margin-bottom: -45px;
  }
  
#mainmenu {
      height: 100vh;
      margin-top: 10px;
      background-color: rgba(var(--brand-primary-rgb), 0.92);
  }
  
  .mainmenu {
      margin-top: 13px;
      background-color: rgba(var(--brand-primary-rgb), 0.92);
  }
  
  #vmenu {
      display: block;
  }
  
  #vnotify {
      display: none;
  }
  .notify{
      background-color: rgba(var(--brand-accent-rgb), 0.2);
  }
  
  #hmenu{
      background: var(--brand-gradient);
  }
  
  #content {
      height: 100%;
  }
  
  
  #app{
      height: 100vh;
  }



.container {
    padding: 5%;
}

.link{
    color: var(--brand-accent);
}

.subtitle {
    margin-top: -15px;
}
</style>
