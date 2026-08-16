<template>
  <s-menu :show="show" @close-mobile="$emit('close-mobile')">
    <div
      ref="sidebarRef"
      class="deasy-sidebar"
      @mouseleave="handleSidebarMouseLeave"
    >
      <!-- ══ AQUI VIVIA EL RAIL DE 80 px — retirado el 2026-08-16 (F4.C·B) ═════════════════════
           La barra lateral llevaba DOS navegaciones a la vez: este rail con la primaria (Inicio ·
           Procesos · Sistema) y el panel de al lado con la secundaria. Eran 424 px de ancho fijo
           en escritorio, frente a los 290 de la receta de TailAdmin, que monta UNA sola barra.

           Por decision del dueño la primaria sube al HEADER y aqui queda solo la secundaria. Se
           eligio esa colocacion sobre la alternativa —meter los tres destinos como primer nivel
           del mismo arbol, que es lo que hace su `layout-one`— porque aquella habria añadido un
           TERCER nivel de profundidad: llegar a «Tareas» pasaria de dos clics a tres.

           Con el rail se van tres cosas mas:
             · el avatar COMPACTO, que era una segunda copia del `UserProfile` de aqui abajo;
             · el logo pequeño del rail, ya duplicado con el del panel;
             · el doble renderizado del slot `rail`, que se pintaba una vez aqui (escritorio) y
               otra en `deasy-sidebar__rail-mobile` (movil). El mismo menu estaba DOS VECES en el
               DOM, con una copia oculta por `hidden`/`xl:hidden`.
           ══════════════════════════════════════════════════════════════════════════════════════ -->
      <div
        class="deasy-sidebar__flyout" :class="[
          containerClass,
          // Cerrado en escritorio => xl:hidden (fuera del flujo), para que el contenido
          // RECUPERE el espacio. Con invisible/opacity-0 seguia ocupando su columna.
          show
            ? 'xl:visible xl:translate-x-0 xl:opacity-100'
            : 'xl:hidden'
        ]"
      >
        <div v-if="showLogo" class="mb-2 flex px-1 xl:hidden">
          <AppLogo to="/home" size="md" class-name="max-w-full" />
        </div>
        <UserProfile
          :photo="photo"
          :username="username"
          :subtitle="profileSubtitle"
          :signature-marker="signatureMarker"
          :show-signature-details="showSignatureDetails"
          :editable="editable"
          @photo-selected="$emit('photo-selected', $event)"
        />
        <slot />
      </div>
    </div>
  </s-menu>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import SMenu from "@/layouts/menus/SMenu.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import UserProfile from "@/shared/components/widgets/UserProfile.vue";

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  photo: {
    type: String,
    default: "/images/avatar.png"
  },
  username: {
    type: String,
    default: "Usuario"
  },
  profileSubtitle: {
    type: String,
    default: "Cuenta institucional"
  },
  signatureMarker: {
    type: String,
    default: ""
  },
  showSignatureDetails: {
    type: Boolean,
    default: false
  },
  editable: {
    type: Boolean,
    default: false
  },
  showLogo: {
    type: Boolean,
    default: true
  },
  containerClass: {
    type: [String, Array, Object],
    default: "flex flex-col gap-0 h-full"
  }
});

const emit = defineEmits(["close-mobile", "photo-selected"]);

const sidebarRef = ref(null);

const isDesktopViewport = () =>
  typeof window !== "undefined" && window.innerWidth >= 1280;

const requestClose = () => {
  emit("close-mobile");
};

const handleSidebarMouseLeave = () => {
  if (!props.show || !isDesktopViewport()) {
    return;
  }
  requestClose();
};

const handlePointerDownOutside = (event) => {
  if (!props.show || !isDesktopViewport()) {
    return;
  }
  const root = sidebarRef.value;
  if (!root || root.contains(event.target)) {
    return;
  }
  requestClose();
};

onMounted(() => {
  if (typeof window === "undefined") {
    return;
  }
  window.addEventListener("pointerdown", handlePointerDownOutside, true);
});

onBeforeUnmount(() => {
  if (typeof window === "undefined") {
    return;
  }
  window.removeEventListener("pointerdown", handlePointerDownOutside, true);
});
</script>
