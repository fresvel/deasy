import { createRouter, createWebHistory} from "vue-router";
import Login from "../views/login/LoginView.vue";
import Register from "../views/login/RegisterView.vue";
import IndexPage from "../views/logged/LoggedView.vue";
//import IndexPage from "../views/logged/informes/WebTemplate.vue";

import FirmarPdf from "@/views/logged/funciones/FirmarView.vue";

import AcademiaView from "@/views/logged/academia/AcademiaView.vue";
const routes = [
  {
    path: "/",
    name: "index",
    component: IndexPage
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
    path: "/firmar",
    name: "firmar",
    component: FirmarPdf,
  },

  {
    path: "/academia",
    name: "academia",
    component:AcademiaView
  }

]


const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;