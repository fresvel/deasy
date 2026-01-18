<template>
  <div
    class="modal fade"
    id="sessionExpiryModal"
    tabindex="-1"
    ref="modal"
    aria-labelledby="sessionExpiryModalLabel"
    aria-hidden="true"
    data-bs-backdrop="static"
    data-bs-keyboard="false"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-warning text-dark">
          <h5 class="modal-title" id="sessionExpiryModalLabel">
            <font-awesome-icon icon="exclamation-triangle" class="me-2" />
            Sesión por expirar
          </h5>
        </div>
        <div class="modal-body">
          <p class="mb-3">
            Tu sesión está por expirar. ¿Deseas mantener la sesión activa o cerrar sesión?
          </p>
          <div class="d-flex gap-2 justify-content-end">
            <button
              type="button"
              class="btn btn-secondary"
              @click="handleLogout"
              :disabled="loading"
            >
              <font-awesome-icon icon="sign-out-alt" class="me-2" />
              Cerrar sesión
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="handleKeepAlive"
              :disabled="loading"
            >
              <font-awesome-icon icon="sync" class="me-2" />
              {{ loading ? 'Renovando...' : 'Mantener sesión activa' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Modal } from 'bootstrap';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { API_ROUTES } from '@/services/apiConfig';
import { clearAuthData } from '@/utils/tokenUtils';

const emit = defineEmits(['session-refreshed', 'session-closed']);

const modal = ref(null);
const loading = ref(false);
let bootstrapModal = null;
const router = useRouter();

onMounted(() => {
  if (modal.value) {
    bootstrapModal = new Modal(modal.value);
  }
});

const show = () => {
  if (bootstrapModal) {
    bootstrapModal.show();
  }
};

const hide = () => {
  if (bootstrapModal) {
    bootstrapModal.hide();
  }
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

<style scoped>
.modal-header.bg-warning {
  background-color: #ffc107 !important;
  border-bottom: 1px solid #ffc107;
}
</style>
