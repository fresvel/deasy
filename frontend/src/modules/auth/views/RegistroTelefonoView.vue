<template>
  <AuthLayout size="4xl" align="start">
    <header class="mb-8 text-center">
      <AppLogo size="lg" :framed="true" class-name="mb-6" />
      <PasosDelRegistro paso="telefono" />
      <h1 class="deasy-title deasy-title--page mt-6">Confirma tu teléfono</h1>
    </header>

    <AppAlert v-if="error" variant="danger" class="mb-6">{{ error }}</AppAlert>
    <AppAlert v-if="!hayCanales && !cargando" variant="warning" class="mb-6">
      Este servidor no tiene ningún canal de verificación configurado. Avisa a quien lo administre.
    </AppAlert>

    <div v-if="hayCanales" class="grid gap-6 md:grid-cols-3 md:items-start">

      <fieldset class="md:col-span-1">
        <legend class="deasy-form-label">¿Por dónde?</legend>
        <div class="grid gap-3">
          <label
            v-for="canal in disponibles"
            :key="canal.id"
            class="deasy-card deasy-card--elegible flex items-center gap-3 p-4"
            :class="{ 'deasy-card--elegida': canal.id === elegido }"
          >
            <input v-model="elegido" type="radio" name="canal" :value="canal.id" class="sr-only" />
            <span class="deasy-icon-box deasy-icon-box--md shrink-0" :class="canal.tono">
              <component :is="canal.icono" class="h-5 w-5" />
            </span>
            <span class="min-w-0 flex-1 text-left">
              <span class="block text-sm font-semibold text-strong">{{ canal.nombre }}</span>
              <span class="block text-xs leading-snug text-muted">{{ canal.nota }}</span>
            </span>
          </label>
        </div>

        <!-- El número, como el correo en su pantalla: se ve, y se edita sólo si se pide. -->
        <div class="mt-6">
          <span class="deasy-form-label">Tu número</span>

          <div v-if="!editandoNumero" class="flex items-center justify-between gap-3">
            <span class="min-w-0 truncate text-sm font-semibold text-strong">{{ numeroLocalGuardado }}</span>
            <AppButton variant="neutral-outline" @click="empezarACambiar">Cambiar</AppButton>
          </div>

          <div v-else class="space-y-3">
            <input
              id="telefono-registro"
              v-model="numeroLocal"
              type="tel"
              inputmode="tel"
              class="deasy-control"
              autocomplete="tel"
            />
            <div class="flex gap-3">
              <AppButton variant="primary-outline" :disabled="guardando || !numeroCambiado" @click="guardarTelefono">
                {{ guardando ? 'Guardando…' : 'Guardar' }}
              </AppButton>
              <AppButton variant="danger-outline" @click="cancelarCambio">Cancelar</AppButton>
            </div>
          </div>
        </div>
      </fieldset>

      <div v-if="canalActivo" class="deasy-card p-6 md:col-span-2">
        <div class="mb-6 flex items-center justify-between gap-4">
          <h2 class="deasy-title deasy-title--section">{{ canalActivo.nombre }}</h2>
          <AppButton variant="neutral-soft" @click="verManual = true">Instrucciones</AppButton>
        </div>

        <AppAlert v-if="caducado" variant="warning" class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span>Este código caducó.</span>
          <AppButton variant="warning-outline" :disabled="renovando" @click="renovar">
            {{ renovando ? 'Generando…' : 'Generar otro' }}
          </AppButton>
        </AppAlert>

        <!-- ⚠️ LAS DOS VÍAS, SIN EXPLICARLAS. La rotulación es la explicación: quien está en el
             ordenador lee «Desde otro teléfono» sobre un QR y ya sabe qué hacer; quien está en el
             móvil ve un botón. Lo que había debajo de cada una --«Escanéalo con la cámara», «Se
             abrirá la conversación con nuestro bot»-- decía lo que la imagen ya dice.
             El resto está en «Instrucciones», para quien lo quiera. -->
        <div v-if="canalActivo.id !== 'sms'" class="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-line"
             :class="{ 'pointer-events-none opacity-40': caducado }">
          <div class="order-2 text-center sm:order-1">
            <p class="mb-3 text-sm font-semibold text-strong">Desde otro teléfono</p>
            <img
              :src="canalActivo.qr"
              :alt="`Código QR para verificar por ${canalActivo.nombre}`"
              class="mx-auto w-full max-w-64 rounded-md border border-line bg-white p-3"
            />
          </div>

          <div class="order-1 flex flex-col items-center justify-center gap-3 text-center sm:order-2 sm:pl-6">
            <p class="text-sm font-semibold text-strong">Desde este mismo dispositivo</p>
            <a
              :href="canalActivo.enlace"
              target="_blank"
              rel="noopener"
              class="deasy-btn deasy-btn--md deasy-btn--primary-outline"
            >
              Abrir {{ canalActivo.nombre }}
            </a>
          </div>
        </div>

        <div v-else class="text-center" :class="{ 'pointer-events-none opacity-40': caducado }">
          <p class="mb-3 text-sm text-muted">
            Manda este texto al <strong class="text-strong">{{ canalActivo.numero }}</strong>:
          </p>
          <code class="mx-auto block max-w-md break-all rounded-md border border-line bg-surface px-4 py-3 font-mono text-sm text-strong">{{ canalActivo.texto }}</code>
        </div>

        <p v-if="!caducado && minutosRestantes" class="mt-6 text-center text-xs text-muted">
          Caduca en {{ minutosRestantes }}.
        </p>
      </div>
    </div>

    <div class="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
      <AppButton variant="primary-outline" :disabled="comprobando" @click="comprobar">
        {{ comprobando ? 'Comprobando…' : 'Ya lo hice' }}
      </AppButton>
      <AppButton variant="neutral-outline" @click="salir">Salir</AppButton>
    </div>

    <ManualDeCanal
      v-if="canalActivo"
      :open="verManual"
      :canal="canalActivo"
      :numero="numero"
      @close="verManual = false"
    />
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
import ManualDeCanal from "@/modules/auth/components/ManualDeCanal.vue";
import VerificacionService from "@/modules/auth/services/VerificacionService";
import AuthService from "@/modules/auth/services/AuthService";
import realtimeClient from "@/core/services/realtimeClient";
import { IconBrandTelegram, IconBrandWhatsapp, IconDeviceMobile } from "@tabler/icons-vue";

const router = useRouter();
const canales = ref({});
const numero = ref("");
const elegido = ref(null);
const error = ref("");
const cargando = ref(true);
const comprobando = ref(false);
const verManual = ref(false);
const renovando = ref(false);
const guardando = ref(false);
const editandoNumero = ref(false);
/** Lo que se ve y se edita: la parte LOCAL, que es como la gente escribe su número. */
const numeroLocal = ref("");
const numeroLocalGuardado = ref("");
const numeroCambiado = computed(() => {
  const escrito = numeroLocal.value.replace(/\D/g, "");
  return escrito.length > 0 && escrito !== numeroLocalGuardado.value;
});
const expiraEn = ref(null);
const ahora = ref(Date.now());
let reloj = null;
let telefonoId = null;

// El ORDEN es la recomendación, y está razonada: Telegram no cuesta nada y prueba el número con un
// botón; WhatsApp igual pero depende de una sesión que hay que mantener; el SMS es el único que
// funciona sin aplicación y sin datos, y el único que puede costar dinero.
const CATALOGO = [
  { id: "telegram", nombre: "Telegram", nota: "Recomendado · gratis", icono: IconBrandTelegram, tono: "deasy-icon-box--info" },
  { id: "whatsapp", nombre: "WhatsApp", nota: "Gratis con datos", icono: IconBrandWhatsapp, tono: "deasy-icon-box--success" },
  { id: "sms", nombre: "SMS", nota: "Sin datos · lo cobra tu operadora", icono: IconDeviceMobile, tono: "deasy-icon-box--neutral" },
];

const disponibles = computed(() =>
  CATALOGO.filter((c) => canales.value[c.id]).map((c) => ({ ...c, ...canales.value[c.id] }))
);
const hayCanales = computed(() => disponibles.value.length > 0);
const canalActivo = computed(() => disponibles.value.find((c) => c.id === elegido.value) ?? null);

// Cuánto le queda al código, y si ya se pasó. Se recalcula sobre `ahora`, que avanza cada segundo:
// así el aviso aparece SOLO, sin que nadie tenga que recargar para enterarse.
const caducado = computed(() => expiraEn.value !== null && ahora.value >= expiraEn.value);
const minutosRestantes = computed(() => {
  if (expiraEn.value === null || caducado.value) return null;
  const segundos = Math.ceil((expiraEn.value - ahora.value) / 1000);
  const m = Math.floor(segundos / 60);
  return m >= 1 ? `${m} min` : `${segundos} s`;
});

/** Pide una llave nueva y repinta enlaces y QR. Es lo mismo al entrar y al renovar. */
const pedirLlave = async () => {
  const { data } = await VerificacionService.pedirVerificacionDeTelefono(telefonoId);
  // El backend devuelve los enlaces Y los códigos QR ya compuestos: esta pantalla no sabe armar un
  // enlace de Telegram ni dibujar un QR, y no tiene por qué.
  canales.value = data.canales ?? {};
  numero.value = data.numero;
  expiraEn.value = data.expira_at ? new Date(data.expira_at).getTime() : null;
  ahora.value = Date.now();
  if (!elegido.value || !canales.value[elegido.value]) {
    // Se preselecciona el primero disponible en orden de recomendación, para que la pantalla no
    // aparezca vacía esperando un clic. Al RENOVAR se respeta lo que ya había elegido.
    elegido.value = disponibles.value[0]?.id ?? null;
  }
};

const empezarACambiar = () => {
  numeroLocal.value = numeroLocalGuardado.value;
  editandoNumero.value = true;
};

const cancelarCambio = () => {
  numeroLocal.value = numeroLocalGuardado.value;
  editandoNumero.value = false;
  error.value = "";
};

const salir = () => router.push("/logout");

const guardarTelefono = async () => {
  error.value = "";
  guardando.value = true;
  try {
    // El país se conserva: se está corrigiendo el número, no mudándose de país. Si algún día hay que
    // cambiarlo, es un campo más, no un cambio de este flujo.
    const pais = AuthService.getUser()?.telefonos?.[0]?.pais_id ?? null;
    const { data } = await VerificacionService.cambiarTelefono({
      numero: numeroLocal.value.replace(/\D/g, ""),
      pais_id: pais,
    });
    telefonoId = data.telefonoId ?? telefonoId;
    numeroLocalGuardado.value = numeroLocal.value.replace(/\D/g, "");
    editandoNumero.value = false;
    // Llave nueva de inmediato: la anterior se emitió contra el número viejo y el backend ya la tiró.
    await pedirLlave();
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo cambiar el número.";
  } finally {
    guardando.value = false;
  }
};

const renovar = async () => {
  error.value = "";
  renovando.value = true;
  try {
    await pedirLlave();
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo generar otro código.";
  } finally {
    renovando.value = false;
  }
};

onMounted(async () => {
  const telefono = AuthService.getUser()?.telefonos?.[0];
  if (!telefono?.id) {
    error.value = "No encontramos tu teléfono. Vuelve a registrarlo desde tu perfil.";
    cargando.value = false;
    return;
  }
  telefonoId = telefono.id;
  numeroLocal.value = telefono.numero ?? "";
  numeroLocalGuardado.value = (telefono.numero ?? "").replace(/\D/g, "");

  try {
    await pedirLlave();
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo preparar la verificación.";
  } finally {
    cargando.value = false;
  }

  reloj = setInterval(() => { ahora.value = Date.now(); }, 1000);

  // ⚠️ EL SERVIDOR AVISA, Y ES LO QUE CONVIERTE ESTA PANTALLA EN ALGO USABLE. Quien acaba de
  // escribirle al bot desde el móvil no tiene por qué volver al ordenador a pulsar un botón para
  // enterarse de algo que el servidor YA SABE.
  //
  // «Ya lo hice» se queda como RESPALDO: si el socket no conecta --red rara, pestaña dormida-- o si
  // la verificación llegó por otro camino, sigue habiendo forma de continuar. Un aviso que no llega
  // no puede dejar a nadie encallado.
  realtimeClient.connect();
  realtimeClient.on("telefono:verificado", alVerificar);
});

onUnmounted(() => {
  clearInterval(reloj);
  realtimeClient.off("telefono:verificado", alVerificar);
});

const alVerificar = () => {
  router.push("/home");
};

// Quien confirma es el canal, por detrás; aquí sólo se vuelve a preguntar. No se sondea en bucle: la
// persona sabe cuándo lo ha hecho, y un sondeo constante gasta batería y peticiones para adivinar
// algo que ella puede decir con un clic.
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
