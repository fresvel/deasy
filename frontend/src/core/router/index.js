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
import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

const routes = [
  { path: "/", name: "login", component: Login },
  { path: "/dashboard", name: "dashboard", component: DashboardHome },
  { path: "/perfil", name: "perfil", component: IndexPage },
  { path: "/register", name: "register", component: Register },
  { path: "/recover-password", name: "recover-password", component: RecoverPassword },
  { path: "/terminos", name: "terminos", component: TermsView },
  { path: "/admin", name: "admin", component: AdminView },
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
