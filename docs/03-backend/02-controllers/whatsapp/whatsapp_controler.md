# whatsapp_controler.js
## Descripción
Este archivo contiene el controlador para gestionar el bot de WhatsApp, incluyendo inicialización, envío de mensajes y códigos de verificación.
## Funciones
### initializeBot
- **Descripción**: Inicializa el bot de WhatsApp.
- **Parámetros**: `req`, `res`
- **Retorna**: JSON con mensaje de inicio o error.
### getBotStatus
- **Descripción**: Obtiene el estado actual del bot.
- **Parámetros**: `req`, `res`
- **Retorna**: JSON con estado del bot.
### sendMessage
- **Descripción**: Envía un mensaje a un número de teléfono.
- **Parámetros**: `req` con phoneNumber y message en body, `res`
- **Retorna**: JSON con resultado del envío.
### sendVerificationCode
- **Descripción**: Envía un código de verificación a un número.
- **Parámetros**: `req` con phoneNumber y code en body, `res`
- **Retorna**: JSON con resultado.
### sendWelcomeMessage
- **Descripción**: Envía un mensaje de bienvenida a un usuario.
- **Parámetros**: `req` con phoneNumber y userName en body, `res`
- **Retorna**: JSON con resultado.
### destroyBot
- **Descripción**: Destruye la instancia del bot de WhatsApp.
- **Parámetros**: `req`, `res`
- **Retorna**: JSON con mensaje de destrucción.
## Dependencias
- `whatsappBot` de `../../services/whatsapp/WhatsAppBot.js`