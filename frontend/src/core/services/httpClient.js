// Cliente HTTP de la aplicacion.
//
// Es una INSTANCIA propia (`axios.create()`), no el singleton global de axios. La diferencia importa:
// antes este modulo registraba el interceptor sobre `axios` global y hacia `export default axios`, asi
// que la cabecera `Authorization` de toda la aplicacion dependia de que `main.js` importara este fichero
// antes que nadie. Eso es orden de imports, no diseno. Ahora la cabecera la pone la instancia, y quien
// no la use simplemente no lleva token (falla en claro con un 401) en vez de funcionar por suerte.
//
// Regla: en `frontend/src` no se importa `axios` a pelo. Se importa este modulo.
//
// Sobre la URL base: NO se fija `baseURL` a proposito. La base ya esta centralizada en
// `core/config/apiConfig.js` (`API_PREFIX` / `API_ROUTES`, que resuelven `VITE_API_BASE_URL`) y todas
// las llamadas del frontend pasan una URL absoluta construida ahi. Un `baseURL` aqui seria inerte hoy
// —axios lo ignora cuando la URL es absoluta— y crearia una segunda fuente de verdad para la misma base.
import axios from "axios";

const httpClient = axios.create();

httpClient.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : "";
  if (!token) {
    return config;
  }

  config.headers = config.headers || {};
  config.headers.Authorization = config.headers.Authorization || `Bearer ${token}`;
  return config;
});

export default httpClient;
