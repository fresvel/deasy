<template>

<LoginHeader></LoginHeader>

<div class="login-container">
            <div class="ui container login-form">
                <div class="ui blue header  center aligned">Iniciar Sesión</div>
                <h4 class="ui header blue center aligned" style="margin-top: -15px;">DEASY PUCESE </h4>
                <div class="ui placeholder segment">
                  <div class="ui two column very relaxed stackable grid">
                    <div class="column">
                      <div class="ui form">
                        <div class="field">
                          <label>Usuario</label>
                          <div class="ui left icon input">
                            <input type="text" placeholder="Cédula o nombre de usuario" v-model="cedula">
                            <i class="user icon"></i>
                          </div>
    
                        </div>
                        <div class="field">
                          <label>Contraseña</label>
                          <div class="ui left icon input">
                            <input type="password" v-model="password">
                            <i class="lock icon"></i>
                          </div>
                        </div>
                        <div class="ui blue submit button" @click="loginFunction">Iniciar Sesión</div>
                      </div>
                    </div>
                    <div class="middle aligned column">
                      <router-link class="ui big button" to="/register">
                        <i class="signup icon" @click="loginFunction"></i>
                          Crear Usuario
                      </router-link >
                    </div>
                  </div>
                  <div class="ui vertical divider">
                    O
                  </div>
                </div>
    
                <div v-if="errorMessage" class="ui negative message">
                      <i class="close icon" @click="clearToast"></i>
                      <div class="h1">Error</div>
                      <p>{{ errorMessage }}</p>
                </div>
            </div>
</div>
    
</template>
    
<script setup>
    import { ref } from 'vue';
    import axios from 'axios';
    import LoginHeader from './LoginHeader.vue';
    
    const cedula = ref("")
    const password = ref("")
    const email = ref("")
    const errorMessage = ref("")
    
    
    const loginFunction =async() =>{
    try {
        const url="http://localhost:3000/easym/v1/users/login"
        const body ={
            email:email.value,
            cedula:cedula.value,
            password:password.value
        }
        const res=await axios.post(url, body,{ withCredentials: true })
        console.log(res.data)
        window.location="http://localhost:8080/"
    
          //window.open(res.data, '_blank');
    
        } catch (error) {
            console.log(error.message)
            errorMessage.value=error.response.data.message
        }
    
    
    }
    
    
    const clearToast=()=>{
      errorMessage.value=""
    }    
    </script>
    
    <style scoped>
    
    body {
                background-color: #f4f4f4;
            }
            .login-container {
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .login-form {
                width: 40%;
                max-width: 200px;
                padding:2rem;
                background-color: white;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                border-radius: 10px;
                margin-top: -100px;
            }
            .login-form h2 {
                text-align: center;
                margin-bottom: 1.5rem;
            }
    </style>