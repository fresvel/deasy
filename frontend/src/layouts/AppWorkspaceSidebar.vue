<template>
  <s-menu :show="show" @close-mobile="$emit('close-mobile')">
    <div :class="containerClass">
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
import SMenu from "@/layouts/SMenu.vue";
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
  containerClass: {
    type: [String, Array, Object],
    default: "flex flex-col"
  }
});

defineEmits(["close-mobile", "photo-selected"]);
</script>
