<template>
  <AuthLayout size="md">
    <AppLogo size="lg" :framed="true" class-name="mb-8" />

    <PasosDelRegistro paso="telefono" />

    <div class="mb-8">
      <h1 class="deasy-title deasy-title--page">Confirma tu teléfono</h1>
      <p class="text-muted mt-2.5 font-medium text-sm">
        Escríbenos <strong class="text-strong">tú</strong> desde el número que registraste
        (<strong class="text-strong">+{{ numero }}</strong>). Así el propio mensaje demuestra que es
        tuyo, y no te cuesta nada.
      </p>
    </div>

    <p v-if="error" class="deasy-alert deasy-alert--danger mb-6">{{ error }}</p>

    <p v-if="!hayCanales && !cargando" class="deasy-alert deasy-alert--warning mb-6">
      Este servidor no tiene ningún canal de verificación configurado. Avisa a quien lo administre.
    </p>

    <!-- Un canal sin configurar NO aparece. No viaja como `null`: «no lo ofrecemos» y «falló» son
         cosas distintas, y la pantalla no tiene por qué distinguirlas. -->
    <div v-if="enlaces.telegram" class="deasy-card mb-4 p-5">
      <h2 class="deasy-title deasy-title--section mb-1">Telegram</h2>
      <p class="text-muted mb-4 text-sm">
        Abre el enlace y pulsa «Compartir mi número».
        <span class="block mt-1">
          ¿No ves el botón? Está plegado: toca el icono de cuadrícula (▦) a la derecha del campo
          donde se escribe.
        </span>
      </p>
      <a :href="enlaces.telegram" target="_blank" rel="noopener" class="deasy-btn deasy-btn--primary-outline">
        Abrir Telegram
      </a>
    </div>

    <div v-if="enlaces.whatsapp" class="deasy-card mb-4 p-5">
      <h2 class="deasy-title deasy-title--section mb-1">WhatsApp</h2>
      <p class="text-muted mb-4 text-sm">Se abrirá un mensaje ya escrito. Sólo tienes que enviarlo.</p>
      <a :href="enlaces.whatsapp" target="_blank" rel="noopener" class="deasy-btn deasy-btn--primary-outline">
        Abrir WhatsApp
      </a>
    </div>

    <div v-if="enlaces.sms" class="deasy-card mb-4 p-5">
      <h2 class="deasy-title deasy-title--section mb-1">SMS</h2>
      <p class="text-muted mb-2 text-sm">
        Manda este texto por mensaje al <strong class="text-strong">{{ enlaces.sms.numero }}</strong>:
      </p>
      <code class="block break-all rounded-md bg-surface border border-line px-3 py-2 font-mono text-xs text-strong">{{ enlaces.sms.texto }}</code>
      <!-- El coste lo paga quien envía, y hay que decirlo: desde fuera del país sale caro, y este
           sistema atiende a extranjeros a propósito. -->
      <p class="text-muted mt-2 text-xs">Lo cobra tu operadora. Desde fuera del país puede ser caro.</p>
    </div>

    <div class="mt-6 flex items-center justify-between">
      <AppButton variant="primary-outline" :disabled="comprobando" @click="comprobar">
        {{ comprobando ? 'Comprobando…' : 'Ya lo hice' }}
      </AppButton>
      <router-link to="/logout" class="deasy-auth-link">Salir</router-link>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import PasosDelRegistro from "@/modules/auth/components/PasosDelRegistro.vue";
import VerificacionService from "@/modules/auth/services/VerificacionService";
import AuthService from "@/modules/auth/services/AuthService";

const router = useRouter();
const enlaces = ref({});
const numero = ref("");
const error = ref("");
const cargando = ref(true);
const comprobando = ref(false);

const hayCanales = computed(() => Object.keys(enlaces.value).length > 0);

onMounted(async () => {
  const telefono = AuthService.getUser()?.telefonos?.[0];
  if (!telefono?.id) {
    error.value = "No encontramos tu teléfono. Vuelve a registrarlo desde tu perfil.";
    cargando.value = false;
    return;
  }
  try {
    // El backend devuelve los enlaces YA COMPUESTOS: esta pantalla no sabe armar un enlace de
    // Telegram ni acordarse de que el prefijo va sin el «+».
    const { data } = await VerificacionService.pedirVerificacionDeTelefono(telefono.id);
    const { expira_at, numero: internacional, ...canales } = data;
    enlaces.value = canales;
    numero.value = internacional;
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo preparar la verificación.";
  } finally {
    cargando.value = false;
  }
});

// Quien confirma es el canal, por detrás; aquí sólo se vuelve a preguntar. No se sondea en bucle:
// el usuario sabe cuándo lo ha hecho, y un sondeo constante gasta batería y peticiones para
// adivinar algo que él puede decir con un clic.
const comprobar = async () => {
  error.value = "";
  comprobando.value = true;
  try {
    const estado = await VerificacionService.estado();
    if (estado?.telefono) {
      router.push("/home");
      return;
    }
    error.value = "Todavía no nos ha llegado tu mensaje. Envíalo y vuelve a pulsar.";
  } catch {
    error.value = "No pudimos comprobarlo. Inténtalo de nuevo en unos segundos.";
  } finally {
    comprobando.value = false;
  }
};
</script>
