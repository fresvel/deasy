import { createRouter, createWebHistory} from "vue-router";
import Login from "../views/login/LoginView.vue";
import Register from "../views/login/RegisterView.vue";
import IndexPage from "../views/logged/LoggedView.vue";

import FirmarPdf from "@/views/logged/funciones/FirmarView.vue";

const routes = [
  {
    path: "/",
    name: "login",
    component: Login
  },
  {
    path: "/dashboard",
    name: "dashboard",
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
    path: "/logout",
    name: "logout",
    beforeEnter: (to, from, next) => {
      // Limpiar cookies/tokens/datos de usuario
      document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();
      
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
    // Si hay token y está intentando acceder a la raíz (login), redirigir al dashboard
    if (token && to.path === '/') {
      next('/dashboard');
      return;
    }
    next();
    return;
  }
  
  // Si no hay token y no es una ruta pública, redirigir al login
  if (!token) {
    next('/');
    return;
  }
  
  next();
});

export default router;