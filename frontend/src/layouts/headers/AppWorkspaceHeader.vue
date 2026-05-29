<template>
  <s-header :menu-open="menuOpen" @onclick="emit('menu-toggle')">
    <div class="flex flex-1 items-center gap-3 overflow-hidden">
      <slot />
    </div>

    <div class="flex shrink-0 items-center gap-1 sm:gap-2">
      <router-link
        v-for="item in navItems"
        :key="item.key"
        :to="item.to"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/15 sm:h-11 sm:w-11"
        :title="item.title"
      >
        <component :is="item.icon" class="h-4 w-4 sm:h-5 sm:w-5" />
      </router-link>

      <div v-if="!isAdminOnly" class="mx-0.5 h-5 w-px rounded-full bg-slate-200 sm:mx-1 sm:h-7"></div>

      <button
        v-if="!isAdminOnly"
        class="deasy-nav-action h-9 w-9 sm:h-11 sm:w-11"
        type="button"
        title="Firmar documentos"
        @click="emit('sign')"
      >
        <IconSignature class="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <button
        v-if="!isAdminOnly"
        class="deasy-nav-action h-9 w-9 sm:h-11 sm:w-11"
        type="button"
        title="Notificaciones"
        @click="emit('notify')"
      >
        <IconBell class="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      <router-link
        to="/logout"
        class="deasy-nav-action h-9 w-9 sm:h-11 sm:w-11"
        title="Cerrar sesión"
      >
        <IconLogout class="h-4 w-4 sm:h-5 sm:w-5" />
      </router-link>
    </div>
  </s-header>
</template>

<script setup>
import { computed } from "vue";
import { IconBell, IconHome, IconLogout, IconSettings, IconSignature, IconUser } from "@tabler/icons-vue";
import SHeader from "@/layouts/headers/SHeader.vue";
import { canAccessAdmin, isAdminUser } from "@/core/utils/accessControl.js";

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

const isAdminOnly = computed(() => isAdminUser());

const navItems = computed(() => {
  return [
    {
      key: "home",
      label: "Home",
      title: "Ir a Home",
      to: "/home",
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
      label: "Sistema",
      title: "Ir a administración",
      to: "/admin",
      icon: IconSettings,
      requiresAdminAccess: true
    }
  ].filter(item => {
    if (isAdminOnly.value && item.key !== "admin") return false;
    if (item.key === props.currentSection) return false;
    if (item.requiresAdminAccess && !canAccessAdmin()) return false;
    if (item.showOnlyIn && !item.showOnlyIn.includes(props.currentSection)) return false;
    return true;
  });
});
</script>
