import { createRouter, createWebHistory } from "vue-router";
import Login from "@/views/auth/LoginView.vue";
import Register from "@/views/auth/RegisterView.vue";
import RecoverPassword from "@/views/auth/RecoverPasswordView.vue";
import TermsView from "@/views/auth/TermsView.vue";
import VerifyEmail from "@/views/auth/VerifyEmail.vue";
import DashboardHome from "@/views/dashboard/DashboardHome.vue";
import IndexPage from "@/views/perfil/PerfilView.vue";
import FirmarPdf from "@/views/funciones/FirmarView.vue";
import AdminView from "@/views/admin/AdminView.vue";
import RolesView from "@/views/roles/RolesView.vue";
import { isTokenValid, clearAuthData } from "@/utils/tokenUtils.js";
import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";

const routes = [
  { path: "/", name: "login", component: Login },
  { path: "/dashboard", name: "dashboard", component: DashboardHome },
  { path: "/perfil", name: "perfil", component: IndexPage },
  { path: "/register", name: "register", component: Register },
  { path: "/recover-password", name: "recover-password", component: RecoverPassword },
  { path: "/terminos", name: "terminos", component: TermsView },
  { path: "/firmar", name: "firmar", component: FirmarPdf },
  { path: "/admin", name: "admin", component: AdminView },
  { path: "/roles", name: "roles", component: RolesView },
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

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const publicRoutes = ['/', '/register', '/recover-password', '/terminos'];

  if (publicRoutes.includes(to.path)) {
    if (token && isTokenValid(token) && to.path === '/') {
      return '/dashboard';
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
});

export default router;
