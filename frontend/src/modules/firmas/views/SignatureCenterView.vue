<template>
  <AppWorkspaceShell
    :menu-open="menuOpen"
    :show-notify="showNotify"
    current-section="signatures"
    :photo="userPhoto"
    :username="userFullName"
    sidebar-subtitle="Centro de firmas"
    @menu-toggle="toggleMenu"
    @close-mobile="closeMenu"
    @notify="toggleNotify"
    @notify-close="closeNotify"
    @sign="openSidebarItem()"
    @primary-nav="revealSidebarForNav"
  >
    <template #header>
      <div class="deasy-context-header">
        <div class="deasy-context-header__copy">
          <div class="deasy-context-header__title">Centro de firmas</div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <SignatureSidebar
        :items="sidebarItems"
        :is-active="isSidebarItemActive"
        :workspace-icon-tone-class="workspaceIconToneClass"
        @open-item="openSidebarItem"
      />
    </template>

    <HomeSignatureEntry />
  </AppWorkspaceShell>
</template>

<script setup>
/**
 * Centro de firmas: /home/firmas.
 *
 * Antes era una rama de HomeView --literalmente dos lineas de plantilla dentro de un componente de
 * 5663--, porque tres rutas (/home, /home/documentos, /home/firmas) apuntaban al mismo fichero. El
 * corte sale barato porque el acoplamiento era CERO: la pantalla ya delegaba el 100% en
 * HomeSignatureEntry, y `homeSignatureItems` (el estado de firmas de HomeView) lo lee el dashboard,
 * no esta ruta.
 *
 * Lo que se trajo consigo: la lista del aside, las anclas y el watcher del hash. Eso era
 * enrutamiento anidado reimplementado a mano con `router.replace` + `scrollIntoView`, y es la mejor
 * prueba de que la pantalla pedia ruta propia: alguien ya necesito deep-link y lo resolvio sin el
 * router. Se conserva tal cual --convertir las anclas en rutas hijas es otro cambio y va aparte--.
 *
 * Lo que NO se trajo, a proposito: el handler `@refresh-home` de HomeSignatureEntry. En esta ruta
 * llamaba a `loadUserMenu()` --que no alimenta nada visible aqui: el aside de firmas es una lista
 * estatica-- y a `refreshActiveProcessPanel()`, que refresca un panel de OTRA pagina. Con las
 * paginas separadas, /home se vuelve a montar al volver y su onMounted recarga sus datos: quedan
 * mas frescos que antes, no menos.
 */
import { computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { IconChecklist, IconMessages, IconSearch, IconSignature } from "@tabler/icons-vue";
import AppWorkspaceShell from "@/layouts/workspace/AppWorkspaceShell.vue";
import HomeSignatureEntry from "@/modules/home/components/HomeSignatureEntry.vue";
import SignatureSidebar from "@/modules/firmas/components/SignatureSidebar.vue";
import { useWorkspaceChrome } from "@/shared/composables/useWorkspaceChrome.js";
import { workspaceIconToneClass } from "@/shared/utils/workspaceNavIcons.js";
import { getStoredUser } from "@/core/utils/accessControl.js";

const DEFAULT_HASH = "#signature-home";

const route = useRoute();
const router = useRouter();
const { isClient, menuOpen, showNotify, toggleMenu, closeMenu, toggleNotify, closeNotify, revealSidebarForNav } =
  useWorkspaceChrome();

const currentUser = computed(() => getStoredUser());
const userPhoto = computed(() => currentUser.value?.photo || "/images/avatar.png");
const userFullName = computed(() => {
  const firstName = currentUser.value?.first_name ?? "";
  const lastName = currentUser.value?.last_name ?? "";
  return `${firstName} ${lastName}`.trim() || "Usuario";
});

const sidebarItems = computed(() => [
  { key: "home", label: "Inicio de firmas", icon: IconSignature, tone: "sky", hash: DEFAULT_HASH },
  { key: "request", label: "Solicitar firmas", icon: IconMessages, tone: "sky", hash: "#signature-launcher-request" },
  { key: "received", label: "Solicitudes recibidas", icon: IconMessages, tone: "sky", hash: "#signature-launcher-received" },
  { key: "database", label: "Buscar en BD", icon: IconSearch, tone: "sky", hash: "#signature-launcher-database" },
  { key: "pending", label: "Bandeja de pendientes", icon: IconChecklist, tone: "sky", hash: "#signature-launcher-pending" }
]);

const scrollToAnchor = async (hash) => {
  if (!isClient || !hash) return;
  await nextTick();
  requestAnimationFrame(() => {
    document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};

const openSidebarItem = async (item) => {
  const targetHash = item?.hash || DEFAULT_HASH;
  if (route.hash !== targetHash) {
    await router.replace({ name: "home-signatures", hash: targetHash });
  }
  await scrollToAnchor(targetHash);
};

const isSidebarItemActive = (item) => (route.hash || DEFAULT_HASH) === (item?.hash || DEFAULT_HASH);

watch(
  () => route.hash,
  async (hash) => {
    if (hash) await scrollToAnchor(hash);
  },
  { immediate: true }
);
</script>
