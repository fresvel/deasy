# 📱 Bot de WhatsApp - DEASY PUCESE

Bot conversacional integrado con WhatsApp Web para el sistema DEASY PUCESE.

## 🚀 Instalación

Las dependencias ya están instaladas:

- `whatsapp-web.js` - Cliente de WhatsApp Web
- `qrcode-terminal` - Generador de códigos QR en terminal

## 📋 Configuración Inicial

### 1. Iniciar el Bot

**Método 1: API REST**

```bash
POST http://localhost:3000/easym/v1/whatsapp/initialize
```

**Método 2: Iniciar automáticamente con el servidor**
Agrega al final de `backend/index.js`:

```javascript
import whatsappBot from './services/whatsapp/WhatsAppBot.js';

// Iniciar bot automáticamente
whatsappBot.initialize();
```

### 2. Escanear Código QR

1. Al iniciar el bot, aparecerá un código QR en la consola del servidor
2. Abre WhatsApp en tu teléfono
3. Ve a **Configuración > Dispositivos vinculados > Vincular un dispositivo**
4. Escanea el código QR
5. Espera el mensaje: `✅ Bot de WhatsApp está listo!`

## 🎯 Endpoints Disponibles

### Inicializar Bot

```http
POST /easym/v1/whatsapp/initialize
```

**Respuesta:**

```json
{
  "success": true,
  "message": "Bot de WhatsApp iniciando...",
  "info": "Escanea el código QR en la consola del servidor"
}
```

### Obtener Estado

```http
GET /easym/v1/whatsapp/status
```

**Respuesta:**

```json
{
  "success": true,
  "status": {
    "isReady": true,
    "hasQR": false,
    "qrCode": null
  }
}
```

### Enviar Mensaje

```http
POST /easym/v1/whatsapp/send-message

Content-Type: application/json

{
  "phoneNumber": "593987654321",
  "message": "Hola desde DEASY PUCESE"
}
```

### Enviar Código de Verificación

```http
POST /easym/v1/whatsapp/send-verification

Content-Type: application/json

{
  "phoneNumber": "593987654321",
  "code": "123456"
}
```

### Enviar Mensaje de Bienvenida

```http
POST /easym/v1/whatsapp/send-welcome

Content-Type: application/json

{
  "phoneNumber": "593987654321",
  "userName": "Juan Pérez"
}
```

### Destruir Bot

```http
DELETE /easym/v1/whatsapp/destroy
```

## 💬 Comandos del Bot

Cuando un usuario escribe al bot, puede usar estos comandos:

- **hola** / **hi** / **hello** - Saludo inicial
- **menu** - Ver menú principal
- **ayuda** / **help** - Información de ayuda
- **info** - Información del sistema
- **1** - Información de registro
- **2** - Consultar estado
- **3** / **soporte** - Soporte técnico
- **4** - Horarios de atención
- **estado [cédula]** - Consultar estado por cédula

### Ejemplo de Conversación

```
Usuario: hola
Bot: ¡Hola Juan! 👋

Soy el Bot de *DEASY PUCESE*.

¿En qué puedo ayudarte?

Comandos disponibles:
• *menu* - Ver opciones
• *ayuda* - Información de ayuda
• *info* - Información del sistema

Usuario: menu
Bot: 📋 *MENÚ PRINCIPAL*

1️⃣ Información de registro
2️⃣ Consultar estado
3️⃣ Soporte técnico
4️⃣ Horarios de atención

Escribe el número de la opción que deseas.
```

## 🔗 Integración con Registro

El bot se integra automáticamente con el registro de usuarios. Cuando un usuario se registra exitosamente, recibe un mensaje de bienvenida por WhatsApp.

**Código en `user_controler.js`:**

```javascript
import whatsappBot from "../../services/whatsapp/WhatsAppBot.js";

// Después de crear usuario exitosamente
if (whatsappBot.isReady && req.body.whatsapp) {
    const userName = `${req.body.nombre} ${req.body.apellido}`;
    await whatsappBot.sendWelcomeMessage(req.body.whatsapp, userName);
}
```

## 📝 Formato de Números de Teléfono

Los números deben estar en formato internacional **sin** el símbolo `+`:

✅ **Correcto:**

- `593987654321` (Ecuador)
- `57312345678` (Colombia)
- `51987654321` (Perú)

❌ **Incorrecto:**

- `+593987654321`
- `0987654321`

El bot agrega automáticamente `@c.us` al final.

## ⚠️ Consideraciones Importantes

### 1. **Mantener Sesión Activa**

- El servidor debe estar corriendo 24/7
- No cierres el servidor o se perderá la sesión
- La sesión se guarda en `./whatsapp-sessions`

### 2. **Riesgo de Baneo**

- WhatsApp puede detectar uso automatizado
- **Solo para pruebas**, no usar en producción
- Para producción, migrar a WhatsApp Business API oficial

### 3. **Rendimiento**

- El bot usa Puppeteer (Chrome headless)
- Requiere ~200-300MB de RAM
- En servidores con pocos recursos, puede ser lento

### 4. **Backup de Sesión**

```bash
# Hacer backup de la sesión
cp -r whatsapp-sessions whatsapp-sessions-backup
```

## 🐛 Troubleshooting

### Error: "El bot no está listo"

**Solución:** Escanea el código QR primero

### Error: "Fallo de autenticación"

**Solución:**

1. Elimina la carpeta `whatsapp-sessions`
2. Reinicia el servidor
3. Escanea un nuevo código QR

### El bot no responde a mensajes

**Solución:**

1. Verifica que el bot esté listo: `GET /easym/v1/whatsapp/status`
2. Revisa la consola del servidor para ver los logs
3. Intenta destruir y reinicializar el bot

### Error de conexión

**Solución:**

```bash
# Reinstalar dependencias
bun remove whatsapp-web.js
bun add whatsapp-web.js
```

## 🔐 Seguridad

**IMPORTANTE:**

- ⚠️ No expongas las rutas de WhatsApp sin autenticación
- ⚠️ Agrega middleware de autenticación a las rutas sensibles
- ⚠️ No subas la carpeta `whatsapp-sessions` a Git

**Agregar al `.gitignore`:**

```
whatsapp-sessions/
```

## 📊 Monitoreo

Ver logs del bot en la consola:

```bash
# Logs importantes
✅ Bot de WhatsApp está listo!
📱 Escanea el código QR con tu WhatsApp:
📨 Mensaje de Juan Pérez: hola
✅ Mensaje enviado a 593987654321
❌ Error al procesar mensaje
🔌 Cliente desconectado
```

## 🎯 Próximas Mejoras

- [ ] Agregar autenticación a las rutas
- [ ] Implementar rate limiting
- [ ] Agregar logs a base de datos
- [ ] Implementar cola de mensajes
- [ ] Migrar a WhatsApp Business API (producción)
- [ ] Agregar soporte para multimedia
- [ ] Implementar webhooks

## 📞 Soporte

Para más información sobre whatsapp-web.js:

- [Documentación oficial](https://docs.wwebjs.dev/)
- [GitHub](https://github.com/pedroslopez/whatsapp-web.js)

---

**Desarrollado para DEASY PUCESE - PUCE Sede Esmeraldas**
