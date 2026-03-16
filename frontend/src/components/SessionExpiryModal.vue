<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sessionExpiryModalLabel"
  >
    <div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div class="bg-amber-400 px-5 py-4 text-slate-900">
        <h5 id="sessionExpiryModalLabel" class="flex items-center text-lg font-semibold">
          <font-awesome-icon icon="exclamation-triangle" class="me-2" />
          Sesion por expirar
        </h5>
      </div>
      <div class="px-5 py-4">
        <p class="mb-4 text-sm text-slate-700">
          Tu sesion esta por expirar. Deseas mantener la sesion activa o cerrar sesion?
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            class="btn bg-slate-600 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            @click="handleLogout"
            :disabled="loading"
          >
            <font-awesome-icon icon="sign-out-alt" class="me-2" />
            Cerrar sesion
          </button>
          <button
            type="button"
            class="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            @click="handleKeepAlive"
            :disabled="loading"
          >
            <font-awesome-icon icon="sync" class="me-2" />
            {{ loading ? 'Renovando...' : 'Mantener sesion activa' }}
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
