/**
 * Utilidades para validar y gestionar tokens JWT
 */

/**
 * Decodifica un token JWT sin verificar la firma
 * Solo para obtener información del payload (como la expiración)
 */
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

/**
 * Verifica si un token JWT está expirado
 * @param {string} token - Token JWT a validar
 * @returns {boolean} - true si el token está expirado o es inválido, false si aún es válido
 */
export const isTokenExpired = (token) => {
  if (!token) {
    return true;
  }

  try {
    const decoded = decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      return true;
    }

    // exp está en segundos, Date.now() está en milisegundos
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Si la expiración es menor al tiempo actual, el token está expirado
    return decoded.exp < currentTime;
  } catch (error) {
    console.error('Error al validar token:', error);
    return true; // En caso de error, consideramos el token como inválido
  }
};

/**
 * Valida si un token existe y no está expirado
 * @param {string} token - Token JWT a validar
 * @returns {boolean} - true si el token es válido, false si no existe o está expirado
 */
export const isTokenValid = (token) => {
  return token && !isTokenExpired(token);
};

/**
 * Limpia todos los datos de autenticación del almacenamiento
 */
export const clearAuthData = () => {
  // Limpiar localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Limpiar sessionStorage
  sessionStorage.clear();
  
  // Limpiar cookie de refreshToken
  document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};

