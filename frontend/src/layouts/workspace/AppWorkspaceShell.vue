<template>
  <div class="deasy-workspace">
    <SHeader :menu-open="menuOpen" @onclick="emit('menu-toggle')">
      <div class="deasy-workspace-header">
        <div class="deasy-workspace-header__context">
          <slot name="header" />
        </div>

        <!-- LA NAVEGACION PRIMARIA — subio aqui desde el rail de la barra lateral el 2026-08-16
             (F4.C·B, decision del dueño). Aqui gana etiqueta: en el rail era solo icono porque
             cabian 80 px, y en horizontal hay sitio para decir el nombre. -->
        <nav class="deasy-primary-nav" aria-label="Navegacion principal">
          <router-link
            v-for="item in primaryNavItems"
            :key="item.key"
            :to="item.to"
            class="deasy-primary-nav__item"
            :class="{ 'deasy-primary-nav__item--active': isNavActive(item) }"
            :title="item.label"
            @click="emit('primary-nav', { key: item.key, active: isNavActive(item) })"
          >
            <component :is="item.icon" class="h-5 w-5 shrink-0" />
            <span class="deasy-primary-nav__label">{{ item.label }}</span>
          </router-link>
        </nav>

        <div class="deasy-workspace-header__actions">
          <button
            v-if="showSignatureAction"
            class="deasy-nav-action"
            type="button"
            title="Firmas"
            aria-label="Firmas"
            @click="emit('sign')"
          >
            <IconSignature class="h-5 w-5" />
          </button>
          <button
            class="deasy-nav-action"
            type="button"
            title="Notificaciones"
            aria-label="Notificaciones"
            @click="emit('notify')"
          >
            <IconBell class="h-5 w-5" />
          </button>
          <!-- ⚠️ AQUI ESTABA EL BOTON DE CERRAR SESION, y se fue al menu de perfil el 2026-08-16.
               Es lo que hace la receta §3.5, y ademas libera un hueco en una barra que desde hoy
               lleva tambien la navegacion primaria. -->
          <AppUserMenu
            :nombre="username"
            :subtitulo="sidebarSubtitle"
            :foto="photo"
            :es-admin="isAdminUser()"
            :puede-ver-perfil="canReadResource('dossier')"
          />
        </div>
      </div>
    </SHeader>

    <div class="deasy-workspace-layout">
      <AppWorkspaceSidebar
        :show="menuOpen"
        :photo="photo"
        :username="username"
        :profile-subtitle="sidebarSubtitle"
        :signature-marker="signatureMarker"
        :show-signature-details="showSidebarSignatureDetails"
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
    IconSettings,
  IconSignature,
  IconSitemap,
} from "@tabler/icons-vue";
import SHeader from "@/layouts/headers/SHeader.vue";
import SBody from "@/layouts/core/SBody.vue";
import SMessage from "@/layouts/core/SNotify.vue";
import AppWorkspaceSidebar from "@/layouts/menus/AppWorkspaceSidebar.vue";
import AppUserMenu from "@/shared/components/widgets/AppUserMenu.vue";
import {
  canAccessAdmin,
  canAccessProcessManagement,
  canReadResource,
  hasAnyRole,
  isAdminUser
} from "@/core/utils/accessControl.js";

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
    default: "home"
  },
  photo: {
    type: String,
    default: "/images/avatar.png"
  },
  username: {
    type: String,
    default: "Usuario"
  },
  sidebarSubtitle: {
    type: String,
    default: "Cuenta institucional"
  },
  signatureMarker: {
    type: String,
    default: ""
  },
  showSidebarSignatureDetails: {
    type: Boolean,
    default: false
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
  "photo-selected",
  "primary-nav"
]);

const route = useRoute();

const isAuditorView = computed(() =>
  hasAnyRole(["Auditor"]) && !hasAnyRole(["AdminSistema"])
);

const showSignatureAction = computed(() =>
  !isAdminUser() && !isAuditorView.value && canReadResource("signature_flows")
);

const canShowAdminNav = computed(() =>
  canAccessAdmin() &&
  (
    hasAnyRole(["AdminSistema", "GestorSeguridad", "Auditor"]) ||
    canReadResource("security")
  )
);

const canShowProcessManagementNav = computed(() =>
  !isAuditorView.value &&
  canAccessProcessManagement()
);

const primaryNavItems = computed(() => {
  const adminOnly = isAdminUser();
  const items = [
    {
      key: "home",
      label: "Inicio",
      to: { name: "home" },
      icon: IconHome,
      hideForAdminOnly: true,
      exactRouteNames: ["home"]
    },
    {
      key: "processes",
      label: "Procesos",
      to: { name: "process-management" },
      icon: IconSitemap,
      hideForAuditor: true,
      requiresProcessManagement: true,
      exactRouteNames: ["process-management"]
    },
    {
      key: "documents",
      label: "Documentos",
      to: { name: "home-documents" },
      icon: IconFileText,
      hideForAdminOnly: true,
      requiresResource: "documents",
      exactRouteNames: ["home-documents"]
    },
    {
      key: "signatures",
      label: "Firmas",
      to: { name: "home-signatures" },
      icon: IconSignature,
      hideForAdminOnly: true,
      hideForAuditor: true,
      requiresResource: "signature_flows",
      exactRouteNames: ["home-signatures"]
    },
    /* ⚠️ AQUI ESTABA EL ITEM «Perfil» — se fue al menu de la esquina el 2026-08-16.
       Al montar `AppUserMenu` quedaba DUPLICADO: el mismo destino en la navegacion primaria y en
       el menu del avatar, a dos centimetros uno de otro. La receta §3.5 lo pone en el menu, y es
       donde lo busca cualquiera: el perfil se abre desde tu propia cara, no desde el menu de
       secciones. Su condicion de visibilidad viaja con el —`requiresResource: "dossier"` y oculto
       para el administrador, que tiene `/perfil` bloqueado por el router—. */
    {
      key: "admin",
      label: "Sistema",
      to: { name: "admin" },
      icon: IconSettings,
      requiresAdminAccess: true,
      exactRouteNames: ["admin"]
    }
  ];

  return items.filter((item) => {
    if (adminOnly && item.hideForAdminOnly) return false;
    if (isAuditorView.value && item.hideForAuditor) return false;
    if (item.requiresProcessManagement && !canShowProcessManagementNav.value) return false;
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
