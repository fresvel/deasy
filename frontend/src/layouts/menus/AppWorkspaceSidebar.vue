<template>
  <s-menu :show="show" @close-mobile="$emit('close-mobile')">
    <div :class="containerClass">
      <div v-if="showLogo" class="mb-5 flex px-2">
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
    default: "flex flex-col gap-0 p-[0.0625rem] h-full xl:min-h-[calc(100vh-4rem)]"
  }
});

defineEmits(["close-mobile", "photo-selected"]);
</script>
