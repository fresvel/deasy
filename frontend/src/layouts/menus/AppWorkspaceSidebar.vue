<template>
  <s-menu :show="show" @close-mobile="$emit('close-mobile')">
    <div class="deasy-sidebar">
      <div class="deasy-sidebar__rail">
        <AppLogo
          v-if="showLogo"
          to="/dashboard"
          size="sm"
          class-name="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/8 p-1"
          image-class="max-h-8 max-w-8 object-contain"
        />
        <UserProfile
          compact
          :photo="photo"
          :username="username"
          :signature-marker="signatureMarker"
          :editable="editable"
          @photo-selected="$emit('photo-selected', $event)"
        />
      </div>

      <div :class="['deasy-sidebar__flyout', containerClass]">
        <div v-if="showLogo" class="mb-2 flex px-1 xl:hidden">
          <AppLogo to="/dashboard" size="md" class-name="max-w-full" />
        </div>
        <UserProfile
          :photo="photo"
          :username="username"
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
import SMenu from "@/layouts/menus/SMenu.vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import UserProfile from "@/shared/components/widgets/UserProfile.vue";

defineProps({
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
  signatureMarker: {
    type: String,
    default: ""
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

defineEmits(["close-mobile", "photo-selected"]);
</script>
