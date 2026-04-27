<template>
  <s-header :menu-open="menuOpen" @onclick="emit('menu-toggle')">
    <div class="flex items-center gap-3 overflow-hidden flex-1">
      <slot />
    </div>

    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <router-link
        v-for="item in navItems"
        :key="item.key"
        :to="item.to"
        class="flex shrink-0 items-center justify-center rounded-lg sm:rounded-xl h-9 w-9 sm:h-11 sm:w-11 transition-all focus:outline-none focus:ring-2 focus:ring-white/30 border border-white/10 bg-white/5 !text-white hover:bg-white/10"
        :title="item.title"
      >
        <component :is="item.icon" class="w-4 h-4 sm:w-5 sm:h-5" />
      </router-link>

      <div class="w-px h-5 sm:h-7 bg-white/20 mx-0.5 sm:mx-1 rounded-full"></div>

      <button
        class="deasy-nav-action h-9 w-9 rounded-lg sm:h-11 sm:w-11 sm:rounded-xl !text-white hover:bg-white/20"
        type="button"
        title="Firmar documentos"
        @click="emit('sign')"
      >
        <IconSignature class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <button
        class="deasy-nav-action h-9 w-9 rounded-lg sm:h-11 sm:w-11 sm:rounded-xl !text-white hover:bg-white/20"
        type="button"
        title="Notificaciones"
        @click="emit('notify')"
      >
        <IconBell class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <router-link
        to="/logout"
        class="deasy-nav-action h-9 w-9 rounded-lg sm:h-11 sm:w-11 sm:rounded-xl !text-white hover:bg-white/20"
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
import SHeader from "@/layouts/headers/SHeader.vue";

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
      to: "/dashboard",
      icon: IconHome
    },
    {
      key: "perfil",
      label: "Perfil",
      title: "Ir a perfil",
      to: "/perfil",
      icon: IconUser
    },
    {
      key: "admin",
      label: "Admin",
      title: "Ir a administración",
      to: "/admin",
      icon: IconSettings,
      showAlways: true
    }
  ].filter(item => {
    if (item.key === props.currentSection) return false;
    if (item.showOnlyIn && !item.showOnlyIn.includes(props.currentSection)) return false;
    return true;
  });
});
</script>
