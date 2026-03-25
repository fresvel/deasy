# reset_password.js

## Descripción

Este archivo contiene el controlador para el proceso de restablecimiento de contraseña, incluyendo solicitud, verificación y cambio.

## Funciones

### requestPasswordReset

- **Descripción**: Envía un código de restablecimiento al email del usuario.
- **Parámetros**: `req` (email en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.

### verifyResetCode

- **Descripción**: Verifica el código de restablecimiento enviado al email.
- **Parámetros**: `req` (email, code en body), `res`
- **Retorna**: JSON indicando si el código es válido.

### resetPassword

- **Descripción**: Cambia la contraseña si el código es válido.
- **Parámetros**: `req` (email, code, password, repassword en body), `res`
- **Retorna**: JSON con mensaje de éxito o error.

## Dependencias

- Servicios de `../../services/mail/reset_password.js`: sendResetCodeService, verifyResetCodeService, resetPasswordService.