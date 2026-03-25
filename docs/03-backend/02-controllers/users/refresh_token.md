# refresh_token.js
## Descripción
Este archivo contiene el controlador para refrescar el token de acceso utilizando el refreshToken de la cookie.
## Funciones
### refreshToken
- **Descripción**: Verifica el refreshToken y genera un nuevo access token.
- **Parámetros**: `req` (refreshToken en cookies), `res`
- **Retorna**: 
  - Éxito: JSON con nuevo token y expiresIn.
  - Error: Respuesta de error 401 o 500.
## Dependencias
- `jwt` para verificación.
- `generateToken` de `../../utils/login/generate_token.js`