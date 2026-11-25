<template>
  <s-menu :show="show" @close-mobile="$emit('close-mobile')">
    <div
      ref="sidebarRef"
      class="deasy-sidebar"
      :class="{
        'deasy-sidebar--collapsed': !show && !peeking,
        'deasy-sidebar--peek': !show && peeking
      }"
      @mouseenter="abrirVistazo"
      @mouseleave="cerrarVistazo"
      @focusin="abrirVistazo"
      @focusout="cerrarVistazoSiElFocoSalio"
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
        class="deasy-sidebar__flyout"
        :class="containerClass"
      >
        <div v-if="showLogo" class="mb-2 flex px-1 xl:hidden">
          <AppLogo to="/home" size="md" class-name="max-w-full" />
        </div>
        <!-- SOLO EL AVATAR, CENTRADO — decision del dueño, 2026-08-16.
             Aqui iba la tarjeta completa: avatar + nombre + subtitulo + el bloque del token de
             firma. Se va entera y usa el modo `compact`, que YA EXISTIA en el componente (era el
             del rail que murio esta misma tarde) — o sea que no hay forma nueva, hay una que
             estaba sin consumidor.

             📌 El bloque del token NO se pierde: no se pintaba nunca. `showSignatureDetails` llega
             desde `showSidebarSignatureDetails` de `AppWorkspaceShell`, y **ninguna vista lo pasa**,
             asi que su `v-if` era falso en las seis. Comprobado antes de quitarlo. -->
        <UserProfile
          compact
          :photo="photo"
          :username="username"
          :subtitle="profileSubtitle"
          :signature-marker="signatureMarker"
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

/* ══ EL VISTAZO — desplegar al pasar el raton sobre el rail, 2026-08-17 ════════════════════════
   El dueño esperaba que el rail de iconos se abriera al pasar el raton por encima y no lo hacia.
   El historial dice POR QUE, y no es lo que parece: lo que existio y se retiro el 2026-08-16 no
   era abrir al entrar, era `handleSidebarMouseLeave` — CERRAR AL SALIR (`dcaf9c68`, 28-may). Es
   decir, el raton nunca abrio nada; solo cerraba lo que habias abierto TU con el boton. Por eso
   molestaba: te llevabas el menu por delante justo al mover el raton hacia el contenido, y para
   recuperarlo habia que volver al boton.

   El motivo de aquella retirada sigue en pie y esta respetado aqui, porque son DOS estados y no
   se tocan:

     `show`     — la INTENCION. La pone y la quita el boton, y nada mas. Salir con el raton NO la
                  toca: si abriste la barra, sigue abierta aunque cruces la pantalla entera.
     `peeking`  — el VISTAZO. Solo existe mientras el puntero (o el foco) esta dentro, y solo
                  cuando la barra esta cerrada. Se va solo, porque nunca fue una decision.

   Asi que `mouseleave` aqui no deshace nada que hayas pedido: cancela un vistazo. La regresion de
   ayer era el caso contrario — el raton revocando una orden del boton.

   ⚠️ Y el vistazo NO ensancha la columna: la abre ENCIMA del contenido (ver `layout.css`). Con
   ancho, salir del rail devolveria el area de datos 194 px a la izquierda de un tiron, con lo que
   el elemento al que apuntabas se movería justo antes del clic. Es el mismo fallo de 2026-08-16
   con otro disparador, y por eso el panel flota mientras dura el roce.

   📌 `focusin`/`focusout` van con el raton a proposito: con la barra colapsada, tabular por los
   iconos abre las etiquetas. Sin eso el vistazo seria una funcion solo para quien usa raton. */
const peeking = ref(false);

const abrirVistazo = () => {
  if (props.show || !isDesktopViewport()) {
    return;
  }
  peeking.value = true;
};

const cerrarVistazo = () => {
  peeking.value = false;
};

/* `focusout` se dispara tambien al saltar entre dos items de la propia barra, asi que hay que
   mirar A DONDE va el foco: si sigue dentro, no es una salida. */
const cerrarVistazoSiElFocoSalio = (event) => {
  const root = sidebarRef.value;
  if (root && event.relatedTarget && root.contains(event.relatedTarget)) {
    return;
  }
  cerrarVistazo();
};

/* El cierre al pulsar FUERA se queda como estaba: eso si es una intencion, no un roce. */
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
