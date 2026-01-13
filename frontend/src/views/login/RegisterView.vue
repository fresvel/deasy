<template>
    <LoginHeader></LoginHeader>
  
    <div class="ui grid flex center aligned middle aligned segment">
      <div>
        <div class="ui segment" style="margin: 4%;">
          <div class="grid ui container">
            <div class="sixteen wide column center">
              <h2 class="ui blue header center aligned">Crear Usuario</h2>
              <h4 class="ui header blue center aligned" style="margin-top: -15px;">DEASY PUCESE</h4>
            </div>
  
            <div class="seven wide column center">
              <SInput label="Nombres" placeholder="Nombres completos" v-model="newuser.nombre" />
            </div>
            <div class="seven wide column center">
              <SInput label="Apellidos" placeholder="Apellidos completos" v-model="newuser.apellido" />
            </div>
  
            <div class="seven wide column center">
              <SInput label="Contraseña" placeholder="Ingrese la contraseña" v-model="newuser.password" type="password" />
            </div>
            <div class="seven wide column center">
              <SInput type="password" label="Contraseña" placeholder="Confirmar la contraseña" v-model="newuser.repassword" />
            </div>
  
            <div class="seven wide column center">
              <SInput label="Cédula o Pasaporte" placeholder="Ingrese su número de Identificación" v-model="newuser.cedula" />
            </div>
            <div class="seven wide column center">
              <SInput label="Correo" placeholder="correo_personal@ejemplo.com" v-model="newuser.email" />
            </div>
  
            <div class="seven wide column center">
              <SInput label="WhatsApp" placeholder="+593987654321" v-model="newuser.whatsapp" />
            </div>
            <div class="seven wide column center">
              <SInput label="Dirección" placeholder="Coordenadas geográficas" v-model="newuser.direccion" />
            </div>
  
            <div class="seven wide column center">
              <div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
                <div class="ui labeled large fluid input">
                  <div class="ui label">País de Nacimiento</div>
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
                  <input type="checkbox">
                </div>
              </div>
            </div>
  
            <div class="fourteen wide center aligned column">
              <button class="ui blue button large" @click="createnewUser()">Registrarse</button>
              <router-link class="ui blue button large" to="/login">Iniciar Sesión</router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import LoginHeader from './LoginHeader.vue';
  import SInput from '@/components/semantic/elements/SInput.vue';
  import { escountries } from '@/composable/countries';
  import axios from 'axios';
  import { reactive } from 'vue';
  
  const newuser = reactive({
    cedula: "",
    password: "",
    repassword: "",
    nombre: "",
    apellido: "",
    email: "",
    correo: "",
    direccion: "",
    whatsapp: "",
    pais: "Ecuador"
  });
  
  const createnewUser = async () => {
    try {
      const url = "http://localhost:3000/easym/v1/users";
      const ret = await axios.post(url, newuser);
      alert(ret.data);
    } catch (error) {
      alert(error.message);
    }
  };
  </script>
  
  <style scoped>
  #navbar {
    margin-bottom: -45px;
  }
  
  #mainmenu {
    height: 100vh;
    margin-top: 10px;
    background-color: rgb(0, 0, 15, 0.85);
  }
  
  .mainmenu {
    margin-top: 13px;
    background-color: rgb(0, 0, 15, 0.85);
  }
  
  #vmenu {
    display: block;
  }
  
  #vnotify {
    display: none;
  }
  
  .notify {
    background-color: rgba(74, 140, 255, 0.5);
  }
  
  #hmenu {
    background-color: rgb(0, 10, 50, 0.9);
  }
  
  #content {
    height: 100%;
  }
  
  #app {
    height: 100vh;
  }
  
  .container {
    padding: 5%;
  }
  
  .link {
    color: rgba(0, 100, 220, 0.5);
  }
  </style>
  