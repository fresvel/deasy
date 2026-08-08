<template>
  <AuthLayout size="md">
    <AppLogo size="lg" :framed="true" class-name="mb-8" />
    
    <!-- Go back button -->
    <router-link to="/" class="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors mb-8 group">
      <IconArrowLeft class="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
      Volver al login
    </router-link>

    <div class="mb-8">
      <div class="w-14 h-14 bg-sky-50 rounded-2xl flex flex-col items-center justify-center text-sky-600 mb-6">
        <IconKey class="h-7 w-7" />
      </div>
      <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Recuperar contraseña</h1>
      <p class="text-slate-500 mt-2.5 font-medium text-sm">
        Solicita un código de recuperación y luego define una nueva contraseña para tu cuenta.
      </p>
    </div>

    <form v-if="step === 'request'" @submit.prevent="recoverPassword" class="space-y-6" autocomplete="off">
      <input type="text" name="recover-decoy-user" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true" aria-label="Campo oculto de usuario" />
      <div>
        <label :for="fieldId('email')" class="block text-sm font-semibold text-slate-700 mb-2">
          Correo Electrónico
        </label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <IconMail class="h-5 w-5 text-slate-400" />
          </div>
          <input
            :id="fieldId('email')"
            type="email"
            v-model="email"
            name="recover-request-email"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            class="deasy-auth-field deasy-auth-field--icon-left"
            placeholder="correo@ejemplo.com"
            required
          />
        </div>
      </div>

      <button 
        type="submit" 
        :disabled="isLoading"
        class="deasy-auth-button"
      >
        <template v-if="!isLoading">
          Enviar código
        </template>
        <template v-else>
          <IconLoader2 class="h-5 w-5 animate-spin" />
          <span class="ml-2">Enviando...</span>
        </template>
      </button>
    </form>

    <form v-else @submit.prevent="submitReset" class="space-y-6" autocomplete="off">
      <input type="text" name="recover-reset-decoy-user" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true" aria-label="Campo oculto de usuario" />
      <input type="password" name="recover-reset-decoy-password" autocomplete="current-password" class="hidden" tabindex="-1" aria-hidden="true" aria-label="Campo oculto de contraseña" />
      <div>
        <label :for="fieldId('email-confirmed')" class="block text-sm font-semibold text-slate-700 mb-2">
          Correo Electrónico
        </label>
        <input
          :id="fieldId('email-confirmed')"
          type="email"
          v-model="email"
          name="recover-reset-email"
          autocomplete="off"
          class="deasy-auth-field bg-slate-50"
          readonly
        />
      </div>

      <div>
        <label :for="fieldId('code')" class="block text-sm font-semibold text-slate-700 mb-2">
          Código de recuperación
        </label>
        <input
          :id="fieldId('code')"
          type="text"
          v-model="code"
          name="recover-reset-code"
          autocomplete="one-time-code"
          class="deasy-auth-field"
          placeholder="Ingresa el código recibido"
          required
        />
      </div>

      <div>
        <label :for="fieldId('password')" class="block text-sm font-semibold text-slate-700 mb-2">
          Nueva contraseña
        </label>
        <input
          :id="fieldId('password')"
          type="password"
          v-model="password"
          name="recover-reset-new-password"
          autocomplete="new-password"
          class="deasy-auth-field"
          placeholder="Nueva contraseña"
          required
        />
      </div>

      <div>
        <label :for="fieldId('repassword')" class="block text-sm font-semibold text-slate-700 mb-2">
          Confirmar contraseña
        </label>
        <input
          :id="fieldId('repassword')"
          type="password"
          v-model="repassword"
          name="recover-reset-new-password-confirmation"
          autocomplete="new-password"
          class="deasy-auth-field"
          placeholder="Repite la nueva contraseña"
          required
        />
      </div>

      <div class="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          class="deasy-auth-button deasy-auth-button--secondary"
          :disabled="isLoading"
          @click="step = 'request'"
        >
          Cambiar correo
        </button>
        <button
          type="submit"
          :disabled="isLoading"
          class="deasy-auth-button"
        >
          <template v-if="!isLoading">
            Actualizar contraseña
          </template>
          <template v-else>
            <IconLoader2 class="h-5 w-5 animate-spin" />
            <span class="ml-2">Actualizando...</span>
          </template>
        </button>
      </div>
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

  </AuthLayout>
</template>

<script setup>
import { ref, useId } from 'vue';
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import AuthLayout from '@/layouts/auth/AuthLayout.vue';
import AuthService from '@/modules/auth/services/AuthService';
import AppLogo from '@/shared/components/layout/AppLogo.vue';
import { IconArrowLeft, IconKey, IconMail, IconLoader2, IconAlertCircle, IconCheck } from '@tabler/icons-vue';

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;

const email = ref('');
const code = ref('');
const password = ref('');
const repassword = ref('');
const isLoading = ref(false);
const statusMessage = ref('');
const isError = ref(false);
const step = ref('request');

const recoverPassword = async () => {
  if (!email.value) return;
  
  isLoading.value = true;
  statusMessage.value = '';
  isError.value = false;

  try {
    await AuthService.recoverPassword(email.value.trim());
    
    statusMessage.value = 'Si el correo está registrado, recibirás un código de recuperación para restablecer tu contraseña.';
    isError.value = false;
    step.value = 'reset';
  } catch (error) {
    statusMessage.value = resolveApiErrorMessage(error, 'Error al intentar recuperar la contraseña.');
    isError.value = true;
  } finally {
    isLoading.value = false;
  }
};

const submitReset = async () => {
  if (!email.value || !code.value || !password.value || !repassword.value) return;

  isLoading.value = true;
  statusMessage.value = '';
  isError.value = false;

  try {
    await AuthService.resetPassword(
      email.value.trim(),
      code.value.trim(),
      password.value,
      repassword.value
    );

    statusMessage.value = 'La contraseña se actualizó correctamente. Ya puedes volver al login.';
    isError.value = false;
    code.value = '';
    password.value = '';
    repassword.value = '';
    step.value = 'request';
  } catch (error) {
    statusMessage.value = resolveApiErrorMessage(error, 'No se pudo actualizar la contraseña.');
    isError.value = true;
  } finally {
    isLoading.value = false;
  }
};
</script>
