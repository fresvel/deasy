<template>  

  
<s-header @onclick="handleHeader">
    <router-link to="login" class="item active large right aligned" @click="clickLogin">Login</router-link>
    <router-link to="register" class="item large" @click="clickRegister">Register</router-link>         
</s-header>
  
</template>
      
<script setup>  


import {ref} from 'vue';
import SHeader from '@/components/main/SHeader.vue';



const lobody=ref("Login") 

const clickLogin=()=>{
    lobody.value="Login"
}
const clickRegister=()=>{
    lobody.value="Register"
}


  
</script>
      
<style scoped>



  
  

</style>
      