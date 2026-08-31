<template>
  <!-- El manual, en un modal y no en la pantalla.
       ⚠️ Antes esto era un párrafo suelto —«Escríbenos tú desde el número que registraste. Así el
       propio mensaje demuestra que es tuyo»— que explicaba el PORQUÉ y no el CÓMO. Quien llega aquí
       no necesita entender el diseño del sistema: necesita saber qué botón pulsar.
       El porqué se queda, pero al final y para quien tenga curiosidad. -->
  <AppModalShell
    controlled
    :open="open"
    labelled-by="manual-canal-title"
    :title="`Verificar por ${canal.nombre}`"
    size="md"
    @close="$emit('close')"
  >
    <ol class="space-y-4">
      <li v-for="(paso, indice) in pasos" :key="indice" class="flex gap-3">
        <span class="deasy-icon-box deasy-icon-box--sm deasy-icon-box--round deasy-icon-box--primary deasy-icon-box--solid shrink-0 text-xs font-semibold">
          {{ indice + 1 }}
        </span>
        <p class="pt-1 text-sm text-muted" v-html="paso" />
      </li>
    </ol>

    <p class="mt-6 rounded-md border border-line bg-surface p-3 text-xs text-muted">
      <strong class="text-strong">¿Por qué así y no un código que te mandemos?</strong>
      Porque el mensaje lo envías tú: eso demuestra por sí solo que el número es tuyo, sin que
      tengamos que fiarnos de nada. Y por eso no te cuesta nada en Telegram ni en WhatsApp.
    </p>

    <template #footer>
      <AppButton variant="primary-outline" class-name="w-full" @click="$emit('close')">
        Entendido
      </AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed } from "vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  canal: { type: Object, required: true },
  numero: { type: String, default: "" },
});
defineEmits(["close"]);

// Cada canal tiene su baile, y son distintos de verdad: Telegram NO nos da el teléfono y hay que
// pedirlo con un botón; WhatsApp y el SMS lo traen con el mensaje. Un texto genérico para los tres
// dejaría al de Telegram atascado justo en el paso que sólo él tiene.
const PASOS = {
  telegram: [
    'Pulsa <strong class="text-strong">Abrir Telegram</strong>, o escanea el código con la cámara de tu móvil.',
    'Se abrirá una conversación con nuestro bot. Pulsa <strong class="text-strong">Empezar</strong> (o <em>Start</em>).',
    'El bot te pedirá tu número. Pulsa el botón <strong class="text-strong">«Compartir mi número»</strong>.',
    '¿No ves ese botón? Está plegado: toca el icono de <strong class="text-strong">cuadrícula (▦)</strong> a la derecha del campo donde se escribe, y aparecerá.',
    'Vuelve aquí y pulsa <strong class="text-strong">«Ya lo hice»</strong>.',
  ],
  whatsapp: [
    'Pulsa <strong class="text-strong">Abrir WhatsApp</strong>, o escanea el código con la cámara de tu móvil.',
    'Se abrirá una conversación con el mensaje <strong class="text-strong">ya escrito</strong>. No lo cambies.',
    'Pulsa enviar.',
    'Vuelve aquí y pulsa <strong class="text-strong">«Ya lo hice»</strong>.',
  ],
  sms: [
    'Abre la aplicación de mensajes de tu teléfono.',
    'Escribe un mensaje al número que aparece en pantalla, con <strong class="text-strong">exactamente</strong> el texto que se muestra.',
    'Envíalo desde el número que registraste. Si lo mandas desde otro, no valdrá.',
    'Vuelve aquí y pulsa <strong class="text-strong">«Ya lo hice»</strong>.',
  ],
};

const pasos = computed(() => {
  const base = PASOS[props.canal.id] ?? [];
  if (props.canal.id !== "sms" || !props.numero) return base;
  // El SMS es el único que puede costar dinero, y hay que decirlo donde se decide: este sistema
  // atiende a extranjeros a propósito, y desde fuera del país un SMS sale caro.
  return [...base, 'Ten en cuenta que <strong class="text-strong">lo cobra tu operadora</strong>, y desde fuera del país puede ser caro. Telegram y WhatsApp son gratis.'];
});
</script>
