<template>
  <div class="deasy-auth-page">
    <div class="deasy-auth-center" :class="alignClass">
      <div class="deasy-auth-card mx-auto w-full" :class="[sizeClass, padded ? 'p-7 sm:p-10' : '']">
        <slot />
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Andamiaje de las pantallas sin sesion (login, registro, recuperar, verificar, terminos, bootstrap).
 *
 * Solo absorbe lo que las seis repetian de verdad: los tres niveles page > center > card. La cabecera NO
 * entra aqui a proposito: de las seis pantallas, dos llevan logo+titulo centrados, dos un enlace de vuelta
 * con icono, y dos una banda con borde. Meterlas todas exigiria una decena de props/slots y el layout
 * acabaria pareciendose a los modales de 33 props de admin. Cada vista compone su cabecera dentro del slot.
 *
 * Las clases ya existian en shared/styles/tailwind.css:1209-1226; lo que faltaba era el componente.
 */

// Vive en un <script> normal, no en el setup: defineProps() se hoistea fuera de setup() y no puede
// referenciar locales suyas, asi que el validator no veria el mapa. Asi hay una sola fuente de verdad.
const SIZE_CLASSES = {
  md: "max-w-md",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl"
};
</script>

<script setup>
import { computed } from "vue";

const props = defineProps({
  /** Ancho maximo de la tarjeta. */
  size: {
    type: String,
    default: "md",
    validator: (value) => Object.hasOwn(SIZE_CLASSES, value)
  },
  /**
   * Alineacion vertical. 'center' para formularios cortos; 'start' cuando el contenido es alto y
   * centrarlo verticalmente lo empujaria fuera de pantalla (registro, terminos).
   */
  align: {
    type: String,
    default: "center",
    validator: (value) => ["center", "start"].includes(value)
  },
  /**
   * Padding interior estandar. false cuando la vista pinta su propia banda de cabecera a sangre y
   * gestiona el espaciado por bloques.
   */
  padded: {
    type: Boolean,
    default: true
  }
});

const sizeClass = computed(() => SIZE_CLASSES[props.size]);
const alignClass = computed(() => (props.align === "start" ? "items-start" : ""));
</script>
