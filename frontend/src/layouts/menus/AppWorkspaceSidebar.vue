<template>
  <s-menu :show="show" @close-mobile="$emit('close-mobile')">
    <div
      ref="sidebarRef"
      class="deasy-sidebar"
      @mouseleave="handleSidebarMouseLeave"
    >
      <div class="deasy-sidebar__rail">
        <AppLogo
          v-if="showLogo"
          to="/home"
          size="sm"
          class-name="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-brand-white/8 p-1"
          image-class="max-h-8 max-w-8 object-contain"
        />
        <UserProfile
          compact
          :photo="photo"
          :username="username"
          :subtitle="profileSubtitle"
          :signature-marker="signatureMarker"
          :show-signature-details="false"
          :editable="editable"
          @photo-selected="$emit('photo-selected', $event)"
        />
        <slot name="rail" />
      </div>

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
        <div class="deasy-sidebar__rail-mobile xl:hidden">
          <slot name="rail" />
        </div>
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
