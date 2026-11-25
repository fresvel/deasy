// LA PUERTA DEL DOMINIO `chat`. Es lo ÚNICO que otro dominio —o `index.js`— puede importar de aquí.
//
// Por qué existe, y no es ceremonia: sin ella, cualquiera importa `datos/chatStore.js` y se salta las
// reglas que viven en `services/`. Con ella, lo que el dominio ofrece está escrito en un sitio y se
// puede leer de una vez. Medido al moverlo: de fuera entraban **5 imports** a 5 ficheros distintos;
// ahora entran por aquí.
//
// ⚠️ Lo que NO se exporta es tan importante como lo que sí: `datos/chatStore.js` (sus 28 consultas) y
// `datos/consulta/` no salen del dominio. Si algo de fuera los necesita, es que falta una operación
// aquí — no un import más.
export { default as chatRouter } from "./routes/chat_router.js";
export { default as notificationRouter } from "./routes/notification_router.js";

// Lo que la pasarela de tiempo real necesita para repartir mensajes y comprobar quién puede oírlos.
export { default as ChatConversationService } from "./services/ChatConversationService.js";
export { default as ChatAuthorizationService } from "./services/ChatAuthorizationService.js";
export { logChatInfo, logChatError } from "./services/chat_logging.js";

// ⚠️ EL CREADOR DE NOTIFICACIONES, por el mismo motivo (F5.6). `services/canales/AvisoDeCanalCaido.js`
// insertaba en `chat_notifications` por su cuenta —era la quinta línea de `_deuda_escritura`—, y con
// esto el escritor vuelve a ser uno. El aviso de canal caído es una notificación como las demás: lo
// que cambia es el `type`, no la tabla.
export { insertNotification as crearNotificacion } from "./datos/chatStore.js";
