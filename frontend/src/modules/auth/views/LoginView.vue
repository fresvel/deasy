<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
    <div class="max-w-4xl w-full bg-white rounded-4xl shadow-2xl shadow-slate-300/50 overflow-hidden flex flex-col md:flex-row border border-slate-200">
      
      <!-- Left side (Image/Gradient info) -->
      <div class="hidden md:flex md:w-5/12 bg-sky-700 bg-linear-to-br from-sky-800 via-sky-700 to-sky-600 p-12 flex-col justify-between text-white relative overflow-hidden">
        <!-- Abstract shapes -->
        <div class="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white blur-3xl opacity-50"></div>
          <div class="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-sky-300 blur-3xl opacity-40"></div>
          <div class="absolute -bottom-24 -left-12 w-80 h-80 rounded-full bg-sky-900 blur-3xl opacity-50"></div>
        </div>
        
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-10">
            <span class="text-3xl font-extrabold tracking-tight">PUCE</span>
            <span class="text-3xl font-light tracking-wide">ESMERALDAS</span>
          </div>
          <h2 class="text-4xl font-bold mb-4 leading-tight">Excelencia académica<br>con sentido humano</h2>
          <p class="text-sky-100/90 text-lg font-medium">Sistema DEASY</p>
        </div>
        
        <div class="relative z-10 mt-auto text-sm text-sky-200/80 font-medium">
          &copy; {{ new Date().getFullYear() }} DEASY. Todos los derechos reservados.
        </div>
      </div>

      <!-- Right side (Form) -->
      <div class="w-full md:w-7/12 p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
        <!-- Mobile Header -->
        <div class="md:hidden text-center mb-10">
           <div class="flex justify-center items-center gap-2 text-sky-800">
            <span class="text-3xl font-extrabold tracking-tight">PUCE</span>
            <span class="text-3xl font-light tracking-wide">ESMERALDAS</span>
          </div>
          <p class="text-slate-500 text-sm mt-2 font-medium">Sistema DEASY</p>
        </div>

        <div class="mb-10">
          <h1 class="text-3xl font-bold text-slate-800 tracking-tight">Iniciar Sesión</h1>
          <p class="text-slate-500 mt-2.5 font-medium text-sm">Ingresa tus credenciales para acceder a tu cuenta.</p>
        </div>

        <form @submit.prevent="loginFunction" class="space-y-6">
          <div>
            <label for="identifier" class="block text-sm font-semibold text-slate-700 mb-2">
              Usuario
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <IconUser class="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="identifier"
                type="text"
                v-model="identifier"
                class="block w-full pl-11 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400 placeholder:text-sm"
                placeholder="Cédula o correo electrónico"
                required
              />
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-semibold text-slate-700 mb-2">
              Contraseña
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <IconLock class="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password"
                :type="showPassword ? 'text' : 'password'"
                v-model="password"
                class="block w-full pl-11 pr-12 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400 placeholder:text-sm"
                placeholder="••••••••••••"
                required
              />
              <button 
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-sky-600 transition-colors"
              >
                <IconEye v-if="!showPassword" class="h-5 w-5" />
                <IconEyeOff v-else class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="flex items-center justify-end">
            <router-link to="/recover-password" class="text-sm font-semibold text-sky-600 hover:text-sky-700 hover:underline transition-all">
              ¿Olvidaste tu contraseña?
            </router-link>
          </div>

          <button 
            type="submit" 
            class="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-white text-sm font-semibold bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/30 transition-all shadow-lg shadow-sky-600/20 active:scale-[0.98]"
          >
            Ingresar
            <IconArrowRight class="h-5 w-5" />
          </button>

          <div class="relative mt-8 mb-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-100"></div>
            </div>
            <div class="relative flex justify-center text-sm font-medium">
              <span class="px-4 bg-white text-slate-400">¿No tienes una cuenta?</span>
            </div>
          </div>

          <router-link 
            to="/register" 
            class="w-full flex justify-center py-3 px-4 rounded-xl text-slate-700 text-sm font-semibold bg-white border-2 border-slate-100 hover:border-sky-200 hover:bg-slate-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-slate-500/10 transition-all active:scale-[0.98]"
          >
            Crear usuario
          </router-link>
        </form>

        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="transform -translate-y-2 opacity-0"
          enter-to-class="transform translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="transform translate-y-0 opacity-100"
          leave-to-class="transform -translate-y-2 opacity-0"
        >
          <div v-if="errorMessage" class="mt-6 flex bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600">
            <IconAlertCircle class="h-5 w-5 shrink-0 mr-3 mt-0.5 text-red-500" />
            <div class="flex-1 text-sm font-medium">{{ errorMessage }}</div>
            <button @click="clearToast" class="ml-3 text-red-400 hover:text-red-600 transition-colors">
              <IconX class="h-5 w-5" />
            </button>
          </div>
        </Transition>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthService from '@/modules/auth/services/AuthService';
import { IconUser, IconLock, IconEye, IconEyeOff, IconAlertCircle, IconX, IconArrowRight } from '@tabler/icons-vue';

const identifier = ref('');
const password = ref('');
const errorMessage = ref('');
const router = useRouter();
const showPassword = ref(false);

const loginFunction = async () => {
  try {
    errorMessage.value = '';
    await AuthService.login(identifier.value, password.value);
    router.push('/dashboard');
  } catch (error) {
    const statusCode = error.response?.status;
    const backendMessage = error.response?.data?.message;

    if (statusCode === 500) {
      errorMessage.value = 'No se pudo iniciar sesión por un error interno del servidor. Intenta nuevamente en unos minutos.';
    } else if (statusCode === 401) {
      errorMessage.value = backendMessage || 'El usuario no existe o la contraseña es incorrecta.';
    } else if (statusCode === 400) {
      errorMessage.value = backendMessage || 'Revisa los datos ingresados para iniciar sesión.';
    } else if (backendMessage) {
      errorMessage.value = backendMessage;
    } else if (error.message) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'Error al iniciar sesión';
    }
  }
};

const clearToast = () => {
  errorMessage.value = '';
};
</script>