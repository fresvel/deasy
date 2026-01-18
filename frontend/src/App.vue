<template>   
  <router-view v-if="1==1"></router-view> <!-- Logged-->
  <SessionExpiryModal ref="sessionModalRef" @session-refreshed="handleSessionRefreshed" @session-closed="handleSessionClosed" />
</template>
    
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import SessionExpiryModal from '@/components/SessionExpiryModal.vue';
import { useSessionMonitor } from '@/composables/useSessionMonitor';

const route = useRoute();
const sessionModalRef = ref(null);

const { startMonitoring, stopMonitoring, resetWarning } = useSessionMonitor(sessionModalRef);

const handleSessionRefreshed = () => {
  resetWarning();
  // Reiniciar el monitoreo después de refrescar
  startMonitoring();
};

const handleSessionClosed = () => {
  stopMonitoring();
};

// Iniciar monitoreo al montar si hay token
onMounted(() => {
  const token = localStorage.getItem('token');
  const publicRoutes = ['/', '/register'];
  
  if (!publicRoutes.includes(route.path) && token) {
    startMonitoring();
  }
});

onBeforeUnmount(() => {
  stopMonitoring();
});

// Monitorear cambios en la ruta para reiniciar el monitoreo si es necesario
watch(() => route.path, (newPath) => {
  const token = localStorage.getItem('token');
  const publicRoutes = ['/', '/register'];
  
  if (publicRoutes.includes(newPath)) {
    stopMonitoring();
  } else if (token) {
    startMonitoring();
  }
});
</script>
    
<style lang="scss">

  #app{
      height: 100vh;
  }

  .large{
    font-size: large;
  }

  .medium{
    font-size: medium;
  }

  .Large{
    font-size: x-large;
  }


  .LARGE{
    font-size: xx-large;
  }

</style>
    