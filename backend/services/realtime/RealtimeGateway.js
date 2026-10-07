import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { getAccessTokenSecret } from "../../utils/login/generate_token.js";
import { UserRepository } from "../../dominios/identidad/index.js";
import {
  ChatAuthorizationService,
  ChatConversationService,
  logChatError,
  logChatInfo,
} from "../../dominios/chat/index.js";

const userRoom = (personId) => `user:${personId}`;
const conversationRoom = (conversationId) => `conversation:${conversationId}`;
const processRoom = (processId) => `process:${processId}`;

/**
 * Gateway de tiempo real basado en Socket.IO.
 *
 * Reemplaza al broker EMQX: el backend ya tiene un servidor HTTP de Express,
 * así que montamos los WebSockets sobre el mismo puerto y reutilizamos el JWT
 * de la aplicación para autenticar. Los rooms mapean 1:1 a los antiguos topics
 * MQTT (users/{id}, conversations/{id}, processes/{id}).
 */
class RealtimeGateway {
  // ⚠️ EL CONSTRUCTOR NO INSTANCIA NADA, y esta es la razón: abajo hay un **singleton de módulo**
  // (`new RealtimeGateway()` al final del fichero), así que todo lo que el constructor construyera
  // se construiría al IMPORTAR este módulo. Y los tres que construía vienen de la puerta de un
  // dominio —`UserRepository` de `identidad`, los dos de `chat`—, así que importar esto arrastraba
  // dos puertas enteras antes de que terminaran de inicializarse. Costó 9 suites en rojo con
  // `ReferenceError: Cannot access 'UserRepository' before initialization` al mover `identidad`.
  //
  // Resueltos al PRIMER USO. El singleton puede quedarse: lo que no podía quedarse era su trabajo.
  constructor() {
    this.io = null;
    this._userRepository = null;
    this._conversationService = null;
    this._authorizationService = null;
  }

  get userRepository() {
    return (this._userRepository ??= new UserRepository());
  }

  get conversationService() {
    return (this._conversationService ??= new ChatConversationService());
  }

  get authorizationService() {
    return (this._authorizationService ??= new ChatAuthorizationService());
  }

  /**
   * Inicializa el servidor Socket.IO sobre un servidor HTTP existente.
   * @param {import("http").Server} httpServer
   * @param {{ corsOrigin?: any, credentials?: boolean }} options
   */
  init(httpServer, { corsOrigin = true, credentials = true } = {}) {
    if (this.io) {
      return this.io;
    }

    this.io = new Server(httpServer, {
      path: "/socket.io",
      cors: {
        origin: corsOrigin,
        credentials
      }
    });

    this.io.use((socket, next) => this.authenticateSocket(socket, next));

    this.io.on("connection", (socket) => this.handleConnection(socket));

    logChatInfo("realtime.gateway.initialized", { path: "/socket.io" });
    return this.io;
  }

  async authenticateSocket(socket, next) {
    try {
      const rawToken =
        socket.handshake?.auth?.token ||
        (socket.handshake?.headers?.authorization || "").split(" ")[1] ||
        "";

      if (!rawToken) {
        return next(new Error("Token requerido"));
      }

      const secret = getAccessTokenSecret();
      if (!secret) {
        return next(new Error("JWT no configurado"));
      }

      const decoded = jwt.verify(rawToken, secret);
      const userId = Number(decoded?.uid || 0);
      if (!userId) {
        return next(new Error("Token inválido"));
      }

      const person = await this.userRepository.findById(userId);
      if (!person) {
        return next(new Error("Persona autenticada no encontrada"));
      }

      socket.data.userId = userId;
      socket.data.personId = Number(person.id);
      return next();
    } catch (error) {
      // Al cliente siempre se le responde "Token inválido" (no se filtra el motivo),
      // pero aquí caen dos cosas muy distintas: un JWT caducado/manipulado (normal, el
      // frontend refresca) y un fallo de `userRepository.findById` (base de datos caída).
      // Sin esta traza el segundo caso era invisible: todos los usuarios veían "token
      // inválido" y el servidor no dejaba ni una línea.
      logChatError("realtime.auth.rejected", {
        reason: error?.name || "Error",
        message: error?.message
      });
      return next(new Error("Token inválido"));
    }
  }

  handleConnection(socket) {
    const personId = socket.data.personId;
    socket.join(userRoom(personId));

    socket.on("conversation:subscribe", (payload, ack) =>
      this.handleConversationSubscribe(socket, payload, ack)
    );
    socket.on("conversation:unsubscribe", (payload) => {
      const conversationId = payload?.conversationId;
      if (conversationId) {
        socket.leave(conversationRoom(conversationId));
      }
    });
    socket.on("process:subscribe", (payload, ack) =>
      this.handleProcessSubscribe(socket, payload, ack)
    );
    socket.on("process:unsubscribe", (payload) => {
      const processId = payload?.processId;
      if (processId) {
        socket.leave(processRoom(processId));
      }
    });
  }

  async handleConversationSubscribe(socket, payload, ack) {
    const conversationId = payload?.conversationId;
    const personId = socket.data.personId;
    try {
      // Reutiliza la misma autorización que el endpoint REST: lanza si la
      // persona no es participante de la conversación.
      await this.conversationService.getForParticipant(conversationId, personId);
      socket.join(conversationRoom(conversationId));
      if (typeof ack === "function") ack({ ok: true });
    } catch (error) {
      if (typeof ack === "function") ack({ ok: false, error: error?.message || "No autorizado" });
    }
  }

  async handleProcessSubscribe(socket, payload, ack) {
    const processId = payload?.processId;
    const scopeUnitId = payload?.scopeUnitId ?? null;
    const personId = socket.data.personId;
    try {
      await this.authorizationService.resolveProcessThreadContext({
        personId,
        processId,
        scopeUnitId
      });
      socket.join(processRoom(processId));
      if (typeof ack === "function") ack({ ok: true });
    } catch (error) {
      if (typeof ack === "function") ack({ ok: false, error: error?.message || "No autorizado" });
    }
  }

  isReady() {
    return Boolean(this.io);
  }

  emitToUser(personId, event, payload) {
    if (!this.io) return false;
    this.io.to(userRoom(personId)).emit(event, payload);
    return true;
  }

  emitToConversation(conversationId, event, payload) {
    if (!this.io) return false;
    this.io.to(conversationRoom(conversationId)).emit(event, payload);
    return true;
  }

  emitToProcess(processId, event, payload) {
    if (!this.io) return false;
    this.io.to(processRoom(processId)).emit(event, payload);
    return true;
  }
}

// Singleton compartido por todo el backend, RESUELTO AL PRIMER USO y no al importar.
//
// Se exporta una funcion, no la instancia, y eso es a proposito: construirla aqui ejecutaba su
// constructor en el instante del import, y su constructor alcanzaba servicios de DOS dominios
// —`identidad` y `chat`—, asi que importar este modulo arrastraba las dos puertas antes de que
// terminaran de inicializarse. Son tres consumidores y cuatro usos: sale mas barato que una
// excepcion en la puerta.
let instancia = null;
const realtimeGateway = () => (instancia ??= new RealtimeGateway());
export default realtimeGateway;
