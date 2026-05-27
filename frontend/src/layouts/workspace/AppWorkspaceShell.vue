<template>
  <div class="deasy-workspace">
    <SHeader :menu-open="menuOpen" @onclick="emit('menu-toggle')">
      <div class="deasy-workspace-header">
        <div class="deasy-workspace-header__context">
          <nav class="deasy-primary-nav" aria-label="Navegacion principal">
            <router-link
              v-for="item in primaryNavItems"
              :key="item.key"
              :to="item.to"
              class="deasy-primary-nav__item"
              :class="{ 'deasy-primary-nav__item--active': isNavActive(item) }"
              :title="item.label"
            >
              <span class="deasy-primary-nav__icon">
                <component :is="item.icon" class="h-4 w-4 shrink-0" />
              </span>
              <span class="deasy-primary-nav__label">{{ item.label }}</span>
            </router-link>
          </nav>
          <slot name="header" />
        </div>

        <div class="deasy-workspace-header__actions">
          <button
            v-if="showSignatureAction"
            class="deasy-nav-action h-9 w-9 sm:h-10 sm:w-10"
            type="button"
            title="Firmas"
            aria-label="Firmas"
            @click="emit('sign')"
          >
            <IconSignature class="h-4.5 w-4.5" />
          </button>
          <button
            class="deasy-nav-action h-9 w-9 sm:h-10 sm:w-10"
            type="button"
            title="Notificaciones"
            aria-label="Notificaciones"
            @click="emit('notify')"
          >
            <IconBell class="h-4.5 w-4.5" />
          </button>
          <router-link
            to="/logout"
            class="deasy-nav-action h-9 w-9 sm:h-10 sm:w-10"
            title="Cerrar sesion"
            aria-label="Cerrar sesion"
          >
            <IconLogout class="h-4.5 w-4.5" />
          </router-link>
        </div>
      </div>
    </SHeader>

    <div class="deasy-workspace-layout">
      <AppWorkspaceSidebar
        :show="menuOpen"
        :photo="photo"
        :username="username"
        :signature-marker="signatureMarker"
        :editable="editable"
        :show-logo="false"
        container-class="flex h-full flex-col gap-0"
        @close-mobile="emit('close-mobile')"
        @photo-selected="emit('photo-selected', $event)"
      >
        <div v-if="$slots.sidebar" class="deasy-secondary-nav">
          <slot name="sidebar" />
        </div>
      </AppWorkspaceSidebar>

      <SBody class="deasy-workspace-content" :showmenu="menuOpen" :shownotify="showNotify">
        <slot />
      </SBody>

      <SMessage :show="showNotify" @close="emit('notify-close')" />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  IconBell,
  IconFileText,
  IconHome,
  IconLayoutDashboard,
  IconLogout,
  IconSettings,
  IconSignature,
  IconUser,
} from "@tabler/icons-vue";
import SHeader from "@/layouts/headers/SHeader.vue";
import SBody from "@/layouts/core/SBody.vue";
import SMessage from "@/layouts/core/SNotify.vue";
import AppWorkspaceSidebar from "@/layouts/menus/AppWorkspaceSidebar.vue";
import { canAccessAdmin, canReadResource, hasAnyRole, isAdminUser } from "@/core/utils/accessControl.js";

const props = defineProps({
  menuOpen: {
    type: Boolean,
    default: false
  },
  showNotify: {
    type: Boolean,
    default: false
  },
  currentSection: {
    type: String,
    default: "dashboard"
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
  }
});

const emit = defineEmits([
  "menu-toggle",
  "close-mobile",
  "notify",
  "notify-close",
  "sign",
  "photo-selected"
]);

const route = useRoute();

const isAuditorView = computed(() =>
  hasAnyRole(["Auditor"]) && !hasAnyRole(["Admin", "Gestor"])
);

const showSignatureAction = computed(() =>
  !isAdminUser() && !isAuditorView.value && canReadResource("documents")
);

const canShowAdminNav = computed(() =>
  canAccessAdmin() &&
  (
    hasAnyRole(["Admin", "Gestor", "Auditor"]) ||
    canReadResource("users") ||
    canReadResource("roles")
  )
);

const primaryNavItems = computed(() => {
  const adminOnly = isAdminUser();
  const items = [
    {
      key: "home",
      label: "Inicio",
      to: { name: "dashboard" },
      icon: IconHome,
      hideForAdminOnly: true,
      exactRouteNames: ["dashboard"],
      inactiveHashes: ["#procesos"]
    },
    {
      key: "processes",
      label: "Procesos",
      to: { name: "dashboard", hash: "#procesos" },
      icon: IconLayoutDashboard,
      hideForAdminOnly: true,
      hideForAuditor: true,
      requiresResource: "processes",
      exactRouteNames: ["dashboard"],
      activeHash: "#procesos"
    },
    {
      key: "documents",
      label: "Documentos",
      to: { name: "dashboard-documents" },
      icon: IconFileText,
      hideForAdminOnly: true,
      requiresResource: "documents",
      exactRouteNames: ["dashboard-documents"]
    },
    {
      key: "signatures",
      label: "Firmas",
      to: { name: "dashboard-signatures" },
      icon: IconSignature,
      hideForAdminOnly: true,
      hideForAuditor: true,
      requiresResource: "documents",
      exactRouteNames: ["dashboard-signatures"]
    },
    {
      key: "profile",
      label: "Perfil",
      to: { name: "perfil" },
      icon: IconUser,
      hideForAdminOnly: true,
      requiresResource: "dossier",
      exactRouteNames: ["perfil"]
    },
    {
      key: "admin",
      label: "Admin",
      to: { name: "admin" },
      icon: IconSettings,
      requiresAdminAccess: true,
      exactRouteNames: ["admin"]
    }
  ];

  return items.filter((item) => {
    if (adminOnly && item.hideForAdminOnly) return false;
    if (isAuditorView.value && item.hideForAuditor) return false;
    if (item.requiresResource && !canReadResource(item.requiresResource)) return false;
    if (item.requiresAdminAccess && !canShowAdminNav.value) return false;
    return true;
  });
});

const isNavActive = (item) => {
  if (item.activeHash && route.hash !== item.activeHash) {
    return false;
  }
  if (item.inactiveHashes?.includes(route.hash)) {
    return false;
  }
  if (item.exactRouteNames?.includes(route.name)) {
    return true;
  }
  if (item.activeSections?.includes(props.currentSection)) {
    return !(item.inactiveRouteNames || []).includes(route.name);
  }
  return false;
};
</script>
