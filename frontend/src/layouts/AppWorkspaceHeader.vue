<template>
  <s-header :menu-open="menuOpen" @onclick="emit('menu-toggle')">
    <div class="flex items-center gap-3 overflow-hidden flex-1">
      <div class="flex items-center gap-2 shrink-0">
        <component
          :is="item.to ? 'router-link' : 'div'"
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="deasy-nav-chip min-w-[44px] sm:min-w-[100px] lg:min-w-[140px] group"
          :class="item.active ? 'deasy-nav-chip--active' : 'deasy-nav-chip--idle'"
          :title="item.title"
        >
          <span
            class="deasy-nav-chip__icon"
            :class="item.active ? 'deasy-nav-chip__icon--active' : 'deasy-nav-chip__icon--idle'"
          >
            <component :is="item.icon" class="w-5 h-5 shrink-0" />
          </span>
          <span class="text-sm font-semibold leading-tight hidden sm:inline-flex items-center whitespace-nowrap">
            {{ item.label }}
          </span>
        </component>
      </div>

      <slot />
    </div>

    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
      <button
        class="deasy-nav-action h-9 w-9 sm:ms-3 sm:h-11 sm:w-11"
        type="button"
        title="Firmar documentos"
        @click="emit('sign')"
      >
        <IconSignature class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <button
        class="deasy-nav-action h-9 w-9 sm:h-11 sm:w-11"
        type="button"
        title="Notificaciones"
        @click="emit('notify')"
      >
        <IconBell class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <router-link
        to="/logout"
        class="deasy-nav-action h-9 w-9 !text-white/90 sm:h-11 sm:w-11 hover:!text-white"
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
