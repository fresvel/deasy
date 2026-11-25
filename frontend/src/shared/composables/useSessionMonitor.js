import { isTokenExpired } from '@/core/utils/tokenUtils';

/**
 * Composable para monitorear la sesión del usuario
 * Detecta cuando el token está por expirar y muestra un modal
 */
export function useSessionMonitor(sessionModalRef) {
  let checkInterval = null;
  let warningShown = false;

  // Tiempo antes de la expiración para mostrar el warning (en minutos)
  const WARNING_TIME_BEFORE_EXPIRY = 5; // 5 minutos antes

  const decodeToken = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replaceAll("-", '+').replaceAll("_", '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error al decodificar token:', error);
      return null;
    }
  };

  const getTimeUntilExpiry = (token) => {
    if (!token) return null;

    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - currentTime; // en segundos
    return timeUntilExpiry;
  };

  const checkSession = () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        // ⚠️ SIN TOKEN NO SE REDIRIGE A NADIE: SE DEJA DE VIGILAR.
        //
        // «No hay sesion» NO es «la sesion caduco». Este monitor existe para AVISAR antes de que
        // un token expire; decidir quien puede estar en una ruta es del guard del router, y del
        // backend. Al hacerlo tambien aqui, cualquiera que se quedara en una pantalla sin sesion
        // --el registro, por ejemplo-- salia disparado al acceso al minuto, perdiendo todo lo que
        // hubiera escrito. Reportado por el dueno el 2026-08-31 rellenando el formulario.
        stopMonitoring();
      return;
    }

    // Verificar si el token está expirado
    if (isTokenExpired(token)) {
      // Token expirado, mostrar modal inmediatamente
      if (sessionModalRef.value && !warningShown) {
        warningShown = true;
        sessionModalRef.value.show();
      }
      return;
    }

    // Verificar si está cerca de expirar
    const timeUntilExpiry = getTimeUntilExpiry(token);
    if (timeUntilExpiry === null) {
      return;
    }

    const minutesUntilExpiry = timeUntilExpiry / 60;

    // Si está dentro del tiempo de advertencia y no se ha mostrado el warning
    if (minutesUntilExpiry <= WARNING_TIME_BEFORE_EXPIRY && !warningShown) {
      if (sessionModalRef.value) {
        warningShown = true;
        sessionModalRef.value.show();
      }
    }
  };

  const startMonitoring = () => {
    // ⚠️ SE PARA ANTES DE ARRANCAR. Sin esto, cada llamada dejaba el intervalo ANTERIOR corriendo
    // --`setInterval` devuelve un asa nueva y la vieja se perdia sin limpiar--, asi que navegar
    // entre dos rutas con sesion acumulaba vigilantes huerfanos. Despues `stopMonitoring()` solo
    // apagaba el ultimo, y los demas seguian disparando en pantallas donde no pintaban nada.
    //
    // Es la mitad del fallo que sacaba a la gente del registro al minuto: un vigilante zombi de
    // una navegacion anterior.
    stopMonitoring();
    // Verificar cada minuto
    checkInterval = setInterval(checkSession, 60 * 1000);
    
    // Verificar inmediatamente al iniciar
    checkSession();
  };

  const stopMonitoring = () => {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    warningShown = false;
  };

  const resetWarning = () => {
    warningShown = false;
  };

  return {
    startMonitoring,
    stopMonitoring,
    resetWarning,
    checkSession
  };
}
