<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container">
      <a class="navbar-brand d-flex align-items-center" href="#">
        <img src="/images/menu.svg" alt="DEASY Logo" class="me-2" style="border-radius: 10px;">
        <span class="fw-bold">DEASY PUCESE</span>
      </a>
      
      <div class="navbar-nav ms-auto">
        <router-link 
          to="/login" 
          class="nav-link btn btn-outline-light me-2" 
          :class="{ active: $route.path === '/login' }"
          @click="clickLogin"
        >
          Login
        </router-link>
        <router-link 
          to="/register" 
          class="nav-link btn btn-light" 
          :class="{ active: $route.path === '/register' }"
          @click="clickRegister"
        >
          Register
        </router-link>
      </div>
    </div>
  </nav>
</template>
      
<script setup>  


import {ref} from 'vue';



const lobody=ref("Login") 

const clickLogin=()=>{
    lobody.value="Login"
}
const clickRegister=()=>{
    lobody.value="Register"
}


  
</script>
<style scoped>
.navbar {
  background: var(--brand-gradient) !important;
  box-shadow: 0 2px 10px rgba(0, 10, 50, 0.3);
}

.navbar-brand {
  font-size: 1.25rem;
  color: white !important;
}

.navbar-brand:hover {
  color: rgba(255, 255, 255, 0.8) !important;
}

.btn-outline-light {
  border-color: rgba(255, 255, 255, 0.5);
  color: white;
  transition: all 0.3s ease;
}

.btn-outline-light:hover {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: white;
  color: white;
}

.btn-light {
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--brand-primary);
  border: none;
  transition: all 0.3s ease;
}

.btn-light:hover {
  background-color: white;
  color: var(--brand-primary);
  transform: translateY(-1px);
}

.nav-link.active {
  background-color: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
}

img {
  width: 32px;
  height: 32px;
}
</style>
      
