import httpClient from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";
import AuthService from "./AuthService";

/**
 * El estado de verificación de la cuenta, y los dos pasos que lo completan.
 *
 * ⚠️ **NO SE GUARDA EN NINGUNA PARTE, SE PREGUNTA.** La copia del usuario que hay en
 * `localStorage` es la del momento en que se inició sesión, y el estado cambia por fuera del
 * navegador: el correo se verifica pulsando un enlace, y el teléfono lo confirma un mensaje que
 * llega a `channels`. Cachearlo produciría un guardián que manda a verificar algo ya verificado —y
 * el usuario no tendría forma de salir del bucle.
 */
class VerificacionService {
  /** Qué le falta a quien tiene la sesión abierta. `null` si no hay sesión. */
  async estado() {
    if (!AuthService.getToken()) return null;
    const { data } = await httpClient.get(API_ROUTES.USERS_ME);
    const usuario = data?.user ?? data;
    return usuario?.verificacion ?? null;
  }

  /** El primer paso pendiente, en el orden del registro. `null` si no falta ninguno. */
  primerPasoPendiente(estado) {
    if (!estado) return null;
    // El correo va primero, y no es capricho: es la LLAVE DE ACCESO desde que se retiró el
    // documento. Sin él no habría a dónde volver si se pierde el teléfono.
    if (!estado.correo) return "correo";
    if (!estado.telefono) return "telefono";
    return null;
  }

  verificarCorreo(codigo) {
    return httpClient.post(API_ROUTES.USERS_ME_VERIFICAR_CORREO, { codigo });
  }

  reenviarCodigo() {
    return httpClient.post(API_ROUTES.USERS_ME_REENVIAR_CODIGO, {});
  }

  /** Pide la llave del teléfono. Devuelve los enlaces YA COMPUESTOS: la pantalla no los arma. */
  pedirVerificacionDeTelefono(telefonoId) {
    return httpClient.post(API_ROUTES.USERS_ME_VERIFICAR_TELEFONO(telefonoId), {});
  }
}

export default new VerificacionService();
