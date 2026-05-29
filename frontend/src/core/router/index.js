import { createRouter, createWebHistory } from "vue-router";
import Login from "@/modules/auth/views/LoginView.vue";
import Register from "@/modules/auth/views/RegisterView.vue";
import RecoverPassword from "@/modules/auth/views/RecoverPasswordView.vue";
import SystemBootstrapView from "@/modules/auth/views/SystemBootstrapView.vue";
import TermsView from "@/modules/auth/views/TermsView.vue";
import VerifyEmail from "@/modules/auth/views/VerifyEmail.vue";
import HomeView from "@/modules/home/views/HomeView.vue";
import IndexPage from "@/modules/perfil/views/PerfilView.vue";
import AdminView from "@/modules/admin/views/AdminView.vue";
import ProcessManagementView from "@/modules/procesos/views/ProcessManagementView.vue";
import { isTokenValid, clearAuthData } from "@/core/utils/tokenUtils.js";
import {
  canAccessAdmin,
  canAccessProcessManagement,
  getDefaultAuthenticatedRoute,
  isAdminUser
} from "@/core/utils/accessControl.js";
import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";
import SystemBootstrapService from "@/modules/auth/services/SystemBootstrapService";

const routes = [
  { path: "/", name: "login", component: Login },
  { path: "/home", name: "home", component: HomeView },
  { path: "/home/documentos", name: "home-documents", component: HomeView },
  { path: "/home/firmas", name: "home-signatures", component: HomeView },
  { path: "/perfil", name: "perfil", component: IndexPage },
  { path: "/register", name: "register", component: Register },
  { path: "/recover-password", name: "recover-password", component: RecoverPassword },
  { path: "/setup", name: "system-bootstrap", component: SystemBootstrapView },
  { path: "/terminos", name: "terminos", component: TermsView },
  { path: "/admin", name: "admin", component: AdminView, meta: { requiresAdminAccess: true } },
  { path: "/procesos", name: "process-management", component: ProcessManagementView, meta: { requiresProcessManagementAccess: true, managementSection: "processes" } },
  { path: '/verify-email', name: 'verify-email', component: VerifyEmail },
  {
    path: "/logout",
    name: "logout",
    beforeEnter: async () => {
      try {
        await axios.post(API_ROUTES.USERS_LOGOUT, {}, { withCredentials: true });
      } catch (error) {
        console.error('Error al cerrar sesión en el servidor:', error);
      }
      clearAuthData();
      return '/';
    }
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

const adminBlockedRouteNames = new Set([
  "home",
  "home-documents",
  "home-signatures",
  "perfil"
]);

router.beforeEach(async (to) => {
  const token = localStorage.getItem('token');
  const publicRoutes = ['/', '/register', '/recover-password', '/terminos', '/setup'];
  let bootstrapStatus = null;

  try {
    bootstrapStatus = await SystemBootstrapService.getStatus();
  } catch (error) {
    console.warn("No se pudo obtener el estado de bootstrap:", error?.message || error);
  }

  if (bootstrapStatus?.installationMode && bootstrapStatus.installationMode !== "normal") {
    if (token) {
      clearAuthData();
    }
    if (to.name !== "system-bootstrap") {
      return { name: "system-bootstrap" };
    }
    return;
  }

  if (bootstrapStatus?.installationMode === "normal" && to.name === "system-bootstrap") {
    if (token && isTokenValid(token)) {
      return getDefaultAuthenticatedRoute();
    }
    return "/";
  }

  if (publicRoutes.includes(to.path)) {
    if (token && isTokenValid(token) && to.path === '/') {
      return getDefaultAuthenticatedRoute();
    }
    if (token && !isTokenValid(token)) {
      clearAuthData();
    }
    return;
  }

  if (!token || !isTokenValid(token)) {
    if (token) clearAuthData();
    return '/';
  }

  if (isAdminUser() && adminBlockedRouteNames.has(to.name)) {
    return '/admin';
  }

  if (to.meta?.requiresProcessManagementAccess && !canAccessProcessManagement()) {
    return '/home';
  }

  if (to.meta?.requiresAdminAccess && !canAccessAdmin()) {
    return '/home';
  }
});

export default router;
