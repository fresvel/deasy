import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";

class AuthService {
  constructor() {
    this.TOKEN_KEY = "token";
    this.USER_KEY = "user";
  }

  /**
   * SÓLO CORREO desde el 2026-08-29.
   *
   * Aquí había un `identifier.includes("@")` que decidía si lo escrito era un correo o una cédula, y
   * en el segundo caso un `.replace(/\D/g, "")` que borraba TODO lo que no fuera dígito. Con eso el
   * pasaporte `AB123456` salía como `123456` mientras el backend esperaba `AB123456`: el login por
   * pasaporte estaba roto desde la pantalla, y no se notaba porque todos los documentos sembrados
   * eran cédulas.
   *
   * Ya no hay nada que adivinar.
   */
  async login(email, password) {
    const correo = String(email ?? "").trim().toLowerCase();
    if (!correo) {
      throw new Error("Ingresa tu correo electrónico");
    }
    const response = await axios.post(API_ROUTES.USERS_LOGIN, { email: correo, password }, {
      withCredentials: true,
    });

    if (response.data.token) {
      this.setToken(response.data.token);
    }

    if (response.data.user) {
      this.setUser(response.data.user);
    }

    return response.data;
  }

  async register(userData) {
    const response = await axios.post(`${API_ROUTES.USERS}`, userData);
    return response.data;
  }

  // «Olvidé mi correo». Pide la contraseña a propósito: sin ella el endpoint seria un directorio de
  // cedulas. Ver `RecuperarCorreoService` en el backend.
  async recuperarCorreo({ tipo, pais, numero, password }) {
    const response = await axios.post(API_ROUTES.USERS_RECUPERAR_CORREO, { tipo, pais, numero, password });
    return response.data ?? {};
  }

  // La institución de este despliegue. La pantalla de registro la necesita para saber cómo llamar al
  // documento nacional: hasta el 2026-08-29 llevaba «Cédula (Ecuador)» escrito en una lista.
  async institucion() {
    const response = await axios.get(API_ROUTES.SYSTEM_INSTITUCION);
    return response.data ?? null;
  }

  // El catálogo geográfico, PÚBLICO: lo pide el formulario de registro, que por definición usa
  // quien todavía no tiene cuenta. Sustituye a `core/constants/countries.js` para la dirección
  // (el selector de prefijo telefónico sigue usándolo hasta que se rehagan los teléfonos).
  async listarPaises() {
    const response = await axios.get(API_ROUTES.SYSTEM_GEO_PAISES);
    return response.data?.data ?? [];
  }

  async listarProvincias(paisIso) {
    const response = await axios.get(API_ROUTES.SYSTEM_GEO_PROVINCIAS(paisIso));
    return response.data?.data ?? [];
  }

  async listarCiudades(provinciaId) {
    const response = await axios.get(API_ROUTES.SYSTEM_GEO_CIUDADES(provinciaId));
    return response.data?.data ?? [];
  }

  async recoverPassword(email) {
    const response = await axios.post(API_ROUTES.USERS_RECOVER_PASSWORD, {
      email,
    });
    return response.data;
  }

  async verifyResetCode(email, code) {
    const response = await axios.post(API_ROUTES.USERS_VERIFY_RESET_CODE, {
      email,
      code,
    });
    return response.data;
  }

  async resetPassword(email, code, password, repassword) {
    const response = await axios.post(API_ROUTES.USERS_RESET_PASSWORD, {
      email,
      code,
      password,
      repassword,
    });
    return response.data;
  }

  async logout() {
    try {
      await axios.post(API_ROUTES.USERS_LOGOUT, {}, { withCredentials: true });
    } catch (error) {
      console.warn("Error en logout:", error);
    } finally {
      this.clearSession();
    }
  }

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getUser() {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  getCedula() {
    const user = this.getUser();
    return user?.cedula || null;
  }

  getUserRole() {
    const user = this.getUser();
    return user?.role || null;
  }
}

export default new AuthService();
