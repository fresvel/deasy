# verify_email.js
## Descripción
Este archivo contiene el controlador para enviar y verificar códigos de verificación de email.
## Funciones
### sendVerificationEmail
- **Descripción**: Genera y envía un código de verificación por email al usuario.
- **Parámetros**: `req` con user_id y to (email) en body, `res`
- **Retorna**: JSON con mensaje de éxito o error.
### verifyEmail
- **Descripción**: Verifica el código de verificación enviado al email.
- **Parámetros**: `req` con user_id y code en body, `res`
- **Retorna**: JSON con mensaje de verificación o error.
## Dependencias
- `fs`, `path` para leer templates.
- `transporter` de `../../lib/mailer.js`
- `generateVerificationCode` de `../../utils/email/generateCode.js`
- `saveEmailVerificationCode` de `../../services/mail/saveEmailVerificationCode.js`
- `verifyEmailCode` de `../../services/mail/emailVerification.js`