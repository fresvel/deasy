<template>
  <s-header :menu-open="menuOpen" @onclick="emit('menu-toggle')">
    <div class="flex items-center gap-3 overflow-hidden flex-1">
      <slot />
    </div>

    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <component
        :is="item.to ? 'router-link' : 'div'"
        v-for="item in navItems"
        :key="item.key"
        :to="item.to"
        class="flex shrink-0 items-center justify-center rounded-lg sm:rounded-xl h-9 w-9 sm:h-11 sm:w-11 transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
        :class="item.active ? 'bg-white/20 text-white border border-white/30 shadow-sm' : 'border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white'"
        :title="item.title"
      >
        <component :is="item.icon" class="w-4 h-4 sm:w-5 sm:h-5" />
      </component>

      <div class="w-px h-5 sm:h-7 bg-white/20 mx-0.5 sm:mx-1 rounded-full"></div>

      <button
        class="deasy-nav-action h-9 w-9 rounded-lg sm:h-11 sm:w-11 sm:rounded-xl !text-white/80 hover:!text-white"
        type="button"
        title="Firmar documentos"
        @click="emit('sign')"
      >
        <IconSignature class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <button
        class="deasy-nav-action h-9 w-9 rounded-lg sm:h-11 sm:w-11 sm:rounded-xl"
        type="button"
        title="Notificaciones"
        @click="emit('notify')"
      >
        <IconBell class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <router-link
        to="/logout"
        class="deasy-nav-action h-9 w-9 rounded-lg !text-white/90 sm:h-11 sm:w-11 sm:rounded-xl hover:!text-white"
        title="Cerrar sesión"
      >
        <IconLogout class="w-4 h-4 sm:w-5 sm:h-5" />
      </router-link>
    </div>
  </s-header>
</template>

<script setup>
import { computed } from "vue";
import { IconBell, IconHome, IconLogout, IconSettings, IconSignature, IconUser } from "@tabler/icons-vue";
import SHeader from "@/layouts/SHeader.vue";

const props = defineProps({
  menuOpen: {
    type: Boolean,
    default: false
  },
  currentSection: {
    type: String,
    required: true
  }
});

const emit = defineEmits(["menu-toggle", "notify", "sign"]);

const navItems = computed(() => {
  return [
    {
      key: "dashboard",
      label: "Home",
      title: "Ir a dashboard",
      to: props.currentSection === "dashboard" ? null : "/dashboard",
      icon: IconHome,
      active: props.currentSection === "dashboard"
    },
    {
      key: "perfil",
      label: "Perfil",
      title: "Ir a perfil",
      to: props.currentSection === "perfil" ? null : "/perfil",
      icon: IconUser,
      active: props.currentSection === "perfil"
    },
    {
      key: "admin",
      label: "Admin",
      title: "Ir a administración",
      to: props.currentSection === "admin" ? null : "/admin",
      icon: IconSettings,
      active: props.currentSection === "admin"
    }
  ];
});
</script>
