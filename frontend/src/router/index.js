import { createRouter, createWebHistory} from "vue-router";
import Login from "../views/system/LoginView.vue";
import Register from "../views/system/RegisterView.vue";
import InformePlogros from "../views/informes/programas/LogrosView.vue";
import IndexPage from "../views/system/IndexPage.vue";

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
    path: "/informes/docentes/logros",
    name: "iplogros",
    component: InformePlogros,
  }

]


const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;