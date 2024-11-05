<template>



  
  

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
                <p style="margin-top: -15px;">Usario Pucese</p>
                

            </div>
            
            <div class="grid ui container">
                <div class="seven wide column center">
                    <SInput
                        label="Nombre"
                        placeholder="Nombres completos"
                        v-model="newuser.nombre"
                    />
                </div>
                <div class="seven wide column center">
                    <SInput
                        label="Apellidos"
                        placeholder="Apellidos completos"
                        v-model="newuser.apellido"
                    />
                </div>

                <div class="seven wide column center">
                    <SInput
                        label="Contraseña"
                        placeholder="Ingrese la contraseña"
                        v-model="newuser.password"
                    />
                </div>
                <div class="seven wide column center">
                    <SInput
                        label="Contraseña"
                        placeholder="Repita la contraseña"
                        v-model="newuser.password"
                    />
                </div>

                <div class="seven wide column center">
                    <SInput
                        label="Número de Cédula o Pasaporte"
                        placeholder="Ingrese su número de Identificación"
                        v-model="newuser.cedula"
                    />
                </div>
                <div class="seven wide column center">
                    <SInput
                        label="Correo"
                        placeholder="correo_personal@ejemplo.com"
                        v-model="newuser.email"
                    />
                </div>

                <div class="seven wide column center">
                    <SInput
                        label="whatsapp"
                        placeholder="+593987654321" 
                        v-model="newuser.whatsapp"
                    />
                </div>
                <div class="seven wide column center">
                    <SInput
                        label="Dirección"
                        placeholder="Coordenadas geográficas"
                        v-model="newuser.direccion"
                    />
                </div>
                <div class="seven wide column center">
                    <div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
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
                    <div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
                        <div class="ui labeled large fluid input">
                            <div class="ui label">
                                Aceptar los <a href="" style="color: rgba(20, 100, 240, 0.9);">términos y condiciones</a> 
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



            <s-select v-for="(select, index) in selects" :key="index"
                :options="select.options" 
                :label="select.label"
                @fromselect="fromSelect"
            />

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

import SInput from '../semantic/elements/SInput.vue';
import { escountries } from '@/composable/countries';
import axios from 'axios';
import { ref, computed } from 'vue';


/** %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%*/


/**+++++++++++++++++++++++++++++ */

import SHeader from '../main/SHeader.vue';
import SSelect from '../semantic/elements/SmSelect.vue';

const selects = [
    {
    options:["OP1", "OP2", "OP3", "OP4"],
    label: "EtiquetaA"
    },
    {
    options:["OPA", "OPB", "OPC", "OPD"],
    label: "EtiquetaB"
    },
    {
    options:["OP1", "OP2", "OP3", "OP4"],
    label: "EtiquetaD"
    },
    {
    options:["OPA", "OPB", "OPC", "OPD"],
    label: "EtiquetaD"
    },
]

const fromSelect=(value)=>{
alert("Se ha seleccionado :"+value)
}
/**+++++++++++++++++++++++++++++ */

  
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
      background-color:rgb(0, 0, 15, 0.85);
  }
  
  .mainmenu {
      margin-top: 13px;
      background-color:rgb(0, 0, 15, 0.85);
  }
  
  #vmenu {
      display: block;
  }
  
  #vnotify {
      display: none;
  }
  .notify{
      background-color: rgb(74, 140, 255, 0.5);
      ;
  }
  
  #hmenu{
      background-color:rgb(0, 10, 50, 0.9);
  
  
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
    color: rgba(0, 100, 220, 0.5);
}
</style>