<template>
  <AuthLayout size="md">
    <AppLogo size="lg" :framed="true" class-name="mb-8" />

    <router-link to="/" class="inline-flex items-center text-sm font-semibold text-muted hover:text-info transition-colors mb-8 group">
      <IconArrowLeft class="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform" />
      Volver al login
    </router-link>

    <div class="mb-8">
      <div class="deasy-icon-box deasy-icon-box--xl deasy-icon-box--info mb-6">
        <IconMail class="h-7 w-7" />
      </div>
      <h1 class="deasy-title deasy-title--page">¿Cuál era tu correo?</h1>
      <p class="text-muted mt-2.5 font-medium text-sm">
        Identifícate con tu documento y tu contraseña y te decimos con qué correo estás registrado.
      </p>
    </div>

    <form v-if="!correoEncontrado" @submit.prevent="recuperar" class="space-y-6" autocomplete="off">
      <div>
        <label :for="fieldId('tipo')" class="deasy-form-label">Tipo de documento</label>
        <select :id="fieldId('tipo')" v-model="tipo" class="deasy-control">
          <option v-for="t in tiposDocumento" :key="t.code" :value="t.code">{{ t.name }}</option>
        </select>
      </div>

      <!-- El país sólo se pregunta cuando NO es el nacional: ése lo emite el país de la institución
           y preguntarlo invita a poner otro. Misma regla que en el registro y en /admin. -->
      <div v-if="tipo !== 'documento_nacional'">
        <label :for="fieldId('pais')" class="deasy-form-label">País emisor</label>
        <select :id="fieldId('pais')" v-model="pais" class="deasy-control" required>
          <option value="" disabled>Selecciona el país</option>
          <option v-for="p in paises" :key="p.iso_alpha2" :value="p.iso_alpha2">{{ p.name }}</option>
        </select>
      </div>

      <div>
        <label :for="fieldId('numero')" class="deasy-form-label">Número de documento</label>
        <input :id="fieldId('numero')" v-model="numero" type="text" class="deasy-control" required />
      </div>

      <div>
        <label :for="fieldId('password')" class="deasy-form-label">Tu contraseña</label>
        <input :id="fieldId('password')" v-model="password" type="password" autocomplete="current-password" class="deasy-control" required />
      </div>

      <AppButton type="submit" variant="primary-outline" class-name="deasy-btn--block" :disabled="isLoading">
        <IconLoader2 v-if="isLoading" class="h-4 w-4 animate-spin" />
        {{ isLoading ? 'Comprobando…' : 'Ver mi correo' }}
      </AppButton>
    </form>

    <AppAlert v-if="correoEncontrado" variant="success" class="flex text-sm font-medium">
      <IconCheck class="mr-3 mt-0.5 h-5 w-5 shrink-0" />
      <div class="flex-1">
        Tu cuenta usa <strong>{{ correoEncontrado }}</strong>.
        <router-link to="/" class="deasy-auth-link ml-1">Iniciar sesión</router-link>
      </div>
    </AppAlert>

    <AppAlert v-if="statusMessage" variant="danger" class="mt-6 flex text-sm font-medium">
      <IconAlertCircle class="mr-3 mt-0.5 h-5 w-5 shrink-0" />
      <div class="flex-1">{{ statusMessage }}</div>
    </AppAlert>

    <!-- LA SALIDA PARA QUIEN OLVIDÓ LAS DOS COSAS, y va escrita y no implícita: sin la contraseña
         no hay camino automático —el reset también empieza pidiendo el correo— y el destino es una
         persona. Cuando exista el flujo de solicitud con revisión (tarea I10), este párrafo lo
         sustituye un enlace. -->
    <p class="text-muted mt-8 text-sm">
      ¿Tampoco recuerdas tu contraseña? Entonces no podemos verificar tu identidad de forma
      automática: escribe a <strong>Talento Humano</strong> con tu documento para que la comprueben.
    </p>
  </AuthLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AuthLayout from '@/layouts/auth/AuthLayout.vue';
import AuthService from '@/modules/auth/services/AuthService';
import AppLogo from '@/shared/components/layout/AppLogo.vue';
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import { IconArrowLeft, IconMail, IconLoader2, IconAlertCircle, IconCheck } from '@tabler/icons-vue';

const uid = ref(`recover-email-${Math.random().toString(36).slice(2, 8)}`);
const fieldId = (name) => `${uid.value}-${name}`;

const institucion = ref(null);
const paises = ref([]);
const tipo = ref('documento_nacional');
const pais = ref('');
const numero = ref('');
const password = ref('');
const isLoading = ref(false);
const statusMessage = ref('');
const correoEncontrado = ref('');

// El nombre del documento nacional sale de la institución: en un despliegue peruano dice «DNI (Perú)»
// sin tocar código.
const tiposDocumento = computed(() => [
  { code: 'documento_nacional', name: institucion.value?.documento_nacional?.etiqueta ?? 'Documento nacional' },
  { code: 'pasaporte', name: 'Pasaporte' },
  { code: 'documento_extranjero', name: 'Documento de identidad extranjero' }
]);

onMounted(async () => {
  try {
    institucion.value = await AuthService.institucion();
  } catch {
    institucion.value = null;
  }
  try {
    paises.value = await AuthService.listarPaises();
  } catch {
    paises.value = [];
  }
});

const recuperar = async () => {
  isLoading.value = true;
  statusMessage.value = '';
  correoEncontrado.value = '';
  try {
    const { email } = await AuthService.recuperarCorreo({
      tipo: tipo.value,
      pais: tipo.value === 'documento_nacional' ? undefined : pais.value,
      numero: numero.value.trim(),
      password: password.value
    });
    correoEncontrado.value = email;
  } catch (error) {
    statusMessage.value = resolveApiErrorMessage(error, 'No pudimos verificar esos datos.');
  } finally {
    isLoading.value = false;
  }
};
</script>
