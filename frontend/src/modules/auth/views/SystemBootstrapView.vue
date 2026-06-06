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
              Configura el administrador raíz y la base del sistema.
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
          <div class="mb-7">
            <h1 class="deasy-auth-title">Bootstrap del sistema</h1>
            <p class="deasy-auth-copy">{{ copyText }}</p>
          </div>

          <div v-if="mode === 'bootstrap'" class="space-y-6" autocomplete="off">
            <!-- Indicador de pasos -->
            <ol class="flex items-center gap-1.5 text-xs font-semibold">
              <li v-for="(s, i) in steps" :key="s.key" class="flex items-center gap-1.5">
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full"
                  :class="step >= i + 1 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'"
                >{{ i + 1 }}</span>
                <span class="hidden sm:inline" :class="step === i + 1 ? 'text-slate-800' : 'text-slate-400'">{{ s.label }}</span>
                <span v-if="i < steps.length - 1" class="mx-0.5 h-px w-4 bg-slate-200"></span>
              </li>
            </ol>

            <!-- Paso 1: Administrador -->
            <div v-show="step === 1" class="space-y-5">
              <div class="grid gap-5 md:grid-cols-2">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-slate-700">Cédula</label>
                  <input v-model="form.cedula" type="text" inputmode="numeric" autocomplete="off" class="deasy-auth-field" placeholder="1234567890" />
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                  <input v-model="form.email" type="email" autocomplete="off" class="deasy-auth-field" placeholder="admin@institucion.edu.ec" />
                </div>
              </div>
              <div class="grid gap-5 md:grid-cols-2">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-slate-700">Nombres</label>
                  <input v-model="form.first_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Administrador" />
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-slate-700">Apellidos</label>
                  <input v-model="form.last_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Principal" />
                </div>
              </div>
              <div>
                <label class="mb-2 block text-sm font-semibold text-slate-700">WhatsApp (opcional)</label>
                <input v-model="form.whatsapp" type="text" inputmode="tel" autocomplete="off" class="deasy-auth-field" placeholder="0990000000" />
              </div>
              <div class="grid gap-5 md:grid-cols-2">
                <div>
                  <label class="mb-2 block text-sm font-semibold text-slate-700">Contraseña</label>
                  <input v-model="form.password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Nueva contraseña" />
                </div>
                <div>
                  <label class="mb-2 block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
                  <input v-model="form.confirm_password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Repite la contraseña" />
                </div>
              </div>
            </div>

            <!-- Paso 2: Gestor por defecto (opcional) -->
            <div v-show="step === 2" class="space-y-5">
              <label class="flex items-center gap-3 rounded-xl border p-3" :class="gestorEnabled ? 'border-sky-300 bg-sky-50' : 'border-slate-200'">
                <input v-model="gestorEnabled" type="checkbox" class="h-4 w-4" />
                <span>
                  <span class="block text-sm font-semibold text-slate-700">Crear un gestor por defecto</span>
                  <span class="block text-xs text-slate-500">Persona con rol "Gestor de procesos". Opcional; puedes crear gestores luego.</span>
                </span>
              </label>
              <div v-if="gestorEnabled" class="space-y-5">
                <div class="grid gap-5 md:grid-cols-2">
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-slate-700">Cédula</label>
                    <input v-model="gestorForm.cedula" type="text" inputmode="numeric" autocomplete="off" class="deasy-auth-field" placeholder="0987654321" />
                  </div>
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                    <input v-model="gestorForm.email" type="email" autocomplete="off" class="deasy-auth-field" placeholder="gestor@institucion.edu.ec" />
                  </div>
                </div>
                <div class="grid gap-5 md:grid-cols-2">
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-slate-700">Nombres</label>
                    <input v-model="gestorForm.first_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Gestor" />
                  </div>
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-slate-700">Apellidos</label>
                    <input v-model="gestorForm.last_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Procesos" />
                  </div>
                </div>
                <div class="grid gap-5 md:grid-cols-2">
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-slate-700">Contraseña</label>
                    <input v-model="gestorForm.password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Contraseña del gestor" />
                  </div>
                  <div>
                    <label class="mb-2 block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
                    <input v-model="gestorForm.confirm_password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Repite la contraseña" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Paso 3: Catálogos genéricos -->
            <div v-show="step === 3" class="space-y-3">
              <p class="m-0 text-sm text-slate-500">
                Selecciona los catálogos genéricos a preconfigurar. Son ejemplos reutilizables que puedes editar
                o ampliar luego desde el panel.
              </p>
              <label
                v-for="b in catalogBlocks"
                :key="b.key"
                class="flex items-start gap-3 rounded-xl border p-3"
                :class="preconfig[b.key] ? 'border-sky-300 bg-sky-50' : 'border-slate-200'"
              >
                <input v-model="preconfig[b.key]" type="checkbox" class="mt-1 h-4 w-4" />
                <span>
                  <span class="block text-sm font-semibold text-slate-700">{{ b.label }}</span>
                  <span class="block text-xs text-slate-500">{{ b.hint }}</span>
                </span>
              </label>
            </div>

            <!-- Paso 4: Resumen -->
            <div v-show="step === 4" class="space-y-3 text-sm">
              <div class="rounded-xl border border-slate-200 p-4">
                <p class="m-0 font-semibold text-slate-700">Administrador</p>
                <p class="m-0 text-slate-500">{{ form.first_name }} {{ form.last_name }} · {{ form.email }}</p>
              </div>
              <div class="rounded-xl border border-slate-200 p-4">
                <p class="m-0 font-semibold text-slate-700">Gestor por defecto</p>
                <p class="m-0 text-slate-500">{{ gestorEnabled ? `${gestorForm.first_name} ${gestorForm.last_name} · ${gestorForm.email}` : 'No se creará' }}</p>
              </div>
              <div class="rounded-xl border border-slate-200 p-4">
                <p class="m-0 font-semibold text-slate-700">Catálogos a preconfigurar</p>
                <p class="m-0 text-slate-500">{{ selectedCatalogLabels || 'Ninguno' }}</p>
              </div>
            </div>

            <!-- Navegación -->
            <div class="flex items-center justify-between gap-3 pt-1">
              <button v-if="step > 1" type="button" class="deasy-auth-button deasy-auth-button--secondary" @click="prevStep">Atrás</button>
              <span v-else></span>
              <button v-if="step < steps.length" type="button" class="deasy-auth-button" :disabled="!canAdvance" @click="nextStep">
                Siguiente <IconArrowRight class="h-5 w-5" />
              </button>
              <button v-else type="button" class="deasy-auth-button" :disabled="isSubmitting" @click="submitBootstrap">
                <IconLoader2 v-if="isSubmitting" class="h-5 w-5 animate-spin" />
                <template v-else>Crear sistema <IconArrowRight class="h-5 w-5" /></template>
              </button>
            </div>
          </div>

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

const step = ref(1);
const steps = [
  { key: "admin", label: "Administrador" },
  { key: "gestor", label: "Gestor" },
  { key: "catalogos", label: "Catálogos" },
  { key: "resumen", label: "Resumen" }
];

const blankPerson = () => ({
  cedula: "",
  first_name: "",
  last_name: "",
  email: "",
  whatsapp: "",
  password: "",
  confirm_password: ""
});

const form = reactive(blankPerson());
const gestorEnabled = ref(false);
const gestorForm = reactive(blankPerson());

const catalogBlocks = [
  { key: "unit_types", label: "Tipos de unidad", hint: "Prorrectorado, Coordinación, Dirección, Escuela, Carrera, Sede…" },
  { key: "relation_unit_types", label: "Tipos de relación de unidad", hint: "Relación orgánica (jerárquica)." },
  { key: "cargos", label: "Cargos", hint: "Coordinador, Docente, Director, Jefe… con su mapa a roles." },
  { key: "term_types", label: "Periodos académicos", hint: "Semestre, Trimestre, Intensivo, Custom." }
];
const preconfig = reactive({ unit_types: true, relation_unit_types: true, cargos: true, term_types: true });

const selectedCatalogLabels = computed(() =>
  catalogBlocks.filter((b) => preconfig[b.key]).map((b) => b.label).join(", ")
);

const isPersonComplete = (p) =>
  Boolean(p.cedula && p.cedula.trim().length >= 10
    && p.first_name.trim() && p.last_name.trim() && p.email.trim()
    && p.password && p.password === p.confirm_password);

const canAdvance = computed(() => {
  if (step.value === 1) return isPersonComplete(form);
  if (step.value === 2) return !gestorEnabled.value || isPersonComplete(gestorForm);
  return true;
});

const nextStep = () => {
  if (!canAdvance.value) return;
  if (step.value < steps.length) step.value += 1;
};
const prevStep = () => {
  if (step.value > 1) step.value -= 1;
};

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
  return "Define la cuenta administradora, opcionalmente un gestor, y los catálogos a preconfigurar.";
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
    const payload = {
      ...form,
      gestor: gestorEnabled.value ? { ...gestorForm } : null,
      preconfig: { ...preconfig }
    };
    await SystemBootstrapService.initialize(payload);
    message.value = "Sistema inicializado correctamente. Serás redirigido al login.";
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
