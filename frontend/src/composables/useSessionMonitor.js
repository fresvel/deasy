import { useRouter } from 'vue-router';
import { isTokenExpired, clearAuthData } from '@/utils/tokenUtils';

/**
 * Composable para monitorear la sesión del usuario
 * Detecta cuando el token está por expirar y muestra un modal
 */
export function useSessionMonitor(sessionModalRef) {
  const router = useRouter();
  let checkInterval = null;
  let warningShown = false;

  // Tiempo antes de la expiración para mostrar el warning (en minutos)
  const WARNING_TIME_BEFORE_EXPIRY = 5; // 5 minutos antes

  const decodeToken = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
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
      // No hay token, limpiar y redirigir
      clearAuthData();
      router.push('/');
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

  // No usar onMounted aquí, se llamará desde el componente
  // onMounted(() => {
  //   const token = localStorage.getItem('token');
  //   // Solo monitorear si hay un token
  //   if (token) {
  //     startMonitoring();
  //   }
  // });

  onBeforeUnmount(() => {
    stopMonitoring();
  });

  return {
    startMonitoring,
    stopMonitoring,
    resetWarning,
    checkSession
  };
}
