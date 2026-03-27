<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sessionExpiryModalLabel"
  >
    <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
      <div class="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div class="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600">
          <IconAlertTriangle class="w-6 h-6" />
        </div>
        <h5 id="sessionExpiryModalLabel" class="text-lg font-bold text-slate-800">
          Sesión por expirar
        </h5>
      </div>
      
      <div class="px-6 py-5">
        <p class="text-sm text-slate-600 leading-relaxed mb-6">
          Tu sesión está a punto de expirar por inactividad. ¿Deseas mantener la sesión activa o prefieres salir ahora?
        </p>
        
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            type="button"
            class="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            @click="handleLogout"
            :disabled="loading"
          >
            <IconLogout class="w-4 h-4" />
            Cerrar sesión
          </button>
          
          <button
            type="button"
            class="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            @click="handleKeepAlive"
            :disabled="loading"
          >
            <IconRefresh :class="['w-4 h-4', { 'animate-spin': loading }]" />
            {{ loading ? 'Renovando...' : 'Mantener activa' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { API_ROUTES } from '@/services/apiConfig';
import { clearAuthData } from '@/utils/tokenUtils';
import { IconAlertTriangle, IconLogout, IconRefresh } from '@tabler/icons-vue';

const emit = defineEmits(['session-refreshed', 'session-closed']);

const isOpen = ref(false);
const loading = ref(false);
const router = useRouter();

const show = () => {
  isOpen.value = true;
};

const hide = () => {
  isOpen.value = false;
};

const handleKeepAlive = async () => {
  try {
    loading.value = true;
    
    // Llamar al endpoint de refresh token
    const response = await axios.post(
      API_ROUTES.USERS_REFRESH_TOKEN,
      {},
      { withCredentials: true }
    );

    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      hide();
      emit('session-refreshed');
    } else {
      throw new Error('No token provided');
    }
  } catch (error) {
    console.error('Error al refrescar token:', error);
    // Si falla el refresh, cerrar sesión
    handleLogout();
  } finally {
    loading.value = false;
  }
};

const handleLogout = async () => {
  try {
    loading.value = true;
    
    // Llamar al endpoint de logout
    await axios.post(API_ROUTES.USERS_LOGOUT, {}, { withCredentials: true });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  } finally {
    clearAuthData();
    hide();
    emit('session-closed');
    router.push('/');
  }
};

defineExpose({
  show,
  hide
});
</script>
