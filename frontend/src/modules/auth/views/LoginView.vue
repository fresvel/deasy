<template>
  <div class="deasy-auth-page">
    <div class="deasy-auth-center">
      <div class="deasy-auth-card mx-auto grid max-w-5xl md:min-h-[38rem] md:grid-cols-[0.88fr_1.12fr]">
        <div class="deasy-auth-visual">
          <div class="relative z-10">
            <AppLogo size="xl" :framed="true" class-name="mb-12" />
            <div class="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              Plataforma operativa
            </div>
            <h2 class="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-tight text-slate-950">
              Gestión documental con una experiencia clara y moderna.
            </h2>
            <p class="mt-4 max-w-sm text-sm font-medium leading-6 text-slate-500">
              Revisa pendientes, gestiona documentos y firma procesos desde un espacio de trabajo ordenado.
            </p>
          </div>

          <div class="relative z-10 grid gap-3 text-sm">
            <div class="rounded-xl border border-slate-200 bg-white p-4">
              <p class="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Estado</p>
              <p class="mt-1 m-0 font-semibold text-slate-900">Procesos y firmas en un solo flujo</p>
            </div>
            <p class="m-0 text-xs font-medium text-slate-400">
              © {{ new Date().getFullYear() }} DEASY. Todos los derechos reservados.
            </p>
          </div>
        </div>

        <div class="deasy-auth-panel">
          <div class="mb-10 text-center md:hidden">
            <AppLogo size="lg" :framed="true" class-name="justify-center" />
            <p class="mt-3 text-sm font-medium text-slate-500">Plataforma de gestión documental</p>
          </div>

          <div class="mb-9">
            <h1 class="deasy-auth-title">Iniciar sesión</h1>
            <p class="deasy-auth-copy">Ingresa tus credenciales para acceder a tu espacio de trabajo.</p>
          </div>

          <form @submit.prevent="loginFunction" class="space-y-6">
            <div>
              <label for="identifier" class="mb-2 block text-sm font-semibold text-slate-700">
                Usuario
              </label>
              <div class="relative">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <IconUser class="h-5 w-5 text-slate-400" />
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
              <label for="password" class="mb-2 block text-sm font-semibold text-slate-700">
                Contraseña
              </label>
              <div class="relative">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <IconLock class="h-5 w-5 text-slate-400" />
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
                  class="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-blue-600"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  <IconEye v-if="!showPassword" class="h-5 w-5" />
                  <IconEyeOff v-else class="h-5 w-5" />
                </button>
              </div>
            </div>

            <div class="flex items-center justify-end">
              <router-link to="/recover-password" class="deasy-auth-link">
                ¿Olvidaste tu contraseña?
              </router-link>
            </div>

            <button type="submit" class="deasy-auth-button">
              Ingresar
              <IconArrowRight class="h-5 w-5" />
            </button>

            <div class="relative mt-8 mb-6">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-slate-100"></div>
              </div>
              <div class="relative flex justify-center text-sm font-medium">
                <span class="bg-white px-4 text-slate-400">¿No tienes una cuenta?</span>
              </div>
            </div>

            <router-link to="/register" class="deasy-auth-button deasy-auth-button--secondary">
              Crear usuario
            </router-link>
          </form>

          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="-translate-y-2 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="-translate-y-2 opacity-0"
          >
            <div v-if="errorMessage" class="mt-6 flex rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">
              <IconAlertCircle class="mr-3 mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div class="flex-1 text-sm font-medium">{{ errorMessage }}</div>
              <button @click="clearToast" class="ml-3 text-red-400 transition-colors hover:text-red-600" aria-label="Cerrar alerta">
                <IconX class="h-5 w-5" />
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import AuthService from "@/modules/auth/services/AuthService";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import { getDefaultAuthenticatedRoute } from "@/core/utils/accessControl.js";
import { IconUser, IconLock, IconEye, IconEyeOff, IconAlertCircle, IconX, IconArrowRight } from "@tabler/icons-vue";

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
    const statusCode = error.response?.status;
    const backendMessage = error.response?.data?.message;

    if (statusCode === 500) {
      errorMessage.value = "No se pudo iniciar sesión por un error interno del servidor. Intenta nuevamente en unos minutos.";
    } else if (statusCode === 401) {
      errorMessage.value = backendMessage || "El usuario no existe o la contraseña es incorrecta.";
    } else if (statusCode === 400) {
      errorMessage.value = backendMessage || "Revisa los datos ingresados para iniciar sesión.";
    } else if (backendMessage) {
      errorMessage.value = backendMessage;
    } else if (error.message) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = "Error al iniciar sesión";
    }
  }
};

const clearToast = () => {
  errorMessage.value = "";
};
</script>
