# verify_email.js
## Descripción
Este archivo contiene el controlador para verificar códigos de verificación de email.

El envío del código lo hace el servicio `services/mail/sendEmailVerification.js`, invocado al
crear un usuario (`POST /deasy/v1/users`). El endpoint `POST /deasy/v1/email/send-verification`
existió como duplicado de ese servicio y se retiró por no tener clientes.
## Funciones
### verifyEmail
- **Descripción**: Verifica el código de verificación enviado al email.
- **Parámetros**: `req` con user_id y code en body, `res`
- **Retorna**: JSON con mensaje de verificación o error.
## Dependencias
- `verifyEmailCode` de `../../services/mail/emailVerification.js`