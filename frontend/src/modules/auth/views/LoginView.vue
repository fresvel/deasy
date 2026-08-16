<template>
  <AuthLayout size="md">
    <div class="mb-8 flex flex-col items-center text-center">
      <AppLogo size="lg" :framed="true" class-name="mb-4" />
      <h1 class="deasy-auth-title">Iniciar sesión</h1>
      <p class="deasy-auth-copy">Ingresa tus credenciales para acceder a tu espacio de trabajo.</p>
    </div>

    <form @submit.prevent="loginFunction" class="space-y-5">
      <div>
        <label for="identifier" class="deasy-form-label">Usuario</label>
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <IconUser class="h-5 w-5 text-muted" />
          </div>
          <input
            id="identifier"
            v-model="identifier"
            type="text"
            class="deasy-auth-field deasy-auth-field--icon-left"
            placeholder="Cédula o correo electrónico"
            required
          />
        </div>
      </div>

      <div>
        <label for="password" class="deasy-form-label">Contraseña</label>
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <IconLock class="h-5 w-5 text-muted" />
          </div>
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            class="deasy-auth-field deasy-auth-field--icon-left pr-12"
            placeholder="Ingresa tu contraseña"
            required
          />
          <button
            type="button"
            @click="showPassword = !showPassword"
            class="deasy-inline-icon-button absolute inset-y-0 right-2 my-auto"
            aria-label="Mostrar u ocultar contraseña"
          >
            <IconEye v-if="!showPassword" class="h-5 w-5" />
            <IconEyeOff v-else class="h-5 w-5" />
          </button>
        </div>
      </div>

      <div class="flex items-center justify-end">
        <router-link to="/recover-password" class="deasy-auth-link">¿Olvidaste tu contraseña?</router-link>
      </div>

      <button type="submit" class="deasy-btn deasy-btn--primary deasy-btn--lg deasy-btn--block">
        Ingresar
        <IconArrowRight class="h-5 w-5" />
      </button>
    </form>

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div v-if="errorMessage" class="deasy-alert deasy-alert--danger mt-5 flex">
        <IconAlertCircle class="mr-3 mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div class="flex-1 text-sm font-medium">{{ errorMessage }}</div>
        <AppCloseButton class="ml-3" label="Cerrar alerta" @click="clearToast" />
      </div>
    </Transition>

    <div class="relative my-7">
      <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-line"></div></div>
      <div class="relative flex justify-center text-sm font-medium">
        <span class="bg-white px-4 text-muted">¿No tienes una cuenta?</span>
      </div>
    </div>

    <router-link to="/register" class="deasy-btn deasy-btn--neutral-outline deasy-btn--lg deasy-btn--block">Crear usuario</router-link>
  </AuthLayout>
</template>

<script setup>
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import { ref } from "vue";
import { useRouter } from "vue-router";
import AuthService from "@/modules/auth/services/AuthService";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import { getDefaultAuthenticatedRoute } from "@/core/utils/accessControl.js";
import { resolveApiErrorMessage } from "@/shared/utils/apiError.js";
import { IconUser, IconLock, IconEye, IconEyeOff, IconAlertCircle, IconArrowRight } from "@tabler/icons-vue";

// El login escala el mensaje por codigo de estado, cosa que el resto de pantallas no hace: un 500 se
// traduce a un texto propio ignorando lo que diga el backend (un fallo interno no es asunto del usuario),
// mientras que 401 y 400 prefieren el mensaje del backend y solo caen a estos por defecto.
const MENSAJES_POR_ESTADO = {
  401: "El usuario no existe o la contraseña es incorrecta.",
  400: "Revisa los datos ingresados para iniciar sesión."
};
const MENSAJE_ERROR_INTERNO =
  "No se pudo iniciar sesión por un error interno del servidor. Intenta nuevamente en unos minutos.";

/**
 * Escalado propio del login. No se delega entero en resolveApiErrorMessage porque el orden importa: para
 * 401/400 el texto por estado debe ganar a error.message, y axios SIEMPRE rellena error.message con
 * "Request failed with status code 401". Delegar sin mas mostraria esa cadena tecnica al usuario.
 */
const resolveLoginErrorMessage = (error) => {
  const status = error.response?.status;
  if (status === 500) {
    return MENSAJE_ERROR_INTERNO;
  }
  const porEstado = MENSAJES_POR_ESTADO[status];
  if (porEstado) {
    const data = error.response?.data;
    return data?.message || data?.error || porEstado;
  }
  return resolveApiErrorMessage(error, "Error al iniciar sesión");
};

const identifier = ref("");
const password = ref("");
const errorMessage = ref("");
const router = useRouter();
const showPassword = ref(false);

const loginFunction = async () => {
  try {
    errorMessage.value = "";
    const authData = await AuthService.login(identifier.value, password.value);
    router.push(getDefaultAuthenticatedRoute(authData?.user));
  } catch (error) {
    errorMessage.value = resolveLoginErrorMessage(error);
  }
};

const clearToast = () => {
  errorMessage.value = "";
};
</script>
