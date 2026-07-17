import { createRouter, createWebHistory } from "vue-router";
import Login from "@/modules/auth/views/LoginView.vue";
import Register from "@/modules/auth/views/RegisterView.vue";
import RecoverPassword from "@/modules/auth/views/RecoverPasswordView.vue";
import SystemBootstrapView from "@/modules/auth/views/SystemBootstrapView.vue";
import TermsView from "@/modules/auth/views/TermsView.vue";
import VerifyEmail from "@/modules/auth/views/VerifyEmail.vue";
import HomeView from "@/modules/home/views/HomeView.vue";
import SignatureCenterView from "@/modules/firmas/views/SignatureCenterView.vue";
import DocumentCenterView from "@/modules/home/views/DocumentCenterView.vue";
import PerfilView from "@/modules/perfil/views/PerfilView.vue";
import ProfileHomePanel from "@/modules/perfil/components/ProfileHomePanel.vue";
import TitulosSection from "@/modules/perfil/components/sections/TitulosSection.vue";
import LaboralSection from "@/modules/perfil/components/sections/LaboralSection.vue";
import ReferenciasSection from "@/modules/perfil/components/sections/ReferenciasSection.vue";
import CapacitacionSection from "@/modules/perfil/components/sections/CapacitacionSection.vue";
import CertificacionSection from "@/modules/perfil/components/sections/CertificacionSection.vue";
import InvestigacionSection from "@/modules/perfil/components/sections/InvestigacionSection.vue";
import CertificadosFirmaSection from "@/modules/perfil/components/sections/CertificadosFirmaSection.vue";
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
  { path: "/home", name: "home", component: HomeView, meta: { blockedForAdmin: true } },
  { path: "/home/documentos", name: "home-documents", component: DocumentCenterView, meta: { blockedForAdmin: true } },
  { path: "/home/firmas", name: "home-signatures", component: SignatureCenterView, meta: { blockedForAdmin: true } },
  // /perfil es un LAYOUT con rutas hijas: cada seccion del dossier tiene URL propia, asi que ya se puede
  // enlazar, recargar con F5 y volver con el boton atras. Antes eran 7 ficheros *View.vue que NO eran
  // rutas: pestanas conmutadas por un string en espanol con tilde.
  {
    path: "/perfil",
    component: PerfilView,
    // El meta se hereda a los hijos, asi que basta declararlo aqui para blindar /perfil/* entero.
    meta: { blockedForAdmin: true },
    children: [
      { path: "", name: "perfil", component: ProfileHomePanel },
      { path: "formacion", name: "perfil-formacion", component: TitulosSection },
      { path: "experiencia", name: "perfil-experiencia", component: LaboralSection },
      { path: "referencias", name: "perfil-referencias", component: ReferenciasSection },
      { path: "capacitacion", name: "perfil-capacitacion", component: CapacitacionSection },
      { path: "certificacion", name: "perfil-certificacion", component: CertificacionSection },
      { path: "investigacion", name: "perfil-investigacion", component: InvestigacionSection },
      { path: "certificados-firma", name: "perfil-certificados-firma", component: CertificadosFirmaSection }
    ]
  },
  { path: "/register", name: "register", component: Register },
  { path: "/recover-password", name: "recover-password", component: RecoverPassword },
  { path: "/setup", name: "system-bootstrap", component: SystemBootstrapView },
  { path: "/terminos", name: "terminos", component: TermsView },
  { path: "/admin/:section?/:item?/:table?", name: "admin", component: AdminView, meta: { requiresAdminAccess: true } },
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

  // Se mira el meta, no el nombre: con /perfil convertido en layout, sus hijos tienen nombre propio
  // (perfil-formacion...) y una lista de nombres los dejaria pasar. El meta lo heredan del padre.
  if (isAdminUser() && to.meta?.blockedForAdmin) {
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
