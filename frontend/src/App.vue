<template>   

<router-view v-if="1==1"></router-view> <!-- Logged-->
<IndexPage v-if="1==0" ></IndexPage> <!--Ejemplo de Informe -->
<router-view v-if="1==0"></router-view> <!-- No logged-->

</template>
    
<script setup>
import IndexPage from './components/general/IndexPage.vue';

//import UserCreate from './components/users/UserCreate.vue';

//import UserLogin from './components/users/UserLogin.vue';

</script>
    
<style lang="scss">

  #app{
      height: 100vh;
  }

  .large{
    font-size: large;
  }



</style>
    