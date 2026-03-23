import axios from "axios";
import { API_ROUTES } from "../apiConfig";

class AuthService {
  constructor() {
    this.TOKEN_KEY = "token";
    this.USER_KEY = "user";
  }

  async login(identifier, password) {
    const body = {
      password: password,
    };

    const trimmedIdentifier = identifier.trim();

    if (trimmedIdentifier.includes("@")) {
      body.email = trimmedIdentifier.toLowerCase();
    } else {
      body.cedula = trimmedIdentifier.replace(/\D/g, "");
    }

    if (!body.email && !body.cedula) {
      throw new Error("Ingresa tu cédula o correo electrónico");
    }

    if (body.cedula && body.cedula.length !== 10) {
      throw new Error("La cédula debe contener 10 dígitos");
    }

    const response = await axios.post(API_ROUTES.USERS_LOGIN, body, {
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

  async recoverPassword(email) {
    const response = await axios.post(API_ROUTES.USERS_RECOVER_PASSWORD, {
      email,
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

  async verifyEmail(code) {
    const response = await axios.post(API_ROUTES.VERIFY_EMAIL, { code });
    return response.data;
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