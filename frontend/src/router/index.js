import { createRouter, createWebHistory} from "vue-router";
import Login from "../pages/login/LoginView.vue";
import Register from "../pages/login/RegisterView.vue";
import DashboardHome from "../pages/logged/DashboardHome.vue";
import IndexPage from "../pages/logged/LoggedView.vue";
import { isTokenValid, clearAuthData } from "../utils/tokenUtils.js";
import axios from "axios";
import { API_ROUTES } from "../services/apiConfig";

import FirmarPdf from "../pages/logged/funciones/FirmarView.vue";
import AdminView from "../pages/admin/AdminView.vue";
import RolesView from "../pages/logged/RolesView.vue";
const routes = [
  {
    path: "/",
    name: "login",
    component: Login
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: DashboardHome
  },
  {
    path: "/perfil",
    name: "perfil",
    component: IndexPage
  },
  {
    path: "/register",
    name: "register",
    component: Register
  },
  {
    path: "/firmar",
    name: "firmar",
    component: FirmarPdf,
  },
  {
    path: "/admin",
    name: "admin",
    component: AdminView,
  },
  {
    path: "/roles",
    name: "roles",
    component: RolesView,
  },
  {
    path: "/logout",
    name: "logout",
    beforeEnter: async (to, from, next) => {
      try {
        // Llamar al endpoint de logout del backend para limpiar la cookie del refreshToken
        await axios.post(API_ROUTES.USERS_LOGOUT, {}, { withCredentials: true });
      } catch (error) {
        // Si falla, continuar de todas formas para limpiar el frontend
        console.error('Error al cerrar sesión en el servidor:', error);
      }
      
      // Limpiar cookies/tokens/datos de usuario del frontend
      clearAuthData();
      
      console.log('🔓 Sesión cerrada');
      
      // Redirigir al login
      next('/');
    }
  }

]


const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

// Guard para proteger rutas que requieren autenticación
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const publicRoutes = ['/', '/register'];
  
  // Si la ruta es pública, permitir acceso
  if (publicRoutes.includes(to.path)) {
    // Si hay token válido y está intentando acceder a la raíz (login), redirigir al dashboard
    if (token && isTokenValid(token) && to.path === '/') {
      next('/dashboard');
      return;
    }
    
    // Si el token está expirado, limpiarlo antes de continuar
    if (token && !isTokenValid(token)) {
      clearAuthData();
    }
    
    next();
    return;
  }
  
  // Si no hay token o está expirado, limpiar y redirigir al login
  if (!token || !isTokenValid(token)) {
    if (token) {
      // El token existe pero está expirado, limpiarlo
      clearAuthData();
    }
    next('/');
    return;
  }
  
  next();
});

export default router;
