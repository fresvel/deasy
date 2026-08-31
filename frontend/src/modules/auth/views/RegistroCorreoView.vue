<template>
  <AuthLayout size="md">
    <AppLogo size="lg" :framed="true" class-name="mb-8" />

    <PasosDelRegistro paso="correo" />

    <div class="mb-8">
      <h1 class="deasy-title deasy-title--page">Confirma tu correo</h1>
      <p class="text-muted mt-2.5 font-medium text-sm">
        Te hemos enviado un código de 6 cifras a
        <strong class="text-strong">{{ correo || 'tu correo' }}</strong>. Escríbelo aquí para
        continuar.
      </p>
    </div>

    <!-- Si el envío falló, se dice. Antes esto se tragaba en silencio y la persona esperaba un
         correo que nunca salió, sin nada que la sacara de ahí. -->
    <p v-if="envioFallido" class="deasy-alert deasy-alert--warning mb-6">
      No pudimos enviar el correo. Pulsa «Enviar otro código» para intentarlo de nuevo.
    </p>

    <form class="space-y-6" @submit.prevent="comprobar">
      <div>
        <label for="codigo-correo" class="deasy-form-label">Código de verificación</label>
        <input
          id="codigo-correo"
          v-model="codigo"
          class="deasy-control text-center tracking-widest"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="000000"
        />
      </div>

      <p v-if="error" class="deasy-alert deasy-alert--danger">{{ error }}</p>

      <AppButton type="submit" variant="primary-outline" :disabled="codigo.length !== 6 || comprobando">
        {{ comprobando ? 'Comprobando…' : 'Confirmar correo' }}
      </AppButton>
    </form>

    <div class="mt-6 flex items-center justify-between">
      <AppButton variant="neutral-outline" :disabled="reenviando || esperaRestante > 0" @click="reenviar">
        {{ esperaRestante > 0 ? `Enviar otro código (${esperaRestante}s)` : 'Enviar otro código' }}
      </AppButton>
      <router-link to="/logout" class="deasy-auth-link">Salir</router-link>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import PasosDelRegistro from "@/modules/auth/components/PasosDelRegistro.vue";
import VerificacionService from "@/modules/auth/services/VerificacionService";
import AuthService from "@/modules/auth/services/AuthService";

const router = useRouter();
const codigo = ref("");
const error = ref("");
const comprobando = ref(false);
const reenviando = ref(false);
const envioFallido = ref(false);
const esperaRestante = ref(0);
const correo = ref("");
let cuentaAtras = null;

onMounted(() => {
  correo.value = AuthService.getUser()?.email ?? "";
  // El registro dice si el correo llegó a salir. Sin esto, quien no lo recibió no sabría si es
  // cuestión de esperar o de pedir otro.
  envioFallido.value = sessionStorage.getItem("registro:correoEnviado") === "false";
});

onUnmounted(() => clearInterval(cuentaAtras));

const arrancarEspera = (segundos) => {
  esperaRestante.value = segundos;
  clearInterval(cuentaAtras);
  cuentaAtras = setInterval(() => {
    esperaRestante.value -= 1;
    if (esperaRestante.value <= 0) clearInterval(cuentaAtras);
  }, 1000);
};

const comprobar = async () => {
  error.value = "";
  comprobando.value = true;
  try {
    await VerificacionService.verificarCorreo(codigo.value.trim());
    // El siguiente paso lo decide el guardián leyendo el estado del servidor, no esta pantalla.
    router.push("/registro/telefono");
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo comprobar el código.";
  } finally {
    comprobando.value = false;
  }
};

const reenviar = async () => {
  error.value = "";
  reenviando.value = true;
  try {
    await VerificacionService.reenviarCodigo();
    envioFallido.value = false;
    sessionStorage.removeItem("registro:correoEnviado");
    arrancarEspera(60);
  } catch (fallo) {
    // El 429 trae los segundos que faltan: se respetan en vez de inventarse otro número.
    const segundos = fallo?.response?.data?.reintentarEn;
    if (segundos) arrancarEspera(segundos);
    error.value = fallo?.response?.data?.message ?? "No se pudo enviar el código.";
  } finally {
    reenviando.value = false;
  }
};
</script>
