<template>
  <AuthLayout size="2xl">
    <div class="mb-7 flex flex-col items-center text-center">
      <AppLogo size="lg" :framed="true" class-name="mb-4" />
      <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Primera instalación · {{ environmentLabel }}
      </span>
      <h1 class="deasy-auth-title mt-4">Bootstrap del sistema</h1>
      <p class="deasy-auth-copy max-w-md">{{ copyText }}</p>
    </div>

    <div v-if="mode === 'bootstrap'" class="space-y-6" autocomplete="off">
      <!-- Indicador de pasos -->
      <ol class="flex items-center justify-center gap-1.5 text-xs font-semibold">
        <li v-for="(s, i) in steps" :key="s.key" class="flex items-center gap-1.5">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            :class="step >= i + 1 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'"
          >{{ i + 1 }}</span>
          <span class="hidden sm:inline" :class="step === i + 1 ? 'text-slate-800' : 'text-slate-400'">{{ s.label }}</span>
          <span v-if="i < steps.length - 1" class="mx-1 h-px w-5 bg-slate-200"></span>
        </li>
      </ol>

      <!-- Paso 1: Administrador -->
      <div v-show="step === 1" class="space-y-4">
        <label class="flex items-center gap-2.5 text-sm font-medium text-slate-600">
          <input v-model="useExampleAdmin" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-sky-600" @change="toggleExampleAdmin" />
          Usar datos de ejemplo (rellena el formulario para crear rápido)
        </label>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label :for="fieldId('cedula-1')" class="mb-1.5 block text-sm font-semibold text-slate-700">Cédula</label>
            <input :id="fieldId('cedula-1')" v-model="form.cedula" type="text" inputmode="numeric" autocomplete="off" class="deasy-auth-field" placeholder="1234567890" />
          </div>
          <div>
            <label :for="fieldId('email-1')" class="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
            <input :id="fieldId('email-1')" v-model="form.email" type="email" autocomplete="off" class="deasy-auth-field" placeholder="admin@institucion.edu.ec" />
          </div>
          <div>
            <label :for="fieldId('first-name-1')" class="mb-1.5 block text-sm font-semibold text-slate-700">Nombres</label>
            <input :id="fieldId('first-name-1')" v-model="form.first_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Administrador" />
          </div>
          <div>
            <label :for="fieldId('last-name-1')" class="mb-1.5 block text-sm font-semibold text-slate-700">Apellidos</label>
            <input :id="fieldId('last-name-1')" v-model="form.last_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Principal" />
          </div>
          <div>
            <label :for="fieldId('whatsapp')" class="mb-1.5 block text-sm font-semibold text-slate-700">WhatsApp (opcional)</label>
            <input :id="fieldId('whatsapp')" v-model="form.whatsapp" type="text" inputmode="tel" autocomplete="off" class="deasy-auth-field" placeholder="0990000000" />
          </div>
          <div class="hidden md:block"></div>
          <div>
            <label :for="fieldId('password-1')" class="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
            <input :id="fieldId('password-1')" v-model="form.password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Nueva contraseña" />
          </div>
          <div>
            <label :for="fieldId('confirm-password-1')" class="mb-1.5 block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
            <input :id="fieldId('confirm-password-1')" v-model="form.confirm_password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Repite la contraseña" />
          </div>
        </div>
      </div>

      <!-- Paso 2: Gestor por defecto (opcional) -->
      <div v-show="step === 2" class="space-y-4">
        <div class="rounded-xl border p-3.5 transition-colors" :class="gestorEnabled ? 'border-sky-300 bg-sky-50' : 'border-slate-200'">
          <SToggle v-model="gestorEnabled">
            <span>
              <span class="block text-sm font-semibold text-slate-700">Crear un gestor por defecto</span>
              <span class="block text-xs text-slate-500">Persona con rol "Gestor de procesos". Opcional; puedes crear gestores luego.</span>
            </span>
          </SToggle>
        </div>
        <div v-if="gestorEnabled" class="space-y-4">
          <label class="flex items-center gap-2.5 text-sm font-medium text-slate-600">
            <input v-model="useExampleGestor" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-sky-600" @change="toggleExampleGestor" />
            Usar datos de ejemplo
          </label>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label :for="fieldId('cedula-2')" class="mb-1.5 block text-sm font-semibold text-slate-700">Cédula</label>
              <input :id="fieldId('cedula-2')" v-model="gestorForm.cedula" type="text" inputmode="numeric" autocomplete="off" class="deasy-auth-field" placeholder="0987654321" />
            </div>
            <div>
              <label :for="fieldId('email-2')" class="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
              <input :id="fieldId('email-2')" v-model="gestorForm.email" type="email" autocomplete="off" class="deasy-auth-field" placeholder="gestor@institucion.edu.ec" />
            </div>
            <div>
              <label :for="fieldId('first-name-2')" class="mb-1.5 block text-sm font-semibold text-slate-700">Nombres</label>
              <input :id="fieldId('first-name-2')" v-model="gestorForm.first_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Gestor" />
            </div>
            <div>
              <label :for="fieldId('last-name-2')" class="mb-1.5 block text-sm font-semibold text-slate-700">Apellidos</label>
              <input :id="fieldId('last-name-2')" v-model="gestorForm.last_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Procesos" />
            </div>
            <div>
              <label :for="fieldId('password-2')" class="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
              <input :id="fieldId('password-2')" v-model="gestorForm.password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Contraseña del gestor" />
            </div>
            <div>
              <label :for="fieldId('confirm-password-2')" class="mb-1.5 block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
              <input :id="fieldId('confirm-password-2')" v-model="gestorForm.confirm_password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Repite la contraseña" />
            </div>
          </div>
        </div>

        <!-- Usuario de prueba (opcional): rol base "Usuario" para validar el flujo operativo -->
        <div class="rounded-xl border p-3.5 transition-colors" :class="usuarioEnabled ? 'border-sky-300 bg-sky-50' : 'border-slate-200'">
          <SToggle v-model="usuarioEnabled">
            <span>
              <span class="block text-sm font-semibold text-slate-700">Crear un usuario de prueba</span>
              <span class="block text-xs text-slate-500">Persona con rol "Usuario" para probar el flujo operativo (Home, tareas, firmas). Opcional.</span>
            </span>
          </SToggle>
        </div>
        <div v-if="usuarioEnabled" class="space-y-4">
          <label class="flex items-center gap-2.5 text-sm font-medium text-slate-600">
            <input v-model="useExampleUsuario" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-sky-600" @change="toggleExampleUsuario" />
            Usar datos de ejemplo
          </label>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label :for="fieldId('cedula-3')" class="mb-1.5 block text-sm font-semibold text-slate-700">Cédula</label>
              <input :id="fieldId('cedula-3')" v-model="usuarioForm.cedula" type="text" inputmode="numeric" autocomplete="off" class="deasy-auth-field" placeholder="1122334455" />
            </div>
            <div>
              <label :for="fieldId('email-3')" class="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
              <input :id="fieldId('email-3')" v-model="usuarioForm.email" type="email" autocomplete="off" class="deasy-auth-field" placeholder="usuario@institucion.edu.ec" />
            </div>
            <div>
              <label :for="fieldId('first-name-3')" class="mb-1.5 block text-sm font-semibold text-slate-700">Nombres</label>
              <input :id="fieldId('first-name-3')" v-model="usuarioForm.first_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Usuario" />
            </div>
            <div>
              <label :for="fieldId('last-name-3')" class="mb-1.5 block text-sm font-semibold text-slate-700">Apellidos</label>
              <input :id="fieldId('last-name-3')" v-model="usuarioForm.last_name" type="text" autocomplete="off" class="deasy-auth-field" placeholder="Prueba" />
            </div>
            <div>
              <label :for="fieldId('password-3')" class="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
              <input :id="fieldId('password-3')" v-model="usuarioForm.password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Contraseña del usuario" />
            </div>
            <div>
              <label :for="fieldId('confirm-password-3')" class="mb-1.5 block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
              <input :id="fieldId('confirm-password-3')" v-model="usuarioForm.confirm_password" type="password" autocomplete="new-password" class="deasy-auth-field" placeholder="Repite la contraseña" />
            </div>
          </div>
        </div>
      </div>

      <!-- Paso 3: Catálogos genéricos -->
      <div v-show="step === 3" class="space-y-4">
        <p class="m-0 text-sm text-slate-500">
          Selecciona únicamente los registros que quieras crear. Podrás completar o editar estos catálogos después.
        </p>
        <fieldset
          v-for="group in selectableCatalogGroups"
          :key="group.key"
          class="rounded-lg border border-slate-200 p-4"
        >
          <legend class="sr-only">{{ group.label }}</legend>
          <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="m-0 text-sm font-semibold text-slate-700">{{ group.label }}</p>
              <p class="m-0 mt-0.5 text-xs text-slate-500">{{ group.hint }}</p>
            </div>
            <label class="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-sky-600"
                :checked="isCatalogGroupFullySelected(group)"
                @change="toggleCatalogGroup(group, $event.target.checked)"
              />
              {{ preconfig[group.key].length }}/{{ group.options.length }}
            </label>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="option in group.options"
              :key="option.id"
              class="flex min-h-11 items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors"
              :class="preconfig[group.key].includes(option.id) ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'"
            >
              <input
                v-model="preconfig[group.key]"
                type="checkbox"
                :value="option.id"
                class="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
              />
              <span class="min-w-0">
                <span class="block text-sm font-medium text-slate-700">{{ option.label }}</span>
                <span v-if="option.description" class="block text-xs text-slate-500">{{ option.description }}</span>
              </span>
            </label>
          </div>
        </fieldset>
        <div
          class="rounded-lg border p-3.5 transition-colors"
          :class="preconfig.relation_unit_types ? 'border-sky-300 bg-sky-50' : 'border-slate-200'"
        >
          <SToggle v-model="preconfig.relation_unit_types">
            <span>
              <span class="block text-sm font-semibold text-slate-700">Relación orgánica</span>
              <span class="block text-xs text-slate-500">Crea el tipo de relación jerárquica entre unidades.</span>
            </span>
          </SToggle>
        </div>
        <div
          class="rounded-lg border p-3.5 transition-colors"
          :class="preconfig.example_units ? 'border-sky-300 bg-sky-50' : 'border-slate-200'"
        >
          <SToggle v-model="preconfig.example_units">
            <span>
              <span class="block text-sm font-semibold text-slate-700">Estructura de unidades de ejemplo</span>
              <span class="block text-xs text-slate-500">Crea un organigrama de demostración (Prorrectorado, direcciones, escuela y carreras) con sus relaciones orgánicas. Incluye los tipos de unidad y la relación orgánica necesarios.</span>
            </span>
          </SToggle>
        </div>
        <div
          class="rounded-lg border p-3.5 transition-colors"
          :class="preconfig.example_positions ? 'border-sky-300 bg-sky-50' : 'border-slate-200'"
        >
          <SToggle v-model="preconfig.example_positions">
            <span>
              <span class="block text-sm font-semibold text-slate-700">Puestos de ejemplo</span>
              <span class="block text-xs text-slate-500">Crea los puestos del organigrama de demostración (jefaturas por unidad y docentes). Requiere e incluye la estructura de unidades de ejemplo.</span>
            </span>
          </SToggle>
        </div>
        <div
          class="rounded-lg border p-3.5 transition-colors"
          :class="preconfig.example_users ? 'border-sky-300 bg-sky-50' : 'border-slate-200'"
        >
          <SToggle v-model="preconfig.example_users">
            <span>
              <span class="block text-sm font-semibold text-slate-700">Usuarios de ejemplo</span>
              <span class="block text-xs text-slate-500">Crea un usuario (contraseña Demo1234!) por cada puesto del organigrama de ejemplo, lo asigna a su puesto y le da el rol de ejecución para recibir las tarjetas de trabajo. Requiere e incluye los puestos de ejemplo.</span>
            </span>
          </SToggle>
        </div>
      </div>

      <!-- Paso 4: Resumen -->
      <div v-show="step === 4" class="space-y-2.5 text-sm">
        <div class="rounded-xl border border-slate-200 p-4">
          <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Administrador</p>
          <p class="m-0 mt-1 font-semibold text-slate-700">{{ form.first_name }} {{ form.last_name }}</p>
          <p class="m-0 text-slate-500">{{ form.email }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Gestor por defecto</p>
          <p class="m-0 mt-1 text-slate-500">{{ gestorEnabled ? `${gestorForm.first_name} ${gestorForm.last_name} · ${gestorForm.email}` : 'No se creará' }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Usuario de prueba</p>
          <p class="m-0 mt-1 text-slate-500">{{ usuarioEnabled ? `${usuarioForm.first_name} ${usuarioForm.last_name} · ${usuarioForm.email}` : 'No se creará' }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Catálogos a preconfigurar</p>
          <ul v-if="selectedCatalogSummary.length" class="m-0 mt-2 space-y-2 p-0">
            <li v-for="item in selectedCatalogSummary" :key="item.key" class="list-none text-slate-500">
              <span class="font-semibold text-slate-700">{{ item.label }}:</span>
              {{ item.value }}
            </li>
          </ul>
          <p v-else class="m-0 mt-1 text-slate-500">Ninguno</p>
        </div>
      </div>

      <!-- Navegación -->
      <div class="flex items-center justify-between gap-3 pt-1">
        <button v-if="step > 1" type="button" class="deasy-auth-button deasy-auth-button--secondary w-auto px-5" @click="prevStep">Atrás</button>
        <span v-else></span>
        <button v-if="step < steps.length" type="button" class="deasy-auth-button w-auto px-6" :disabled="!canAdvance" @click="nextStep">
          Siguiente <IconArrowRight class="h-5 w-5" />
        </button>
        <button v-else type="button" class="deasy-auth-button w-auto px-6" :disabled="isSubmitting" @click="submitBootstrap">
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
    <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-600">
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

    <div v-if="mode === 'normal'" class="mt-8 flex justify-center">
      <button type="button" class="deasy-auth-button deasy-auth-button--secondary w-auto px-6" @click="router.replace({ name: 'login' })">
        Ir al login
      </button>
    </div>
  </AuthLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, useId } from "vue";
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import AuthLayout from '@/layouts/auth/AuthLayout.vue';
import { useRouter } from "vue-router";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import SystemBootstrapService from "@/modules/auth/services/SystemBootstrapService";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;
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
  { key: "gestor", label: "Cuentas demo" },
  { key: "catalogos", label: "Catálogos" },
  { key: "resumen", label: "Resumen" }
];

const blankPerson = () => ({
  cedula: "", first_name: "", last_name: "", email: "", whatsapp: "", password: "", confirm_password: ""
});

const EXAMPLE_ADMIN = {
  cedula: "1234567890", first_name: "Administrador", last_name: "Principal",
  email: "admin@institucion.edu.ec", whatsapp: "0990000000", password: "Demo1234!", confirm_password: "Demo1234!"
};
const EXAMPLE_GESTOR = {
  cedula: "0987654321", first_name: "Gestor", last_name: "Procesos",
  email: "gestor@institucion.edu.ec", whatsapp: "", password: "Gestor1234!", confirm_password: "Gestor1234!"
};
const EXAMPLE_USUARIO = {
  cedula: "1122334455", first_name: "Usuario", last_name: "Prueba",
  email: "usuario@institucion.edu.ec", whatsapp: "", password: "Demo1234!", confirm_password: "Demo1234!"
};

const form = reactive(blankPerson());
const useExampleAdmin = ref(false);
const toggleExampleAdmin = () => {
  if (useExampleAdmin.value) Object.assign(form, EXAMPLE_ADMIN);
  else Object.assign(form, blankPerson());
};

const gestorEnabled = ref(false);
const gestorForm = reactive(blankPerson());
const useExampleGestor = ref(false);
const toggleExampleGestor = () => {
  if (useExampleGestor.value) Object.assign(gestorForm, EXAMPLE_GESTOR);
  else Object.assign(gestorForm, blankPerson());
};

const usuarioEnabled = ref(false);
const usuarioForm = reactive(blankPerson());
const useExampleUsuario = ref(false);
const toggleExampleUsuario = () => {
  if (useExampleUsuario.value) Object.assign(usuarioForm, EXAMPLE_USUARIO);
  else Object.assign(usuarioForm, blankPerson());
};

const catalogGroupMeta = [
  { key: "unit_types", label: "Tipos de unidad", hint: "Estructuras organizacionales disponibles para crear unidades." },
  { key: "cargos", label: "Cargos", hint: "Cargos base y sus asociaciones de rol cuando correspondan." },
  { key: "term_types", label: "Tipos de periodo", hint: "Modalidades de periodos académicos u operativos." }
];
const catalogOptions = reactive({ unit_types: [], cargos: [], term_types: [] });
const preconfig = reactive({ unit_types: [], relation_unit_types: true, cargos: [], term_types: [], example_units: false, example_positions: false, example_users: false });
const catalogSelectionInitialized = ref(false);

const selectableCatalogGroups = computed(() =>
  catalogGroupMeta.map((group) => ({
    ...group,
    options: catalogOptions[group.key]
  }))
);

const isCatalogGroupFullySelected = (group) =>
  group.options.length > 0 && preconfig[group.key].length === group.options.length;

const toggleCatalogGroup = (group, selected) => {
  preconfig[group.key] = selected ? group.options.map((option) => option.id) : [];
};

const selectedCatalogSummary = computed(() => {
  const summary = selectableCatalogGroups.value
    .map((group) => {
      const selectedIds = new Set(preconfig[group.key]);
      const selectedLabels = group.options
        .filter((option) => selectedIds.has(option.id))
        .map((option) => option.label);
      if (!selectedLabels.length) return null;
      return {
        key: group.key,
        label: group.label,
        value: selectedLabels.join(", ")
      };
    })
    .filter(Boolean);

  if (preconfig.relation_unit_types) {
    summary.push({
      key: "relation_unit_types",
      label: "Relación de unidad",
      value: "Orgánica"
    });
  }
  if (preconfig.example_units) {
    summary.push({
      key: "example_units",
      label: "Unidades de ejemplo",
      value: "Organigrama de demostración"
    });
  }
  if (preconfig.example_positions) {
    summary.push({
      key: "example_positions",
      label: "Puestos de ejemplo",
      value: "Jefaturas y docentes del organigrama"
    });
  }
  if (preconfig.example_users) {
    summary.push({
      key: "example_users",
      label: "Usuarios de ejemplo",
      value: "Un usuario (Demo1234!) por puesto, con rol de ejecución"
    });
  }
  return summary;
});

const applyCatalogOptions = (options = {}) => {
  for (const group of catalogGroupMeta) {
    const entries = Array.isArray(options[group.key]) ? options[group.key] : [];
    catalogOptions[group.key] = entries
      .map((entry) => ({
        id: String(entry?.id || "").trim(),
        label: String(entry?.label || "").trim(),
        description: String(entry?.description || "").trim()
      }))
      .filter((entry) => entry.id && entry.label);
  }

  if (!catalogSelectionInitialized.value) {
    for (const group of catalogGroupMeta) {
      preconfig[group.key] = catalogOptions[group.key].map((option) => option.id);
    }
    catalogSelectionInitialized.value = true;
  }
};

const isPersonComplete = (p) =>
  Boolean(p.cedula && p.cedula.trim().length >= 10
    && p.first_name.trim() && p.last_name.trim() && p.email.trim()
    && p.password && p.password === p.confirm_password);

const canAdvance = computed(() => {
  if (step.value === 1) return isPersonComplete(form);
  if (step.value === 2) {
    return (!gestorEnabled.value || isPersonComplete(gestorForm))
      && (!usuarioEnabled.value || isPersonComplete(usuarioForm));
  }
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

const copyText = computed(() => {
  if (mode.value === "recovery_required") {
    return "La base contiene información operativa. La creación del admin debe hacerse por recuperación controlada.";
  }
  if (mode.value === "normal") {
    return "El sistema ya tiene un administrador activo. Esta pantalla ya no está disponible para bootstrap.";
  }
  return "Define la cuenta administradora, opcionalmente un gestor y un usuario de prueba, y los catálogos a preconfigurar.";
});

const loadStatus = async ({ force = false } = {}) => {
  try {
    const status = await SystemBootstrapService.getStatus({ force });
    mode.value = status.installationMode || "normal";
    environment.value = status.environment || "development";
    applyCatalogOptions(status.catalogOptions);
    if (mode.value === "normal") {
      message.value = "La instancia ya fue inicializada. Puedes continuar con el login normal.";
      isError.value = false;
    }
  } catch (error) {
    message.value = resolveApiErrorMessage(error, "No se pudo consultar el estado del sistema.");
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
      usuario: usuarioEnabled.value ? { ...usuarioForm } : null,
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
    message.value = resolveApiErrorMessage(error, "No se pudo inicializar el sistema.");
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
