<template>
  <s-header :menu-open="menuOpen" @onclick="emit('menu-toggle')">
    <div class="flex items-center gap-3 overflow-hidden flex-1">
      <div class="flex items-center gap-2 shrink-0">
        <component
          :is="item.to ? 'router-link' : 'div'"
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="inline-flex items-center justify-center sm:justify-start gap-2 min-w-[44px] sm:min-w-[100px] lg:min-w-[140px] px-2 sm:px-3 py-2 rounded-xl border-none transition-all shrink-0 group hover:-translate-y-[1px]"
          :class="item.active ? 'bg-white/95 text-sky-700 shadow-[0_10px_20px_rgba(2,132,199,0.26)]' : 'bg-white/10 text-white/95 hover:bg-white/20'"
          :title="item.title"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0" />
          <span class="text-sm font-semibold leading-tight hidden sm:inline-flex items-center whitespace-nowrap">
            {{ item.label }}
          </span>
        </component>
      </div>

      <slot />
    </div>

    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <button
        class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30 sm:ms-3"
        type="button"
        title="Firmar documentos"
        @click="emit('sign')"
      >
        <IconSignature class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <button
        class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30"
        type="button"
        title="Notificaciones"
        @click="emit('notify')"
      >
        <IconBell class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <router-link
        to="/logout"
        class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 !text-white/90 hover:bg-white/20 hover:!text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30"
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
  const items = [];

  if (props.currentSection !== "dashboard") {
    items.push({
      key: "dashboard",
      label: "Home",
      title: "Ir a dashboard",
      to: "/dashboard",
      icon: IconHome,
      active: props.currentSection === "dashboard"
    });
  }

  if (props.currentSection !== "perfil") {
    items.push({
      key: "perfil",
      label: "Perfil",
      title: "Ir a perfil",
      to: "/perfil",
      icon: IconUser,
      active: props.currentSection === "perfil"
    });
  }

  items.push({
    key: "admin",
    label: "Admin",
    title: "Ir a administración",
    to: props.currentSection === "admin" ? null : "/admin",
    icon: IconSettings,
    active: props.currentSection === "admin"
  });

  return items;
});
</script>
