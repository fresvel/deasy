<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
    <div class="max-w-md w-full bg-white rounded-4xl shadow-xl shadow-slate-300/50 p-8 sm:p-12 border border-slate-200 relative overflow-hidden">
      
      <!-- Go back button -->
      <router-link to="/" class="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-sky-600 transition-colors mb-8 group">
        <IconArrowLeft class="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
        Volver al login
      </router-link>

      <div class="mb-8">
        <div class="w-14 h-14 bg-sky-50 rounded-2xl flex flex-col items-center justify-center text-sky-600 mb-6">
          <IconKey class="h-7 w-7" />
        </div>
        <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Recuperar contraseña</h1>
        <p class="text-slate-500 mt-2.5 font-medium text-sm">
          Ingresa la dirección de correo electrónico asociada a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <form @submit.prevent="recoverPassword" class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-semibold text-slate-700 mb-2">
            Correo Electrónico
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <IconMail class="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="email"
              type="email"
              v-model="email"
              class="block w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none font-medium placeholder-slate-400 text-sm"
              placeholder="correo@ejemplo.com"
              required
            />
          </div>
        </div>

        <button 
          type="submit" 
          :disabled="isLoading"
          class="w-full flex justify-center items-center py-3 px-4 rounded-xl text-white text-sm font-semibold bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/30 transition-all shadow-lg shadow-sky-600/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <template v-if="!isLoading">
            Enviar enlace
          </template>
          <template v-else>
            <IconLoader2 class="h-5 w-5 animate-spin" />
            <span class="ml-2">Enviando...</span>
          </template>
        </button>
      </form>

      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div v-if="statusMessage" :class="[
          'mt-6 flex p-4 rounded-2xl border text-sm font-medium',
          isError ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
        ]">
          <IconAlertCircle v-if="isError" class="h-5 w-5 shrink-0 mr-3 mt-0.5 text-red-500" />
          <IconCheck class="h-5 w-5 shrink-0 mr-3 mt-0.5" v-else />
          <div class="flex-1">{{ statusMessage }}</div>
        </div>
      </Transition>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import AuthService from '@/services/auth/AuthService';
import { IconArrowLeft, IconKey, IconMail, IconSend, IconLoader2, IconAlertCircle, IconCheck } from '@tabler/icons-vue';

const email = ref('');
const isLoading = ref(false);
const statusMessage = ref('');
const isError = ref(false);

const recoverPassword = async () => {
  if (!email.value) return;
  
  isLoading.value = true;
  statusMessage.value = '';
  isError.value = false;

  try {
    await AuthService.recoverPassword(email.value.trim());
    
    statusMessage.value = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.';
    isError.value = false;
    email.value = '';
  } catch (error) {
    statusMessage.value = error.response?.data?.message || 'Error al intentar recuperar la contraseña.';
    isError.value = true;
  } finally {
    isLoading.value = false;
  }
};
</script>