<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-3">
      <!-- ⚠️ La variante se ELIGE, no se pinta encima. En `RegisterView` era `neutral-outline` con
           `border-red-300 text-danger hover:bg-red-50` estampado por ternario cuando faltaba la
           dirección: un botón en rojo reinventado sobre el neutro, que es lo que `check:overrides`
           tenía como grupo E. `danger-outline` ya existe y trae además su `:hover` y su foco. -->
      <AppButton
        type="button"
        :variant="tienePunto ? 'neutral-outline' : 'danger-outline'"
        class-name="w-full sm:w-auto"
        :disabled="disabled"
        @click="alternarMapa"
      >
        <IconMap class="h-4 w-4" />
        {{ abierto ? ocultarLabel : abrirLabel }}
      </AppButton>

      <AppTag v-if="tienePunto" variant="success">
        <template #icon><IconCheck class="deasy-tag__icon" /></template>
        {{ coordenadasLegibles }}
      </AppTag>
      <AppTag v-else-if="required" variant="danger">
        <template #icon><IconAlertCircle class="deasy-tag__icon" /></template>
        Requerido
      </AppTag>

      <AppButton
        v-if="tienePunto && !disabled"
        type="button"
        variant="neutral-outline"
        class-name="w-full sm:w-auto"
        @click="quitarPunto"
      >
        Quitar
      </AppButton>
    </div>

    <div v-show="abierto" class="mt-2">
      <div ref="contenedor" class="isolate h-75 w-full rounded-xl border border-line shadow-inner"></div>
    </div>
  </div>
</template>

<script setup>
// El selector de punto en el mapa. Vivía incrustado dentro de `RegisterView.vue` —90 líneas entre
// la plantilla y el script— y el admin no tenía ninguno: en «Direcciones» la latitud y la longitud
// eran dos `input type=number` que había que saberse.
//
// Al extraerlo se corrigen dos cosas que el original tenía y que sólo se ven al reutilizarlo:
//
//  1. **La instancia no se destruía al desmontar.** `toggleMap` la quitaba al cerrar, pero si se
//     abandonaba la vista con el mapa abierto quedaba un `L.map` vivo con sus escuchas. En un
//     registro, que se hace una vez, no se nota; en un modal del admin que se abre y se cierra
//     decenas de veces, sí.
//  2. **La geolocalización escribía el punto sin permiso del usuario.** Rellenaba latitud y
//     longitud con la posición del navegador nada más abrir el mapa. Aquí sólo CENTRA la vista:
//     el punto lo pone quien hace clic. Un dato que el usuario no puso no debería guardarse como
//     si lo hubiera puesto.
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { IconMap, IconCheck, IconAlertCircle } from "@tabler/icons-vue";

const props = defineProps({
  lat: { type: [Number, String], default: null },
  lng: { type: [Number, String], default: null },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  abrirLabel: { type: String, default: "Seleccionar ubicación en el mapa" },
  ocultarLabel: { type: String, default: "Ocultar mapa interactivo" }
});

const emit = defineEmits(["update:point"]);

// Quito el parche de iconos de Leaflet, que resuelve las imágenes por una ruta relativa que Vite
// no empaqueta. Se hace una vez por módulo, no una vez por instancia.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
});

const CENTRO_POR_DEFECTO = [-0.1807, -78.4678];

const contenedor = ref(null);
const abierto = ref(false);
let mapa = null;
let marca = null;

const numero = (valor) => {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

const latNum = computed(() => numero(props.lat));
const lngNum = computed(() => numero(props.lng));
const tienePunto = computed(() => latNum.value !== null && lngNum.value !== null);
const coordenadasLegibles = computed(() =>
  tienePunto.value ? `${latNum.value.toFixed(6)}, ${lngNum.value.toFixed(6)}` : ""
);

const pintarMarca = (lat, lng) => {
  if (marca) {
    mapa.removeLayer(marca);
  }
  marca = L.marker([lat, lng]).addTo(mapa);
};

const destruirMapa = () => {
  if (mapa) {
    mapa.remove();
    mapa = null;
    marca = null;
  }
};

const crearMapa = () => {
  if (!contenedor.value || mapa) {
    return;
  }
  mapa = L.map(contenedor.value).setView(CENTRO_POR_DEFECTO, 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapa);

  if (tienePunto.value) {
    pintarMarca(latNum.value, lngNum.value);
    mapa.setView([latNum.value, lngNum.value], 15);
  } else if (navigator.geolocation) {
    // Sólo centra. No pone el punto: eso lo decide quien hace clic.
    navigator.geolocation.getCurrentPosition(
      (posicion) => mapa?.setView([posicion.coords.latitude, posicion.coords.longitude], 15),
      () => {}
    );
  }

  if (!props.disabled) {
    mapa.on("click", (evento) => {
      const { lat, lng } = evento.latlng;
      pintarMarca(lat, lng);
      emit("update:point", { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
    });
  }
};

const alternarMapa = async () => {
  abierto.value = !abierto.value;
  if (!abierto.value) {
    destruirMapa();
    return;
  }
  // El contenedor tiene que estar en el DOM y con tamaño antes de que Leaflet lo mida; si no, el
  // mapa se dibuja de 0 px de alto y aparece en gris.
  await nextTick();
  crearMapa();
  mapa?.invalidateSize();
};

const quitarPunto = () => {
  if (marca && mapa) {
    mapa.removeLayer(marca);
    marca = null;
  }
  emit("update:point", { lat: null, lng: null });
};

// El punto puede cambiar desde fuera (cargar una dirección existente en el editor).
watch([latNum, lngNum], ([lat, lng]) => {
  if (!mapa || lat === null || lng === null) {
    return;
  }
  pintarMarca(lat, lng);
});

onBeforeUnmount(destruirMapa);
</script>
