<template>
  <AppModalShell
    controlled
    :open="isOpen"
    labelled-by="sessionExpiryModalLabel"
    title="Sesión por expirar"
    size="md"
    :close-on-backdrop="false"
    @close="hide"
  >
    <template #title>
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <IconAlertTriangle class="w-6 h-6" />
        </div>
        <span>Sesión por expirar</span>
      </div>
    </template>

    <p class="mb-6 text-sm leading-relaxed text-slate-600">
      Tu sesión está a punto de expirar por inactividad. ¿Deseas mantener la sesión activa o prefieres salir ahora?
    </p>

    <template #footer>
      <AppButton
        type="button"
        variant="secondary"
        class-name="w-full sm:w-auto"
        @click="handleLogout"
        :disabled="loading"
      >
        <IconLogout class="w-4 h-4" />
        Cerrar sesión
      </AppButton>
      <AppButton
        type="button"
        variant="primary"
        class-name="w-full sm:w-auto"
        @click="handleKeepAlive"
        :disabled="loading"
      >
        <IconRefresh :class="['w-4 h-4', { 'animate-spin': loading }]" />
        {{ loading ? 'Renovando...' : 'Mantener activa' }}
      </AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { API_ROUTES } from '@/services/apiConfig';
import { clearAuthData } from '@/utils/tokenUtils';
import { IconAlertTriangle, IconLogout, IconRefresh } from '@tabler/icons-vue';
import AppButton from '@/components/AppButton.vue';
import AppModalShell from '@/components/AppModalShell.vue';

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
