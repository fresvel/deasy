import whatsappBot from '../../services/whatsapp/WhatsAppBot.js';

// Inicializar el bot
export const initializeBot = async (req, res) => {
    try {
        whatsappBot.initialize();
        res.status(200).json({
            success: true,
            message: 'Bot de WhatsApp iniciando...',
            info: 'Escanea el código QR en la consola del servidor'
        });
    } catch (error) {
        console.error('Error al inicializar bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al inicializar el bot',
            error: error.message
        });
    }
};

// Obtener estado del bot
export const getBotStatus = async (req, res) => {
    try {
        const status = whatsappBot.getStatus();
        res.status(200).json({
            success: true,
            status: status
        });
    } catch (error) {
        console.error('Error al obtener estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estado del bot',
            error: error.message
        });
    }
};

// Enviar mensaje
export const sendMessage = async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                message: 'Número de teléfono y mensaje son requeridos'
            });
        }

        // Validar que el bot esté listo
        if (!whatsappBot.isReady) {
            return res.status(503).json({
                success: false,
                message: 'El bot no está listo. Por favor, escanea el código QR primero.'
            });
        }

        const result = await whatsappBot.sendMessage(phoneNumber, message);
        
        res.status(200).json({
            success: true,
            message: 'Mensaje enviado correctamente',
            data: result
        });
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        res.status(500).json({
            success: false,
            message: 'Error al enviar mensaje',
            error: error.message
        });
    }
};

// Enviar código de verificación
export const sendVerificationCode = async (req, res) => {
    try {
        const { phoneNumber, code } = req.body;

        if (!phoneNumber || !code) {
            return res.status(400).json({
                success: false,
                message: 'Número de teléfono y código son requeridos'
            });
        }

        // Validar que el bot esté listo
        if (!whatsappBot.isReady) {
            return res.status(503).json({
                success: false,
                message: 'El bot no está listo. Por favor, escanea el código QR primero.'
            });
        }

        const result = await whatsappBot.sendVerificationCode(phoneNumber, code);
        
        res.status(200).json({
            success: true,
            message: 'Código de verificación enviado',
            data: result
        });
    } catch (error) {
        console.error('Error al enviar código:', error);
        res.status(500).json({
            success: false,
            message: 'Error al enviar código de verificación',
            error: error.message
        });
    }
};

// Enviar mensaje de bienvenida
export const sendWelcomeMessage = async (req, res) => {
    try {
        const { phoneNumber, userName } = req.body;

        if (!phoneNumber || !userName) {
            return res.status(400).json({
                success: false,
                message: 'Número de teléfono y nombre de usuario son requeridos'
            });
        }

        // Validar que el bot esté listo
        if (!whatsappBot.isReady) {
            return res.status(503).json({
                success: false,
                message: 'El bot no está listo. Por favor, escanea el código QR primero.'
            });
        }

        const result = await whatsappBot.sendWelcomeMessage(phoneNumber, userName);
        
        res.status(200).json({
            success: true,
            message: 'Mensaje de bienvenida enviado',
            data: result
        });
    } catch (error) {
        console.error('Error al enviar bienvenida:', error);
        res.status(500).json({
            success: false,
            message: 'Error al enviar mensaje de bienvenida',
            error: error.message
        });
    }
};

// Destruir el bot
export const destroyBot = async (req, res) => {
    try {
        whatsappBot.destroy();
        res.status(200).json({
            success: true,
            message: 'Bot de WhatsApp destruido correctamente'
        });
    } catch (error) {
        console.error('Error al destruir bot:', error);
        res.status(500).json({
            success: false,
            message: 'Error al destruir el bot',
            error: error.message
        });
    }
};
