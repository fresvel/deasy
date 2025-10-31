import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

class WhatsAppBot {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
    }

    // Inicializar el cliente de WhatsApp
    initialize() {
        if (this.client) {
            console.log('⚠️ El bot ya está inicializado');
            return;
        }

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './whatsapp-sessions'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        // Evento: Cuando se genera el QR
        this.client.on('qr', (qr) => {
            console.log('📱 Escanea el código QR con tu WhatsApp:');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
        });

        // Evento: Cuando el cliente está listo
        this.client.on('ready', () => {
            console.log('✅ Bot de WhatsApp está listo!');
            this.isReady = true;
            this.qrCode = null;
        });

        // Evento: Cuando se recibe un mensaje
        this.client.on('message', async (msg) => {
            await this.handleMessage(msg);
        });

        // Evento: Estado de autenticación
        this.client.on('authenticated', () => {
            console.log('🔐 Autenticación exitosa');
        });

        // Evento: Fallo de autenticación
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Fallo de autenticación:', msg);
            this.isReady = false;
        });

        // Evento: Cliente desconectado
        this.client.on('disconnected', (reason) => {
            console.log('🔌 Cliente desconectado:', reason);
            this.isReady = false;
            this.client.destroy();
            this.client = null;
        });

        // Iniciar el cliente
        this.client.initialize();
    }

    // Manejar mensajes entrantes
    async handleMessage(msg) {
        const message = msg.body.toLowerCase().trim();
        const contact = await msg.getContact();
        const name = contact.pushname || contact.number;

        console.log(`📨 Mensaje de ${name}: ${msg.body}`);

        try {
            // Comandos del bot
            if (message === 'hola' || message === 'hi' || message === 'hello') {
                await msg.reply(
                    `¡Hola ${name}! 👋\n\n` +
                    `Soy el Bot de *DEASY PUCESE*.\n\n` +
                    `¿En qué puedo ayudarte?\n\n` +
                    `Comandos disponibles:\n` +
                    `• *menu* - Ver opciones\n` +
                    `• *ayuda* - Información de ayuda\n` +
                    `• *info* - Información del sistema`
                );
            } 
            else if (message === 'menu') {
                await msg.reply(
                    `📋 *MENÚ PRINCIPAL*\n\n` +
                    `1️⃣ Información de registro\n` +
                    `2️⃣ Consultar estado\n` +
                    `3️⃣ Soporte técnico\n` +
                    `4️⃣ Horarios de atención\n\n` +
                    `Escribe el número de la opción que deseas.`
                );
            }
            else if (message === 'ayuda' || message === 'help') {
                await msg.reply(
                    `❓ *AYUDA*\n\n` +
                    `Este bot te permite:\n` +
                    `• Recibir notificaciones\n` +
                    `• Consultar información\n` +
                    `• Obtener soporte\n\n` +
                    `Para más información, escribe *menu*`
                );
            }
            else if (message === 'info') {
                await msg.reply(
                    `ℹ️ *DEASY PUCESE*\n\n` +
                    `Sistema de gestión académica\n` +
                    `Pontificia Universidad Católica del Ecuador Sede Esmeraldas\n\n` +
                    `Bot en fase de pruebas 🧪`
                );
            }
            else if (message === '1') {
                await msg.reply(
                    `📝 *INFORMACIÓN DE REGISTRO*\n\n` +
                    `Para registrarte en DEASY:\n` +
                    `1. Visita nuestro sitio web\n` +
                    `2. Completa el formulario\n` +
                    `3. Verifica tu correo electrónico\n` +
                    `4. ¡Listo para usar!\n\n` +
                    `¿Necesitas más ayuda? Escribe *soporte*`
                );
            }
            else if (message === '2') {
                await msg.reply(
                    `🔍 *CONSULTAR ESTADO*\n\n` +
                    `Para verificar el estado de tu cuenta, necesito tu número de cédula.\n\n` +
                    `Por favor, escribe:\n` +
                    `estado [tu-cedula]\n\n` +
                    `Ejemplo: estado 1234567890`
                );
            }
            else if (message === '3' || message === 'soporte') {
                await msg.reply(
                    `🛠️ *SOPORTE TÉCNICO*\n\n` +
                    `Estamos aquí para ayudarte.\n\n` +
                    `📧 Email: soporte@pucese.edu.ec\n` +
                    `📞 Teléfono: +593 6 271 2212\n` +
                    `🕐 Horario: L-V 8:00-17:00\n\n` +
                    `Describe tu problema y te contactaremos pronto.`
                );
            }
            else if (message === '4') {
                await msg.reply(
                    `🕐 *HORARIOS DE ATENCIÓN*\n\n` +
                    `Lunes a Viernes\n` +
                    `8:00 AM - 12:00 PM\n` +
                    `2:00 PM - 5:00 PM\n\n` +
                    `Sábados\n` +
                    `8:00 AM - 12:00 PM\n\n` +
                    `Domingos: Cerrado`
                );
            }
            else if (message.startsWith('estado ')) {
                const cedula = message.replace('estado ', '').trim();
                await msg.reply(
                    `🔍 Buscando información para cédula: ${cedula}\n\n` +
                    `⏳ Por favor espera un momento...`
                );
                // Aquí puedes integrar con tu base de datos
                setTimeout(async () => {
                    await msg.reply(
                        `✅ Estado de cuenta:\n\n` +
                        `Cédula: ${cedula}\n` +
                        `Estado: Activo\n` +
                        `Último acceso: Hoy\n\n` +
                        `_Nota: Esta es una respuesta de prueba_`
                    );
                }, 2000);
            }
            else {
                // Mensaje no reconocido
                await msg.reply(
                    `🤔 No entiendo ese comando.\n\n` +
                    `Escribe *menu* para ver las opciones disponibles.`
                );
            }
        } catch (error) {
            console.error('❌ Error al procesar mensaje:', error);
            await msg.reply(
                `⚠️ Lo siento, ocurrió un error al procesar tu mensaje.\n\n` +
                `Por favor, intenta de nuevo o contacta a soporte.`
            );
        }
    }

    // Enviar mensaje a un número específico
    async sendMessage(phoneNumber, message) {
        if (!this.isReady) {
            throw new Error('El bot no está listo. Por favor, escanea el código QR primero.');
        }

        try {
            // Formatear número (agregar @c.us si no lo tiene)
            const chatId = phoneNumber.includes('@c.us') 
                ? phoneNumber 
                : `${phoneNumber}@c.us`;

            await this.client.sendMessage(chatId, message);
            console.log(`✅ Mensaje enviado a ${phoneNumber}`);
            return { success: true, message: 'Mensaje enviado correctamente' };
        } catch (error) {
            console.error('❌ Error al enviar mensaje:', error);
            throw error;
        }
    }

    // Enviar código de verificación
    async sendVerificationCode(phoneNumber, code) {
        const message = 
            `🔐 *CÓDIGO DE VERIFICACIÓN*\n\n` +
            `Tu código de verificación para DEASY PUCESE es:\n\n` +
            `*${code}*\n\n` +
            `Este código expira en 10 minutos.\n` +
            `No compartas este código con nadie.\n\n` +
            `Si no solicitaste este código, ignora este mensaje.`;

        return await this.sendMessage(phoneNumber, message);
    }

    // Enviar notificación de bienvenida
    async sendWelcomeMessage(phoneNumber, userName) {
        const message = 
            `🎉 *¡Bienvenido a DEASY PUCESE!*\n\n` +
            `Hola ${userName},\n\n` +
            `Tu cuenta ha sido creada exitosamente.\n\n` +
            `Ahora puedes acceder a todas las funcionalidades del sistema.\n\n` +
            `Si tienes alguna pregunta, escribe *ayuda* en cualquier momento.\n\n` +
            `¡Que tengas un excelente día! 😊`;

        return await this.sendMessage(phoneNumber, message);
    }

    // Obtener estado del bot
    getStatus() {
        return {
            isReady: this.isReady,
            hasQR: this.qrCode !== null,
            qrCode: this.qrCode
        };
    }

    // Destruir el cliente
    destroy() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
            this.isReady = false;
            console.log('🔌 Bot de WhatsApp destruido');
        }
    }
}

// Exportar instancia única (Singleton)
const whatsappBot = new WhatsAppBot();

export default whatsappBot;
