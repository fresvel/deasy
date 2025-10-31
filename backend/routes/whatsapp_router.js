import express from 'express';
import * as whatsappController from '../controllers/whatsapp/whatsapp_controler.js';

const router = express.Router();

// Ruta para inicializar el bot
router.post('/initialize', whatsappController.initializeBot);

// Ruta para obtener el estado del bot
router.get('/status', whatsappController.getBotStatus);

// Ruta para enviar un mensaje
router.post('/send-message', whatsappController.sendMessage);

// Ruta para enviar código de verificación
router.post('/send-verification', whatsappController.sendVerificationCode);

// Ruta para enviar mensaje de bienvenida
router.post('/send-welcome', whatsappController.sendWelcomeMessage);

// Ruta para destruir el bot
router.delete('/destroy', whatsappController.destroyBot);

export default router;

