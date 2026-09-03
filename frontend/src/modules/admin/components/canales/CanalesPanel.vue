<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <AppButton variant="primary-soft" size="md" class="mb-3" @click="$emit('volver')">Volver</AppButton>
        <h2 class="deasy-title deasy-title--page">Canales de mensajería</h2>
        <p class="text-sm text-muted">
          Por dónde puede una persona demostrar que un número de teléfono es suyo.
        </p>
      </div>
      <p v-if="servicio.comprobadoEn" class="text-xs text-muted">
        Comprobado {{ desdeHace(servicio.comprobadoEn, ahora) }}
      </p>
    </div>

    <!-- ⚠️ QUE EL SERVICIO NO CONTESTE ES UNA RESPUESTA, no un error de esta pantalla. Es lo que se
         quería saber el día que estuvo trece horas muerto, y por eso se pinta como un estado. -->
    <AppAlert v-if="!servicio.alcanzable && !cargandoPrimeraVez" variant="danger">
      <strong>No se puede hablar con el servicio de canales.</strong>
      Nadie puede verificar su teléfono ahora mismo.
      <span v-if="servicio.error" class="block text-xs opacity-80">{{ servicio.error }}</span>
    </AppAlert>

    <Loading v-if="cargandoPrimeraVez" />

    <div v-else-if="canales.length" class="grid gap-4 md:grid-cols-2">
      <article v-for="canal in canales" :key="canal.nombre" class="deasy-card p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold capitalize text-strong">{{ canal.nombre }}</h3>
            <p v-if="canal.cuenta" class="font-mono text-xs text-muted">{{ canal.cuenta }}</p>
          </div>
          <AppTag :variant="tonoDe(canal)">{{ etiquetaDe(canal) }}</AppTag>
        </div>

        <p class="mt-3 text-sm text-body">{{ explicacionDe(canal) }}</p>

        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div v-if="canal.desde">
            <dt class="text-muted">Desde</dt>
            <dd class="text-body">{{ desdeHace(canal.desde, ahora) }}</dd>
          </div>
          <div>
            <!-- El nivel 4: DATO y no semáforo. Vale mucho en un canal con tráfico diario y es ruido
                 en uno que pasa días quieto, así que informa y no decide ningún color. -->
            <dt class="text-muted">Último mensaje</dt>
            <dd class="text-body">{{ desdeHace(canal.ultimoMensajeEn, ahora) ?? "sin registro" }}</dd>
          </div>
          <div v-if="canal.estadoPlataforma">
            <dt class="text-muted">Plataforma</dt>
            <dd class="font-mono text-body">{{ canal.estadoPlataforma }}</dd>
          </div>
          <div v-if="canal.ultimoError" class="col-span-2">
            <dt class="text-muted">Último error</dt>
            <dd class="font-mono text-body break-all">{{ canal.ultimoError }}</dd>
          </div>
        </dl>

        <div v-if="canal.necesitaVinculacion" class="mt-5 border-t border-line pt-4">
          <template v-if="puedeVerQr">
            <!-- ⚠️ EL AVISO NO ES DECORACIÓN: es lo único que separa «vincular el canal» de «escanear
                 un código porque estaba ahí». Quien escanea decide QUÉ CUENTA de WhatsApp es el
                 canal de la institución. -->
            <AppAlert variant="warning" class="mb-4">
              Quien escanee este código vincula el canal a <strong>su</strong> cuenta de WhatsApp.
            </AppAlert>
            <div v-if="qr" class="text-center">
              <img :src="qr.qr" alt="Código de vinculación de WhatsApp" class="mx-auto h-56 w-56" />
              <p class="mt-2 text-xs text-muted">
                Generado {{ desdeHace(qr.generadoEn, ahora) }} · se renueva solo
              </p>
            </div>
            <AppButton v-else variant="primary-outline" size="md" @click="pedirQr">
              Ver el código de vinculación
            </AppButton>
          </template>
          <p v-else class="text-sm text-muted">
            Hay que vincular la sesión. No tienes permiso para ver el código.
          </p>
        </div>
      </article>
    </div>

    <AppEmpty v-else-if="servicio.alcanzable" mensaje="Este despliegue no tiene ningún canal configurado." />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import Loading from "@/shared/components/feedback/Loading.vue";

import { desdeHace, explicacionDe, tonoDe } from "../../composables/canales/semaforo.js";
import { obtenerCodigoDeVinculacion, obtenerEstadoDeCanales } from "../../services/canalesService.js";

const canales = ref([]);
const servicio = ref({ alcanzable: true });
const puedeVerQr = ref(false);
const qr = ref(null);
const cargandoPrimeraVez = ref(true);
const ahora = ref(Date.now());

// ⚠️ SE PREGUNTA MIENTRAS LA PANTALLA ESTÁ ABIERTA, y se para al cerrarla. El QR de WhatsApp rota
// cada ~20 s, así que un dato de hace un minuto sirve para decidir pero NO para escanear.
//
// Se descartó usar el socket que ya existe: sería montar plumbing para una pantalla que se abre en
// contadas ocasiones. Sondear una página ABIERTA es justo el caso donde sondear es lo correcto.
const CADA_MS = 5000;
let reloj = null;

const refrescar = async () => {
  try {
    const datos = await obtenerEstadoDeCanales();
    servicio.value = datos.servicio ?? { alcanzable: false };
    canales.value = datos.canales ?? [];
    puedeVerQr.value = Boolean(datos.puedeVerQr);
    // Si el canal dejó de necesitar vinculación, el QR que hubiera en pantalla ya no vale.
    if (!canales.value.some((c) => c.necesitaVinculacion)) qr.value = null;
    else if (qr.value) await pedirQr();
  } catch (error) {
    servicio.value = { alcanzable: false, error: error?.message ?? "no se pudo consultar" };
    canales.value = [];
  } finally {
    ahora.value = Date.now();
    cargandoPrimeraVez.value = false;
  }
};

const pedirQr = async () => {
  const codigo = await obtenerCodigoDeVinculacion().catch(() => ({ hayQr: false }));
  qr.value = codigo.hayQr ? codigo : null;
};

onMounted(async () => {
  await refrescar();
  reloj = setInterval(refrescar, CADA_MS);
});
onBeforeUnmount(() => clearInterval(reloj));

const ETIQUETAS = {
  sano: "Funcionando",
  degradado: "Sin confirmar",
  sin_vincular: "Hay que vincular",
  bloqueado: "Bloqueado",
  caido: "Caído",
  desconocido: "Sin datos",
};
const etiquetaDe = (canal) => ETIQUETAS[canal?.salud] ?? "Sin datos";

defineEmits(["volver"]);
defineExpose({ refrescar });
</script>
