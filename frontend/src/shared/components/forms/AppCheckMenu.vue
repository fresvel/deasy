<template>
  <div ref="raiz" class="deasy-check-menu">
    <AppButton
      :variant="variant"
      aria-haspopup="true"
      :aria-expanded="abierto"
      @click="abierto = !abierto"
    >
      {{ label }}
      <IconChevronDown class="ml-1 h-4 w-4 transition-transform" :class="abierto ? 'rotate-180' : ''" />
    </AppButton>
    <div v-if="abierto" class="deasy-check-menu__panel" role="group" :aria-label="label">
      <label v-for="opcion in options" :key="opcion.value" class="deasy-check-menu__item">
        <input
          type="checkbox"
          :checked="modelValue.includes(opcion.value)"
          @change="alternar(opcion.value)"
        />
        <span>{{ opcion.label }}</span>
      </label>
    </div>
  </div>
</template>

<script setup>
/* UN DESPLEGABLE CON CASILLAS — «qué se muestra», elegido de una lista corta.
 *
 * Nace en el mapa de procesos (2026-11-23), donde sustituye a un control segmentado de tres
 * botones que mezclaba dos cosas: parecía una elección excluyente —un carril con una opción
 * iluminada— y eran tres interruptores independientes. Una lista de casillas dice lo que es.
 *
 * El disparador ES un `AppButton`, a propósito: va en una barra junto a otros botones y tiene que
 * medir y pintar lo mismo que ellos, no parecerse. La variante se pasa desde fuera, que es quien
 * sabe con quién convive; y el ancho lo pone el contenedor: el botón llena el del componente.
 *
 * Se cierra al pulsar fuera y con Escape, igual que `AppUserMenu`: un panel que no se cierra con
 * las dos cosas no es adoptable. NO se cierra al marcar una casilla — se suelen cambiar varias.
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { IconChevronDown } from "@tabler/icons-vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";

const props = defineProps({
  label: { type: String, required: true },
  /* [{ value, label }] */
  options: { type: Array, required: true },
  /* Los `value` marcados. */
  modelValue: { type: Array, default: () => [] },
  variant: { type: String, default: "primary-outline" }
});
const emit = defineEmits(["update:modelValue"]);

const abierto = ref(false);
const raiz = ref(null);

const alternar = (valor) => {
  const marcados = new Set(props.modelValue);
  if (marcados.has(valor)) marcados.delete(valor);
  else marcados.add(valor);
  /* En el orden de `options`, no en el de los clics: quien escucha recibe siempre lo mismo para
     la misma selección. */
  emit("update:modelValue", props.options.map((o) => o.value).filter((v) => marcados.has(v)));
};

const alPulsarFuera = (evento) => {
  if (abierto.value && raiz.value && !raiz.value.contains(evento.target)) abierto.value = false;
};
const alTeclear = (evento) => {
  if (evento.key === "Escape") abierto.value = false;
};

onMounted(() => {
  document.addEventListener("mousedown", alPulsarFuera);
  document.addEventListener("keydown", alTeclear);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", alPulsarFuera);
  document.removeEventListener("keydown", alTeclear);
});
</script>
