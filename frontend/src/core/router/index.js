import { createRouter, createWebHistory } from "vue-router";
import Login from "@/modules/auth/views/LoginView.vue";
import Register from "@/modules/auth/views/RegisterView.vue";
import RecoverPassword from "@/modules/auth/views/RecoverPasswordView.vue";
import TermsView from "@/modules/auth/views/TermsView.vue";
import VerifyEmail from "@/modules/auth/views/VerifyEmail.vue";
import DashboardHome from "@/modules/dashboard/views/DashboardHome.vue";
import IndexPage from "@/modules/perfil/views/PerfilView.vue";
import AdminView from "@/modules/admin/views/AdminView.vue";
import { isTokenValid, clearAuthData } from "@/core/utils/tokenUtils.js";
import { canAccessAdmin, getDefaultAuthenticatedRoute, isAdminUser } from "@/core/utils/accessControl.js";
import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

const routes = [
  { path: "/", name: "login", component: Login },
  { path: "/dashboard", name: "dashboard", component: DashboardHome },
  { path: "/dashboard/documentos", name: "dashboard-documents", component: DashboardHome },
  { path: "/dashboard/firmas", name: "dashboard-signatures", component: DashboardHome },
  { path: "/firmas/herramientas", redirect: { name: "dashboard-signatures" } },
  { path: "/perfil", name: "perfil", component: IndexPage },
  { path: "/register", name: "register", component: Register },
  { path: "/recover-password", name: "recover-password", component: RecoverPassword },
  { path: "/terminos", name: "terminos", component: TermsView },
  { path: "/admin", name: "admin", component: AdminView, meta: { requiresAdminAccess: true } },
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
  "dashboard",
  "dashboard-documents",
  "dashboard-signatures",
  "perfil"
]);

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const publicRoutes = ['/', '/register', '/recover-password', '/terminos'];

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

  if (to.meta?.requiresAdminAccess && !canAccessAdmin()) {
    return '/dashboard';
  }
});

export default router;
