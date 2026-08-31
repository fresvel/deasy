<template>
  <!-- ⚠️ `4xl` Y NO `md`. Con `md` (448 px) el contenedor medía menos de un tercio de una pantalla de
       1440: el selector se desbordaba sobre el panel, «¿Cómo se hace?» partía en dos líneas y el QR
       --que es la salida de quien está en el ordenador-- quedaba del tamaño de un sello.
       Esta pantalla tiene DOS columnas; las de un solo formulario siguen en `md`. -->
  <AuthLayout size="4xl" align="start">
    <header class="mb-8 text-center">
      <AppLogo size="lg" :framed="true" class-name="mx-auto mb-6" />
      <PasosDelRegistro paso="telefono" />
      <h1 class="deasy-title deasy-title--page mt-6">Confirma tu teléfono</h1>
      <p class="text-muted mx-auto mt-2 max-w-xl text-sm font-medium">
        Nos escribes tú desde tu número, y con eso queda probado. Elige por dónde.
      </p>
    </header>

    <p v-if="error" class="deasy-alert deasy-alert--danger mb-6">{{ error }}</p>

    <p v-if="!hayCanales && !cargando" class="deasy-alert deasy-alert--warning mb-6">
      Este servidor no tiene ningún canal de verificación configurado. Avisa a quien lo administre.
    </p>

    <div v-if="hayCanales" class="grid gap-6 md:grid-cols-3 md:items-start">

      <!-- Es un GRUPO DE OPCIONES y no tres botones: elegir uno de tres es exactamente lo que un
           `radio` significa, y así funcionan las flechas del teclado y un lector de pantalla sabe
           que las tres van juntas. -->
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

        <!-- Esto NO es relleno para tapar el hueco: es lo único que una persona necesita saber para
             elegir, y el sitio donde lo necesita es aquí, junto a las tres opciones. Sin ello la
             pregunta «¿cuál elijo?» no tiene respuesta en la pantalla. -->
        <p class="mt-4 text-xs leading-relaxed text-muted">
          Los tres prueban lo mismo: que el número es tuyo. Elige el que tengas más a mano.
        </p>
      </fieldset>

      <div v-if="canalActivo" class="deasy-card p-6 md:col-span-2">
        <div class="mb-6 flex items-center justify-between gap-4">
          <h2 class="deasy-title deasy-title--section">Verificar por {{ canalActivo.nombre }}</h2>
          <AppButton variant="neutral-soft" @click="verManual = true">Instrucciones</AppButton>
        </div>

        <!-- LAS DOS VÍAS, EN DOS MITADES. No es redundancia: desde el MÓVIL no puedes escanear tu
             propia pantalla, y desde el ORDENADOR el enlace abre la aplicación donde NO está tu
             número.
             ⚠️ Y POR ESO EL ORDEN SE INVIERTE: en móvil manda el BOTÓN --el QR ahí no sirve para
             nada y estaba ocupando media pantalla--; en escritorio manda el QR, que es la única
             salida de quien no tiene Telegram en el ordenador. -->
        <div v-if="canalActivo.id !== 'sms'" class="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-line">
          <div class="order-2 text-center sm:order-1">
            <p class="mb-3 text-sm font-semibold text-strong">Desde otro teléfono</p>
            <img
              :src="canalActivo.qr"
              :alt="`Código QR para verificar por ${canalActivo.nombre}`"
              class="mx-auto w-full max-w-64 rounded-md border border-line bg-white p-3"
            />
            <p class="mt-3 text-xs text-muted">Escanéalo con la cámara.</p>
          </div>

          <div class="order-1 flex flex-col items-center justify-center gap-3 text-center sm:order-2 sm:pl-6">
            <p class="text-sm font-semibold text-strong">Desde este mismo dispositivo</p>
            <a
              :href="canalActivo.enlace"
              target="_blank"
              rel="noopener"
              class="deasy-btn deasy-btn--primary-outline"
            >
              Abrir {{ canalActivo.nombre }}
            </a>
            <p class="text-xs text-muted">Se abrirá la conversación con nuestro bot.</p>
          </div>
        </div>

        <div v-else class="text-center">
          <p class="mb-3 text-sm text-muted">
            Envía un mensaje de texto al
            <strong class="text-strong">{{ canalActivo.numero }}</strong> con este contenido:
          </p>
          <code class="mx-auto block max-w-md break-all rounded-md border border-line bg-surface px-4 py-3 font-mono text-sm text-strong">{{ canalActivo.texto }}</code>
          <p class="mt-3 text-xs text-muted">Lo cobra tu operadora. Telegram y WhatsApp son gratis.</p>
        </div>
      </div>
    </div>

    <div class="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
      <AppButton variant="primary-outline" :disabled="comprobando" @click="comprobar">
        {{ comprobando ? 'Comprobando…' : 'Ya lo hice' }}
      </AppButton>
      <router-link to="/logout" class="deasy-auth-link">Salir</router-link>
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
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import PasosDelRegistro from "@/modules/auth/components/PasosDelRegistro.vue";
import ManualDeCanal from "@/modules/auth/components/ManualDeCanal.vue";
import VerificacionService from "@/modules/auth/services/VerificacionService";
import AuthService from "@/modules/auth/services/AuthService";
import { IconBrandTelegram, IconBrandWhatsapp, IconDeviceMobile } from "@tabler/icons-vue";

const router = useRouter();
const canales = ref({});
const numero = ref("");
const elegido = ref(null);
const error = ref("");
const cargando = ref(true);
const comprobando = ref(false);
const verManual = ref(false);

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

onMounted(async () => {
  const telefono = AuthService.getUser()?.telefonos?.[0];
  if (!telefono?.id) {
    error.value = "No encontramos tu teléfono. Vuelve a registrarlo desde tu perfil.";
    cargando.value = false;
    return;
  }
  try {
    // El backend devuelve los enlaces Y los códigos QR ya compuestos: esta pantalla no sabe armar un
    // enlace de Telegram ni dibujar un QR, y no tiene por qué.
    const { data } = await VerificacionService.pedirVerificacionDeTelefono(telefono.id);
    canales.value = data.canales ?? {};
    numero.value = data.numero;
    // Se preselecciona el primero disponible en orden de recomendación, para que la pantalla no
    // aparezca vacía esperando un clic.
    elegido.value = disponibles.value[0]?.id ?? null;
  } catch (fallo) {
    error.value = fallo?.response?.data?.message ?? "No se pudo preparar la verificación.";
  } finally {
    cargando.value = false;
  }
});

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
