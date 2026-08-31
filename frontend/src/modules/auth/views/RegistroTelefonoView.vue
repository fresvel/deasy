<template>
  <AuthLayout size="md">
    <AppLogo size="lg" :framed="true" class-name="mb-8 mx-auto" />

    <PasosDelRegistro paso="telefono" />

    <div class="mb-6">
      <h1 class="deasy-title deasy-title--page">Confirma tu teléfono</h1>
      <p class="text-muted mt-2.5 text-sm font-medium">
        Elige por dónde quieres hacerlo. Los tres valen igual y ninguno te cuesta dinero, salvo el
        SMS.
      </p>
    </div>

    <p v-if="error" class="deasy-alert deasy-alert--danger mb-6">{{ error }}</p>

    <p v-if="!hayCanales && !cargando" class="deasy-alert deasy-alert--warning mb-6">
      Este servidor no tiene ningún canal de verificación configurado. Avisa a quien lo administre.
    </p>

    <!-- EL SELECTOR. Es un GRUPO DE OPCIONES y no tres botones, y esa no es una distinción
         cosmética: elegir uno de tres es exactamente lo que un `radio` significa. Con botones había
         que anunciar el estado a mano (`aria-pressed`), las flechas del teclado no funcionaban, y un
         lector de pantalla no sabía que las tres van juntas. -->
    <fieldset v-if="hayCanales" class="mb-6">
      <legend class="deasy-form-label">¿Por dónde quieres verificarlo?</legend>
      <div class="grid gap-3 sm:grid-cols-3">
        <label
          v-for="canal in disponibles"
          :key="canal.id"
          class="deasy-card deasy-card--elegible flex flex-col items-center gap-2 p-4 text-center"
          :class="{ 'deasy-card--elegida': canal.id === elegido }"
        >
          <input v-model="elegido" type="radio" name="canal" :value="canal.id" class="sr-only" />
          <span class="deasy-icon-box deasy-icon-box--md" :class="canal.tono">
            <component :is="canal.icono" class="h-5 w-5" />
          </span>
          <span class="text-sm font-semibold text-strong">{{ canal.nombre }}</span>
          <span class="text-xs text-muted">{{ canal.nota }}</span>
        </label>
      </div>
    </fieldset>

    <div v-if="canalActivo" class="deasy-card p-5">
      <div class="mb-4 flex items-start justify-between gap-4">
        <h2 class="deasy-title deasy-title--section">{{ canalActivo.nombre }}</h2>
        <AppButton variant="neutral-soft" @click="verManual = true">
          ¿Cómo se hace?
        </AppButton>
      </div>

      <!-- Las dos vías, y no es redundancia: desde el MÓVIL no puedes escanear tu propia pantalla,
           y desde el ORDENADOR el enlace abre la aplicación donde NO está tu número. -->
      <template v-if="canalActivo.id !== 'sms'">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <img
            v-if="canalActivo.qr"
            :src="canalActivo.qr"
            :alt="`Código QR para verificar por ${canalActivo.nombre}`"
            class="h-40 w-40 shrink-0 rounded-md border border-line bg-white p-1"
          />
          <div class="text-sm text-muted">
            <p class="mb-3">
              <strong class="text-strong">Desde este mismo dispositivo:</strong> pulsa el botón.
            </p>
            <p class="mb-4">
              <strong class="text-strong">Desde otro teléfono:</strong> escanea el código con la
              cámara.
            </p>
            <a
              :href="canalActivo.enlace"
              target="_blank"
              rel="noopener"
              class="deasy-btn deasy-btn--primary-outline"
            >
              Abrir {{ canalActivo.nombre }}
            </a>
          </div>
        </div>
      </template>

      <template v-else>
        <p class="mb-2 text-sm text-muted">
          Envía un mensaje de texto con este contenido al
          <strong class="text-strong">{{ canalActivo.numero }}</strong>:
        </p>
        <code class="block break-all rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs text-strong">{{ canalActivo.texto }}</code>
      </template>
    </div>

    <div class="mt-6 flex items-center justify-between gap-3">
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
