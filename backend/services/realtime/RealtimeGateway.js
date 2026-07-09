import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { getAccessTokenSecret } from "../../utils/login/generate_token.js";
import UserRepository from "../auth/UserRepository.js";
import ChatConversationService from "../chat/ChatConversationService.js";
import ChatAuthorizationService from "../chat/ChatAuthorizationService.js";
import { logChatInfo } from "../chat/chat_logging.js";

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
  constructor() {
    this.io = null;
    this.userRepository = new UserRepository();
    this.conversationService = new ChatConversationService();
    this.authorizationService = new ChatAuthorizationService();
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

// Singleton compartido por todo el backend.
const realtimeGateway = new RealtimeGateway();
export default realtimeGateway;
