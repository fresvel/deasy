<template>
  <AuthLayout size="2xl">
    <header class="mb-8 text-center">
      <AppLogo size="lg" :framed="true" class-name="mb-6" />
      <PasosDelRegistro paso="correo" />
      <h1 class="deasy-title deasy-title--page mt-6">Confirma tu correo</h1>
    </header>

    <AppAlert v-if="envioFallido" variant="warning" class="mb-6">
      No pudimos enviar el correo. Pulsa «Enviar otro código».
    </AppAlert>
    <AppAlert v-if="error" variant="danger" class="mb-6">{{ error }}</AppAlert>
    <AppAlert v-if="aviso" variant="success" class="mb-6">{{ aviso }}</AppAlert>

    <div class="mx-auto max-w-sm space-y-6">
      <!-- EL CORREO: SE VE SIEMPRE, SE EDITA SOLO SI SE PIDE.
           Se ve, porque quien se equivocó tiene que poder darse cuenta y saber que puede cambiarlo.
           No editable de entrada, porque el 95% de las veces está bien y un campo abierto invita a
           tocarlo sin querer --y tocarlo cuesta un correo nuevo y otra espera. -->
      <div>
        <span class="deasy-form-label">Tu correo</span>

        <div v-if="!editandoCorreo" class="flex items-center justify-between gap-3">
          <span class="min-w-0 truncate text-sm font-semibold text-strong">{{ correoGuardado }}</span>
          <AppButton variant="neutral-outline" @click="empezarACambiar">Cambiar</AppButton>
        </div>

        <div v-else class="flex gap-3">
          <input
            id="correo-registro"
            v-model="correo"
            type="email"
            class="deasy-control"
            autocomplete="email"
          />
          <AppButton variant="primary-outline" :disabled="guardando || !correoCambiado" @click="guardarCorreo">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </AppButton>
          <AppButton variant="danger-outline" @click="cancelarCambio">Cancelar</AppButton>
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
        <!-- ⚠️ «Salir» ES UNA ACCIÓN, no un enlace de navegación. `deasy-auth-link` existe y es del
             sistema, pero es para «¿Olvidaste tu contraseña?» y similares. Aquí convivía con dos
             botones haciendo algo comparable, y era lo único que no lo parecía. -->
        <AppButton variant="neutral-outline" @click="salir">Salir</AppButton>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
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
const editandoCorreo = ref(false);
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
  // ⚠️ Sólo avisa si el envío falló DE VERDAD, y eso hoy sólo lo sabe «Enviar otro código»: el del
  // alta va en camino sin bloquear la respuesta, así que llega como `null` y NO se avisa de nada.
  // Avisar de un fallo que quizá no ocurrió sería peor que callar.
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

const empezarACambiar = () => {
  correo.value = correoGuardado.value;
  editandoCorreo.value = true;
};

const cancelarCambio = () => {
  correo.value = correoGuardado.value;
  editandoCorreo.value = false;
  error.value = "";
};

const salir = () => router.push("/logout");

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
    editandoCorreo.value = false;
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
