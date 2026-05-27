<template>
  <div class="deasy-auth-page">
    <div class="deasy-auth-center">
      <div class="deasy-auth-card mx-auto grid max-w-5xl md:min-h-[38rem] md:grid-cols-[0.92fr_1.08fr]">
        <div class="deasy-auth-visual">
          <div class="relative z-10">
            <AppLogo size="xl" :framed="true" class-name="mb-12" />
            <div class="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              Primera instalación
            </div>
            <h2 class="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-tight text-slate-950">
              Configura el administrador raíz antes de usar el sistema.
            </h2>
            <p class="mt-4 max-w-sm text-sm font-medium leading-6 text-slate-500">
              Este paso queda habilitado solo cuando la instancia aún no tiene un administrador activo.
            </p>
          </div>

          <div class="relative z-10 grid gap-3 text-sm">
            <div class="rounded-xl border border-slate-200 bg-white p-4">
              <p class="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Entorno</p>
              <p class="mt-1 m-0 font-semibold text-slate-900">{{ environmentLabel }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-4">
              <p class="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Estado</p>
              <p class="mt-1 m-0 font-semibold text-slate-900">{{ statusLabel }}</p>
            </div>
          </div>
        </div>

        <div class="deasy-auth-panel">
          <div class="mb-9">
            <h1 class="deasy-auth-title">Bootstrap del sistema</h1>
            <p class="deasy-auth-copy">
              {{ copyText }}
            </p>
          </div>

          <form
            v-if="mode === 'bootstrap'"
            @submit.prevent="submitBootstrap"
            class="space-y-5"
            autocomplete="off"
          >
            <input type="text" name="bootstrap-decoy-user" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true" />
            <input type="password" name="bootstrap-decoy-password" autocomplete="current-password" class="hidden" tabindex="-1" aria-hidden="true" />
            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label for="cedula" class="mb-2 block text-sm font-semibold text-slate-700">Cédula</label>
                <input
                  id="cedula"
                  v-model="form.cedula"
                  name="bootstrap-root-cedula"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  class="deasy-auth-field"
                  placeholder="1234567890"
                  required
                />
              </div>
              <div>
                <label for="email" class="mb-2 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                <input
                  id="email"
                  v-model="form.email"
                  name="bootstrap-root-email"
                  type="email"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  class="deasy-auth-field"
                  placeholder="admin@institucion.edu.ec"
                  required
                />
              </div>
            </div>

            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label for="first-name" class="mb-2 block text-sm font-semibold text-slate-700">Nombres</label>
                <input
                  id="first-name"
                  v-model="form.first_name"
                  name="bootstrap-root-first-name"
                  type="text"
                  autocomplete="off"
                  class="deasy-auth-field"
                  placeholder="Administrador"
                  required
                />
              </div>
              <div>
                <label for="last-name" class="mb-2 block text-sm font-semibold text-slate-700">Apellidos</label>
                <input
                  id="last-name"
                  v-model="form.last_name"
                  name="bootstrap-root-last-name"
                  type="text"
                  autocomplete="off"
                  class="deasy-auth-field"
                  placeholder="Principal"
                  required
                />
              </div>
            </div>

            <div>
              <label for="whatsapp" class="mb-2 block text-sm font-semibold text-slate-700">WhatsApp (opcional)</label>
              <input
                id="whatsapp"
                v-model="form.whatsapp"
                name="bootstrap-root-whatsapp"
                type="text"
                inputmode="tel"
                autocomplete="off"
                class="deasy-auth-field"
                placeholder="0990000000"
              />
            </div>

            <div class="grid gap-5 md:grid-cols-2">
              <div>
                <label for="password" class="mb-2 block text-sm font-semibold text-slate-700">Contraseña</label>
                <input
                  id="password"
                  v-model="form.password"
                  name="bootstrap-root-password"
                  type="password"
                  autocomplete="new-password"
                  class="deasy-auth-field"
                  placeholder="Nueva contraseña"
                  required
                />
              </div>
              <div>
                <label for="confirm-password" class="mb-2 block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
                <input
                  id="confirm-password"
                  v-model="form.confirm_password"
                  name="bootstrap-root-password-confirmation"
                  type="password"
                  autocomplete="new-password"
                  class="deasy-auth-field"
                  placeholder="Repite la contraseña"
                  required
                />
              </div>
            </div>

            <button type="submit" class="deasy-auth-button" :disabled="isSubmitting">
              <IconLoader2 v-if="isSubmitting" class="h-5 w-5 animate-spin" />
              <template v-else>
                Crear administrador raíz
                <IconArrowRight class="h-5 w-5" />
              </template>
            </button>
          </form>

          <div
            v-else-if="mode === 'recovery_required'"
            class="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
          >
            <div class="flex items-start gap-3">
              <IconAlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div class="space-y-2">
                <p class="m-0 font-semibold">La instancia requiere recuperación administrativa.</p>
                <p class="m-0">
                  Existen datos operativos en la base y ya no es seguro reinicializar desde la UI. Usa el comando
                  <code class="rounded bg-white/80 px-1.5 py-0.5 text-[13px]">node scripts/bootstrap_admin_recovery.mjs ...</code>
                  desde el backend.
                </p>
              </div>
            </div>
          </div>
          <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Esta instancia ya tiene un administrador activo. El bootstrap inicial ya no está disponible.
          </div>

          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="-translate-y-2 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-y-0 opacity-100"
            leave-to-class="-translate-y-2 opacity-0"
          >
            <div
              v-if="message"
              :class="[
                'mt-6 flex rounded-xl border p-4',
                isError ? 'border-red-100 bg-red-50 text-red-600' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
              ]"
            >
              <component :is="isError ? IconAlertCircle : IconCheck" class="mr-3 mt-0.5 h-5 w-5 shrink-0" />
              <div class="flex-1 text-sm font-medium">{{ message }}</div>
            </div>
          </Transition>

          <div class="mt-8 flex justify-end">
            <button
              v-if="mode === 'normal'"
              type="button"
              class="deasy-auth-button deasy-auth-button--secondary"
              @click="router.replace({ name: 'login' })"
            >
              Ir al login
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import SystemBootstrapService from "@/modules/auth/services/SystemBootstrapService";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconLoader2
} from "@tabler/icons-vue";

const router = useRouter();
const isSubmitting = ref(false);
const message = ref("");
const isError = ref(false);
const mode = ref("bootstrap");
const environment = ref("development");

const form = reactive({
  cedula: "",
  first_name: "",
  last_name: "",
  email: "",
  whatsapp: "",
  password: "",
  confirm_password: ""
});

const environmentLabel = computed(() => environment.value);
const statusLabel = computed(() => {
  if (mode.value === "recovery_required") return "Recuperación requerida";
  if (mode.value === "normal") return "Sistema inicializado";
  return "Instancia virgen";
});

const copyText = computed(() => {
  if (mode.value === "recovery_required") {
    return "La base contiene información operativa. La creación del admin debe hacerse por recuperación controlada.";
  }
  if (mode.value === "normal") {
    return "El sistema ya tiene un administrador activo. Esta pantalla ya no está disponible para bootstrap.";
  }
  return "Define la primera cuenta root/admin. Después de esto el sistema volverá al flujo normal de autenticación.";
});

const loadStatus = async ({ force = false } = {}) => {
  try {
    const status = await SystemBootstrapService.getStatus({ force });
    mode.value = status.installationMode || "normal";
    environment.value = status.environment || "development";
    if (mode.value === "normal") {
      message.value = "La instancia ya fue inicializada. Puedes continuar con el login normal.";
      isError.value = false;
    }
  } catch (error) {
    message.value = error.response?.data?.message || "No se pudo consultar el estado del sistema.";
    isError.value = true;
  }
};

const submitBootstrap = async () => {
  isSubmitting.value = true;
  message.value = "";
  isError.value = false;

  try {
    await SystemBootstrapService.initialize(form);
    message.value = "Administrador creado correctamente. Serás redirigido al login.";
    isError.value = false;
    await loadStatus({ force: true });
    window.setTimeout(() => {
      router.replace({ name: "login" });
    }, 900);
  } catch (error) {
    message.value = error.response?.data?.message || "No se pudo inicializar el sistema.";
    isError.value = true;
    await loadStatus({ force: true });
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  loadStatus({ force: true });
});
</script>
