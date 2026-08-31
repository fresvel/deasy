<template>
  <AuthLayout size="2xl">
    <header class="mb-8 text-center">
      <AppLogo size="lg" :framed="true" class-name="mb-6" />
      <PasosDelRegistro paso="correo" />
      <h1 class="deasy-title deasy-title--page mt-6">Confirma tu correo</h1>
    </header>

    <p v-if="envioFallido" class="deasy-alert deasy-alert--warning mb-6">
      No pudimos enviar el correo. Pulsa «Enviar otro código».
    </p>
    <p v-if="error" class="deasy-alert deasy-alert--danger mb-6">{{ error }}</p>
    <p v-if="aviso" class="deasy-alert deasy-alert--success mb-6">{{ aviso }}</p>

    <div class="mx-auto max-w-sm space-y-6">
      <!-- ⚠️ EL CORREO, SIEMPRE VISIBLE Y EDITABLE. Antes había que descubrir un enlace que decía
           «¿te equivocaste?» para poder cambiarlo. Quien se equivocó no va buscando una confesión:
           va buscando el campo. Y el botón sólo aparece cuando de verdad hay algo que guardar. -->
      <div>
        <label for="correo-registro" class="deasy-form-label">Tu correo</label>
        <div class="flex gap-3">
          <input
            id="correo-registro"
            ref="campoCorreo"
            v-model="correo"
            type="email"
            class="deasy-control"
            autocomplete="email"
          />
          <AppButton v-if="correoCambiado" variant="primary-outline" :disabled="guardando" @click="guardarCorreo">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </AppButton>
        </div>
      </div>

      <form @submit.prevent="comprobar">
        <label for="codigo-correo" class="deasy-form-label">Código de 6 cifras</label>
        <div class="flex gap-3">
          <input
            id="codigo-correo"
            ref="campoCodigo"
            class="deasy-control text-center tracking-widest"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
          />
          <AppButton type="submit" variant="primary-outline" :disabled="comprobando">
            {{ comprobando ? 'Comprobando…' : 'Confirmar' }}
          </AppButton>
        </div>
      </form>

      <div class="flex items-center justify-between gap-3 border-t border-line pt-6">
        <AppButton variant="neutral-outline" :disabled="reenviando || esperaRestante > 0" @click="reenviar">
          {{ esperaRestante > 0 ? `Enviar otro código (${esperaRestante}s)` : 'Enviar otro código' }}
        </AppButton>
        <router-link to="/logout" class="deasy-auth-link">Salir</router-link>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import PasosDelRegistro from "@/modules/auth/components/PasosDelRegistro.vue";
import VerificacionService from "@/modules/auth/services/VerificacionService";
import AuthService from "@/modules/auth/services/AuthService";

const router = useRouter();
const correo = ref("");
const correoGuardado = ref("");
const campoCodigo = ref(null);
const error = ref("");
const aviso = ref("");
const comprobando = ref(false);
const reenviando = ref(false);
const guardando = ref(false);
const envioFallido = ref(false);
const esperaRestante = ref(0);
let cuentaAtras = null;

const correoCambiado = computed(() => {
  const escrito = correo.value.trim().toLowerCase();
  return escrito.length > 0 && escrito !== correoGuardado.value;
});

onMounted(() => {
  correoGuardado.value = (AuthService.getUser()?.email ?? "").toLowerCase();
  correo.value = correoGuardado.value;
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

/**
 * El código se lee DEL CAMPO, no de una variable reactiva.
 *
 * ⚠️ **Y EL BOTÓN YA NO SE DESHABILITA.** Reportado dos veces por el dueño: con los seis números
 * puestos, «Confirmar» seguía deshabilitado hasta recargar. En Chrome no se reproduce ni escribiendo
 * de verdad, así que el disparador está en su navegador —lo más probable, un valor que Firefox
 * restaura o autocompleta SIN disparar el evento `input`, con lo que el campo enseña seis cifras y
 * la variable sigue vacía.
 *
 * Perseguir ese disparador es perseguir un navegador. La causa de fondo es otra y es nuestra: **el
 * único camino para saber qué hay escrito no puede ser un evento**. Ahora se lee el campo al pulsar,
 * que es cuando importa, y si no vale se dice por qué.
 *
 * Un botón deshabilitado sin explicación es además la peor forma de decir «te falta algo»: no dice
 * qué falta, y quien no lo adivina se queda mirando.
 */
const comprobar = async () => {
  error.value = "";
  aviso.value = "";
  const codigo = String(campoCodigo.value?.value ?? "").replace(/\D/g, "");

  if (codigo.length !== 6) {
    error.value = "El código son 6 cifras. Cópialo del correo que te enviamos.";
    return;
  }

  comprobando.value = true;
  try {
    await VerificacionService.verificarCorreo(codigo);
    router.push("/registro/telefono");
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo comprobar el código.";
  } finally {
    comprobando.value = false;
  }
};

const guardarCorreo = async () => {
  error.value = "";
  aviso.value = "";
  guardando.value = true;
  try {
    const { data } = await VerificacionService.cambiarCorreo(correo.value.trim());
    correoGuardado.value = data.direccion;
    correo.value = data.direccion;
    // La copia de la sesión también, o al recargar volvería el correo viejo.
    const usuario = AuthService.getUser();
    if (usuario) AuthService.setUser({ ...usuario, email: data.direccion });
    if (campoCodigo.value) campoCodigo.value.value = "";
    envioFallido.value = false;
    aviso.value = `Te hemos enviado un código nuevo a ${data.direccion}.`;
    arrancarEspera(60);
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo cambiar el correo.";
  } finally {
    guardando.value = false;
  }
};

const reenviar = async () => {
  error.value = "";
  aviso.value = "";
  reenviando.value = true;
  try {
    await VerificacionService.reenviarCodigo();
    envioFallido.value = false;
    aviso.value = "Código enviado. Revisa también la carpeta de spam.";
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
