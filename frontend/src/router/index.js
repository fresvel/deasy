import { createRouter, createWebHistory} from "vue-router";
import Login from "../views/login/LoginView.vue";
import Register from "../views/login/RegisterView.vue";
import InformePlogros from "../views/informes/programas/LogrosView.vue";
import IndexPage from "../views/logged/LoggedView.vue";
import AuthView from "@/views/AuthView.vue";
import Perfil from "@/views/procesos/perfil/PerfilView.vue";
import AgregarFormacion from "@/views/procesos/perfil/TitulosView.vue";
import FirmarPdf from "@/views/procesos/funciones/FirmarView.vue";
const routes = [
  {
    path: "/",
    name: "index",
    component: IndexPage
  },
  
  {
    path: "/auth",
    name: "auth",
    component: AuthView,
  },


  {
    path: "/login",
    name: "login",
    component: Login
  },
  {
    path: "/register",
    name: "register",
    component: Register
  },
  {
    path: "/perfil",
    name: "perfil",
    component: Perfil
  },
  {
    path: "/formacion",
    name: "formacion",
    component: AgregarFormacion
  },
  {
    path: "/informes/docentes/logros",
    name: "iplogros",
    component: InformePlogros,
  },

  {
    path: "/firmar",
    name: "firmar",
    component: FirmarPdf,
  }

]


const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;