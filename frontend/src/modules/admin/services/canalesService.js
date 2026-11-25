import { API_ROUTES } from "@/core/config/apiConfig";
import axios from "@/core/services/httpClient";

/**
 * Cómo están los canales de mensajería.
 *
 * ⚠️ **`alcanzable: false` NO es un error que haya que capturar**: es el estado del sistema, y es
 * justo lo que se quería saber el día que el servicio estuvo trece horas muerto. El backend lo
 * devuelve con un **200** a propósito, para que la pantalla lo pinte en vez de enseñar «algo falló».
 */
export const obtenerEstadoDeCanales = async () => {
  const { data } = await axios.get(API_ROUTES.ADMIN_CANALES);
  return data;
};

/**
 * El código de vinculación de WhatsApp.
 *
 * ⚠️ Un **409** aquí es una BUENA noticia: significa que el canal no necesita vincularse. Se
 * distingue de un fallo porque son mensajes opuestos para quien mira.
 */
export const obtenerCodigoDeVinculacion = async () => {
  try {
    const { data } = await axios.get(API_ROUTES.ADMIN_CANALES_QR);
    return { hayQr: true, ...data };
  } catch (error) {
    if (error?.response?.status === 409) return { hayQr: false };
    throw error;
  }
};
