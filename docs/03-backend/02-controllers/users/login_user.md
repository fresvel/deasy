# login_user.js
## Descripción
Este archivo contiene el controlador para el inicio de sesión de usuarios.
## Funciones
### loginUser
- **Descripción**: Autentica a un usuario con cédula/email y contraseña, genera token.
- **Parámetros**: 
  - `req`: Objeto de solicitud con credenciales en `req.body` (cedula, email, password).
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con token, expiresIn, user.
  - Error: Respuesta de error 400, 401, o 500.
## Dependencias
- `AuthService` de `../../services/auth/AuthService.js`
- `AuthenticationError` de `../../errors/AuthenticationError.js`